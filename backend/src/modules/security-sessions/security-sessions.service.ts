import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * "جلسات الدخول" screen — uses RefreshToken rows that ALREADY exist
 * (userAgent/ipAddress/createdAt/expiresAt/revokedAt were already being
 * recorded on every login, just never surfaced in any admin screen
 * until now). No new data collection needed — this is purely making
 * already-recorded security data visible and actionable.
 */
@Injectable()
export class SecuritySessionsService {
  constructor(private prisma: PrismaService) {}

  async listActive(companyId?: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(companyId ? { user: { companyId } } : {}),
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, companyId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(sessionId: string) {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }
}
