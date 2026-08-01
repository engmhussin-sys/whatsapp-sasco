import { AuditAction } from '@prisma/client';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/roles-permissions.dto';

@Injectable()
export class RolesPermissionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async createRole(companyId: string, actorId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { companyId_name: { companyId, name: dto.name } },
    });
    if (existing) throw new ConflictException('A role with this name already exists');

    const role = await this.prisma.role.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        ...(dto.permissionCodes?.length
          ? {
              permissions: {
                create: dto.permissionCodes.map((code) => ({
                  permission: { connect: { code } },
                })),
              },
            }
          : {}),
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Role',
      entityId: role.id,
      metadata: { name: role.name },
    });

    return role;
  }

  async findAll(companyId: string) {
    // Includes both this company's custom roles AND global system role
    // templates (companyId null, isSystem true) so the UI can offer both.
    return this.prisma.role.findMany({
      where: { OR: [{ companyId }, { companyId: null, isSystem: true }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, OR: [{ companyId }, { companyId: null, isSystem: true }] },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(companyId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id, companyId } });
    if (!role) throw new NotFoundException('Role not found or not editable (system roles are read-only)');
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id, companyId } });
    if (!role) throw new NotFoundException('Role not found or not editable');
    await this.prisma.role.delete({ where: { id } });
    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Role',
      entityId: id,
    });
  }

  async setPermissions(companyId: string, roleId: string, dto: AssignPermissionsDto, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionCodes.map((code) => ({ roleId, permissionId: code })),
        skipDuplicates: true,
      }),
    ]);

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.PERMISSION_CHANGE,
      entityType: 'Role',
      entityId: roleId,
      metadata: { permissionCodes: dto.permissionCodes },
    });

    return this.findOne(companyId, roleId);
  }

  async assignRoleToUser(companyId: string, userId: string, roleId: string, actorId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, companyId } }),
      this.prisma.role.findFirst({ where: { id: roleId, OR: [{ companyId }, { companyId: null, isSystem: true }] } }),
    ]);
    if (!user) throw new NotFoundException('User not found in this company');
    if (!role) throw new NotFoundException('Role not found');

    const assignment = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.PERMISSION_CHANGE,
      entityType: 'UserRole',
      entityId: `${userId}:${roleId}`,
    });

    return assignment;
  }

  /** Used by other modules (e.g. Approval Engine) to check a user's effective permission codes. */
  async getUserPermissionCodes(companyId: string, userId: string): Promise<Set<string>> {
    // SECURITY: requiring companyId (rather than trusting userId alone)
    // ensures a future caller cannot compute permissions for a user
    // outside the tenant it believes it is operating in.
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) return new Set();

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const codes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        codes.add(rp.permission.code);
      }
    }
    return codes;
  }
}
