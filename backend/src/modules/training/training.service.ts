import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCertificationDto } from './dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  create(companyId: string, dto: CreateCertificationDto) {
    return this.prisma.certification.create({
      data: {
        companyId,
        userId: dto.userId,
        name: dto.name,
        issuedAt: new Date(dto.issuedAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async listAll(companyId: string) {
    const certs = await this.prisma.certification.findMany({
      where: { companyId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { expiresAt: 'asc' },
    });
    const now = Date.now();
    // Honest, computed-on-read status — not a stored field that could
    // drift stale (a stored "EXPIRING_SOON" flag would need a cron job
    // to stay accurate; computing it at read time never can be wrong).
    return certs.map((c: { expiresAt: Date | null }) => {
      let status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY' = 'NO_EXPIRY';
      if (c.expiresAt) {
        const daysLeft = (c.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);
        status = daysLeft < 0 ? 'EXPIRED' : daysLeft <= 30 ? 'EXPIRING_SOON' : 'VALID';
      }
      return { ...c, computedStatus: status };
    });
  }

  listForUser(companyId: string, userId: string) {
    return this.prisma.certification.findMany({ where: { companyId, userId }, orderBy: { expiresAt: 'asc' } });
  }
}
