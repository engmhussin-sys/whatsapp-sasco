import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SystemRole } from '@prisma/client';
import { ChatPolicyService } from '../../../src/modules/chat-policy/chat-policy.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { DirectoryService } from '../../../src/modules/directory/directory.service';

describe('ChatPolicyService', () => {
  let service: ChatPolicyService;
  let prisma: any;
  let directory: any;

  beforeEach(async () => {
    prisma = { chatPolicyRule: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() }, user: { findFirst: jest.fn() } };
    directory = { getVisibleUserIds: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: DirectoryService, useValue: directory },
      ],
    }).compile();
    service = moduleRef.get(ChatPolicyService);
  });

  describe('isAllowed() — default built-in rules', () => {
    it('ALLOWS Worker -> Worker (teammates) by default', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);
      expect(await service.isAllowed('company-A', SystemRole.WORKER, SystemRole.WORKER)).toBe(true);
    });

    it('ALLOWS Worker -> Supervisor (TEAM_LEAD) by default', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);
      expect(await service.isAllowed('company-A', SystemRole.WORKER, SystemRole.TEAM_LEAD)).toBe(true);
    });

    it('DENIES Worker -> Manager (COMPANY_ADMIN) by default', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);
      expect(await service.isAllowed('company-A', SystemRole.WORKER, SystemRole.COMPANY_ADMIN)).toBe(false);
    });

    it('ALLOWS Manager -> anyone by default', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);
      expect(await service.isAllowed('company-A', SystemRole.COMPANY_ADMIN, SystemRole.WORKER)).toBe(true);
    });

    it('SUPER_ADMIN always bypasses policy (platform-level override)', async () => {
      expect(await service.isAllowed('company-A', SystemRole.SUPER_ADMIN, SystemRole.WORKER)).toBe(true);
      expect(prisma.chatPolicyRule.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('isAllowed() — company-configured override', () => {
    it('a Company Admin explicitly enabling Worker->Manager OVERRIDES the default denial', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue({ allowed: true });
      expect(await service.isAllowed('company-A', SystemRole.WORKER, SystemRole.COMPANY_ADMIN)).toBe(true);
    });

    it('a Company Admin explicitly disabling Worker->Worker OVERRIDES the default allowance', async () => {
      prisma.chatPolicyRule.findUnique.mockResolvedValue({ allowed: false });
      expect(await service.isAllowed('company-A', SystemRole.WORKER, SystemRole.WORKER)).toBe(false);
    });
  });

  describe('assertCanMessage() — combined role-policy + visibility enforcement', () => {
    it('REJECTS when the role pair itself is denied, even if the target is visible', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'worker-1', systemRole: SystemRole.WORKER })
        .mockResolvedValueOnce({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null); // default: Worker->Manager denied

      await expect(service.assertCanMessage('company-A', 'worker-1', 'admin-1')).rejects.toThrow(ForbiddenException);
      // Visibility should not even need to be checked once the role policy already denies.
      expect(directory.getVisibleUserIds).not.toHaveBeenCalled();
    });

    it('REJECTS when the role pair is allowed but the target is OUTSIDE the sender\'s visibility scope', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'worker-1', systemRole: SystemRole.WORKER })
        .mockResolvedValueOnce({ id: 'worker-2', systemRole: SystemRole.WORKER });
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null); // Worker->Worker allowed by default
      directory.getVisibleUserIds.mockResolvedValue(new Set(['worker-1'])); // worker-2 NOT visible (different team)

      await expect(service.assertCanMessage('company-A', 'worker-1', 'worker-2')).rejects.toThrow(ForbiddenException);
    });

    it('ALLOWS when both the role policy AND visibility checks pass', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'worker-1', systemRole: SystemRole.WORKER })
        .mockResolvedValueOnce({ id: 'worker-2', systemRole: SystemRole.WORKER });
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);
      directory.getVisibleUserIds.mockResolvedValue(new Set(['worker-1', 'worker-2'])); // same team

      await expect(service.assertCanMessage('company-A', 'worker-1', 'worker-2')).resolves.toBeUndefined();
    });

    it('a COMPANY_ADMIN skips the visibility check entirely (administrative reach)', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN })
        .mockResolvedValueOnce({ id: 'worker-1', systemRole: SystemRole.WORKER });
      prisma.chatPolicyRule.findUnique.mockResolvedValue(null);

      await service.assertCanMessage('company-A', 'admin-1', 'worker-1');
      expect(directory.getVisibleUserIds).not.toHaveBeenCalled();
    });
  });
});
