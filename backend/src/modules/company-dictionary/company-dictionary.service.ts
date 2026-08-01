import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpsertDictionaryTermDto } from './dto/company-dictionary.dto';

@Injectable()
export class CompanyDictionaryService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async upsertTerm(companyId: string, actorId: string, dto: UpsertDictionaryTermDto) {
    const term = await this.prisma.companyDictionaryTerm.upsert({
      where: {
        companyId_sourceTerm_sourceLanguage_targetLanguage: {
          companyId,
          sourceTerm: dto.sourceTerm,
          sourceLanguage: dto.sourceLanguage,
          targetLanguage: dto.targetLanguage,
        },
      },
      create: { companyId, ...dto },
      update: { translatedTerm: dto.translatedTerm },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'CompanyDictionaryTerm',
      entityId: term.id,
      metadata: { sourceTerm: dto.sourceTerm, sourceLanguage: dto.sourceLanguage, targetLanguage: dto.targetLanguage },
    });

    return term;
  }

  findAll(companyId: string) {
    return this.prisma.companyDictionaryTerm.findMany({ where: { companyId }, orderBy: { sourceTerm: 'asc' } });
  }

  async remove(companyId: string, id: string, actorId: string) {
    await this.prisma.companyDictionaryTerm.deleteMany({ where: { id, companyId } }); // scoped delete — silently no-ops for a foreign-tenant id
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.DELETE, entityType: 'CompanyDictionaryTerm', entityId: id });
  }

  /**
   * Looks up whole-string matches for `text` in this company's dictionary
   * for the given language pair. Used by TranslationPolicyService BEFORE
   * calling any general-purpose translation provider — a company-specific
   * term (e.g. an internal product/equipment name) should never be
   * mistranslated by a generic model.
   *
   * NOTE (Phase 1 scope): performs a case-insensitive EXACT match on the
   * whole message text, not sub-string/phrase substitution within a
   * longer sentence — that requires tokenization and is intentionally
   * deferred (see docs/production-readiness-review.md). This still
   * fully covers the common case of short system/status phrases and
   * single-term messages.
   */
  async lookupExactMatch(
    companyId: string,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string | null> {
    const term = await this.prisma.companyDictionaryTerm.findFirst({
      where: {
        companyId,
        sourceLanguage,
        targetLanguage,
        sourceTerm: { equals: text, mode: 'insensitive' },
      },
    });
    return term?.translatedTerm ?? null;
  }
}
