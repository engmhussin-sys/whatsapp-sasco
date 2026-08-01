import { Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const DIRECTORY_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  systemRole: true,
  departmentId: true,
  primaryStationId: true,
};

/**
 * VISIBILITY ENGINE
 * -----------------------------------------------------------------------
 * Resolves, for a given requester, exactly which other users in the
 * company they're allowed to see in the Company Directory (and, by
 * extension via ChatPolicyService, who they can start a conversation
 * with — visibility is a PREREQUISITE for chat eligibility, not a
 * separate check).
 *
 * Hierarchy (narrowest to broadest), matching the Product Review spec:
 *   WORKER < TEAM < DEPARTMENT < STATION < COMPANY
 *
 * Resolution order:
 *   1. `User.directoryVisibilityScope` if the Company Admin explicitly
 *      set a per-user override.
 *   2. Otherwise, a role-based default:
 *        SUPER_ADMIN / COMPANY_ADMIN -> COMPANY
 *        TEAM_LEAD                   -> DEPARTMENT
 *        WORKER                      -> TEAM
 *
 * A scope always includes everyone visible at every NARROWER scope too
 * (COMPANY sees everyone; DEPARTMENT sees their department AND their
 * team; etc.) — this is implemented by widening the Prisma `where`
 * clause's OR conditions rather than by recursion, since the hierarchy
 * is fixed and shallow.
 */
@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService) {}

  private defaultScopeForRole(role: SystemRole): VisibilityScope {
    switch (role) {
      case SystemRole.SUPER_ADMIN:
      case SystemRole.COMPANY_ADMIN:
        return VisibilityScope.COMPANY;
      case SystemRole.TEAM_LEAD:
        return VisibilityScope.DEPARTMENT;
      case SystemRole.WORKER:
      default:
        return VisibilityScope.TEAM;
    }
  }

  async resolveEffectiveScope(companyId: string, userId: string): Promise<VisibilityScope> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('User not found');
    return user.directoryVisibilityScope ?? this.defaultScopeForRole(user.systemRole);
  }

  /**
   * Returns the full set of userIds `requesterId` is allowed to see,
   * INCLUDING themself. This is the single source of truth other
   * modules (ChatPolicyService, future search/mention features) should
   * call rather than re-deriving visibility rules independently.
   */
  async getVisibleUserIds(companyId: string, requesterId: string): Promise<Set<string>> {
    const requester = await this.prisma.user.findFirst({
      where: { id: requesterId, companyId },
      include: { teamMemberships: { select: { teamId: true } } },
    });
    if (!requester) throw new NotFoundException('User not found');

    const scope = requester.directoryVisibilityScope ?? this.defaultScopeForRole(requester.systemRole);

    if (scope === VisibilityScope.COMPANY) {
      const all = await this.prisma.user.findMany({ where: { companyId }, select: { id: true } });
      return new Set(all.map((u: { id: string }) => u.id));
    }

    const teamIds = requester.teamMemberships.map((m: { teamId: string }) => m.teamId);

    // Every scope narrower than COMPANY still includes "my teams" as a
    // baseline (a Department Lead should still see their own team even
    // if, say, department assignment data is incomplete).
    const orConditions: Record<string, unknown>[] = [
      { id: requesterId },
      teamIds.length ? { teamMemberships: { some: { teamId: { in: teamIds } } } } : undefined,
    ].filter(Boolean) as Record<string, unknown>[];

    if (scope === VisibilityScope.DEPARTMENT || scope === VisibilityScope.STATION) {
      if (requester.departmentId) orConditions.push({ departmentId: requester.departmentId });
    }
    if (scope === VisibilityScope.STATION) {
      if (requester.primaryStationId) orConditions.push({ primaryStationId: requester.primaryStationId });
    }

    const visible = await this.prisma.user.findMany({
      where: { companyId, OR: orConditions },
      select: { id: true },
    });
    return new Set(visible.map((u: { id: string }) => u.id));
  }

  async getDirectoryUsers(companyId: string, requesterId: string) {
    const visibleIds = await this.getVisibleUserIds(companyId, requesterId);
    return this.prisma.user.findMany({
      where: { companyId, id: { in: Array.from(visibleIds) }, isActive: true },
      select: DIRECTORY_USER_SELECT,
      orderBy: { firstName: 'asc' },
    });
  }

  /**
   * Full directory view: Teams / Departments / Stations / Supervisors /
   * Managers — each filtered to what the requester can see. This is
   * what powers the mobile/web "Company Directory" screen, explicitly
   * replacing any reliance on the phone's local Contacts.
   */
  async getDirectory(companyId: string, requesterId: string) {
    const visibleIds = await this.getVisibleUserIds(companyId, requesterId);
    const visibleIdsArray = Array.from(visibleIds);

    const [teams, departments, stations, supervisors, managers] = await Promise.all([
      this.prisma.team.findMany({
        where: { companyId, members: { some: { userId: { in: visibleIdsArray } } } },
        select: { id: true, name: true, description: true },
      }),
      this.prisma.department.findMany({
        where: { companyId, users: { some: { id: { in: visibleIdsArray } } } },
        select: { id: true, name: true, parentDepartmentId: true },
      }),
      this.prisma.station.findMany({
        where: { companyId, primaryUsers: { some: { id: { in: visibleIdsArray } } } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.user.findMany({
        where: { companyId, id: { in: visibleIdsArray }, systemRole: SystemRole.TEAM_LEAD },
        select: DIRECTORY_USER_SELECT,
      }),
      this.prisma.user.findMany({
        where: { companyId, id: { in: visibleIdsArray }, systemRole: SystemRole.COMPANY_ADMIN },
        select: DIRECTORY_USER_SELECT,
      }),
    ]);

    return { teams, departments, stations, supervisors, managers };
  }
}
