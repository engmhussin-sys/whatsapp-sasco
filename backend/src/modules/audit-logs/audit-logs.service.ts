import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RecordAuditParams {
  companyId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Single write path for the AuditLog table. Every module that mutates
 * tenant data (users, roles, tasks, approvals, shift logs, fuel
 * requests, ...) MUST call `record()` after a successful mutation.
 * Kept as a thin, dependency-free service so it can be injected
 * anywhere without circular module imports.
 */
@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async record(params: RecordAuditParams) {
    return this.prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress,
      },
    });
  }

  async findForCompany(
    companyId: string,
    params: { skip?: number; take?: number; entityType?: string },
  ) {
    const where = {
      companyId,
      ...(params.entityType ? { entityType: params.entityType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
