import { Injectable } from '@nestjs/common';
import { TranslationProviderType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Manages WHICH provider a company uses, and in what priority order
 * (fallback chain) — this is the entire "switch providers from the
 * admin panel with zero code changes" mechanism. Upserting a row here
 * takes effect on the very next translate() call; no deployment, no
 * restart.
 */
@Injectable()
export class TranslationProviderConfigService {
  constructor(private prisma: PrismaService) {}

  listForCompany(companyId: string) {
    return this.prisma.translationProviderConfig.findMany({
      where: { companyId },
      orderBy: { priority: 'asc' },
    });
  }

  upsert(
    companyId: string,
    providerType: TranslationProviderType,
    data: { apiKeyEnvVar?: string; region?: string; model?: string; isActive?: boolean; priority?: number },
  ) {
    return this.prisma.translationProviderConfig.upsert({
      where: { companyId_providerType: { companyId, providerType } },
      create: { companyId, providerType, ...data },
      update: data,
    });
  }

  async remove(companyId: string, providerType: TranslationProviderType) {
    await this.prisma.translationProviderConfig.deleteMany({ where: { companyId, providerType } });
  }
}
