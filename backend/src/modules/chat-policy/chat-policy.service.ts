import { ForbiddenException, Injectable } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DirectoryService } from '../directory/directory.service';

/**
 * CHAT POLICY ENGINE
 * -----------------------------------------------------------------------
 * Answers one question: "may `fromRole` initiate a DIRECT conversation
 * with `toRole`?" Resolution order:
 *   1. An explicit ChatPolicyRule row for (companyId, fromRole, toRole),
 *      if a Company Admin configured one — always wins.
 *   2. Otherwise, the built-in DEFAULT_RULES below (matching the examples
 *      given in the product spec: Worker->Team(mate) allowed, Worker->
 *      Supervisor allowed, Worker->Manager DENIED unless explicitly
 *      enabled, Manager/Admin can message anyone).
 *
 * IMPORTANT: passing the role check is NECESSARY but not SUFFICIENT — the
 * caller (ConversationsService) must ALSO verify the target user is
 * within the sender's Visibility Engine scope (DirectoryService). A
 * Worker being allowed to message "TEAM_LEAD" as a role pair doesn't
 * mean they can message every team lead in the company, only ones
 * visible to them. See ConversationsService.assertCanMessage().
 */
@Injectable()
export class ChatPolicyService {
  constructor(
    private prisma: PrismaService,
    private directory: DirectoryService,
  ) {}

  private readonly DEFAULT_RULES: Partial<Record<SystemRole, Partial<Record<SystemRole, boolean>>>> = {
    [SystemRole.WORKER]: {
      [SystemRole.WORKER]: true, // teammates (actual "same team" narrowing comes from Visibility Engine)
      [SystemRole.TEAM_LEAD]: true, // Worker -> Supervisor
      [SystemRole.COMPANY_ADMIN]: false, // Worker -> Manager — denied unless explicitly enabled
      [SystemRole.SUPER_ADMIN]: false,
    },
    [SystemRole.TEAM_LEAD]: {
      [SystemRole.WORKER]: true,
      [SystemRole.TEAM_LEAD]: true,
      [SystemRole.COMPANY_ADMIN]: true,
      [SystemRole.SUPER_ADMIN]: false,
    },
    // Manager (COMPANY_ADMIN) -> everyone
    [SystemRole.COMPANY_ADMIN]: {
      [SystemRole.WORKER]: true,
      [SystemRole.TEAM_LEAD]: true,
      [SystemRole.COMPANY_ADMIN]: true,
      [SystemRole.SUPER_ADMIN]: true,
    },
  };

  async isAllowed(companyId: string, fromRole: SystemRole, toRole: SystemRole): Promise<boolean> {
    if (fromRole === SystemRole.SUPER_ADMIN) return true; // platform-level override, always audited via AuditLog on the resulting conversation

    const override = await this.prisma.chatPolicyRule.findUnique({
      where: { companyId_fromRole_toRole: { companyId, fromRole, toRole } },
    });
    if (override) return override.allowed;

    return this.DEFAULT_RULES[fromRole]?.[toRole] ?? true; // permissive fallback for role pairs with no explicit stance
  }

  async listRules(companyId: string) {
    return this.prisma.chatPolicyRule.findMany({ where: { companyId }, orderBy: [{ fromRole: 'asc' }, { toRole: 'asc' }] });
  }

  async upsertRule(companyId: string, fromRole: SystemRole, toRole: SystemRole, allowed: boolean) {
    return this.prisma.chatPolicyRule.upsert({
      where: { companyId_fromRole_toRole: { companyId, fromRole, toRole } },
      create: { companyId, fromRole, toRole, allowed },
      update: { allowed },
    });
  }

  /**
   * Full enforcement used by ConversationsService before creating a
   * DIRECT conversation: role-pair policy AND target-visibility, both
   * required. Throws ForbiddenException with a specific reason if either
   * check fails, rather than a generic 403.
   */
  async assertCanMessage(companyId: string, fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) return; // a user can always "message" themself (edge case, harmless)

    const [fromUser, toUser] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: fromUserId, companyId } }),
      this.prisma.user.findFirst({ where: { id: toUserId, companyId } }),
    ]);
    if (!fromUser || !toUser) throw new ForbiddenException('User not found in this company');

    const roleAllowed = await this.isAllowed(companyId, fromUser.systemRole, toUser.systemRole);
    if (!roleAllowed) {
      throw new ForbiddenException(`Company chat policy does not permit ${fromUser.systemRole} to message ${toUser.systemRole}`);
    }

    if (fromUser.systemRole !== SystemRole.COMPANY_ADMIN && fromUser.systemRole !== SystemRole.SUPER_ADMIN) {
      const visibleIds = await this.directory.getVisibleUserIds(companyId, fromUserId);
      if (!visibleIds.has(toUserId)) {
        throw new ForbiddenException('This user is outside your visibility scope in the Company Directory');
      }
    }
  }
}
