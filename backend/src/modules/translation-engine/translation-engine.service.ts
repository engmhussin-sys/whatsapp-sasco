import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { TranslationResolutionSource } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyDictionaryService } from '../company-dictionary/company-dictionary.service';
import { TranslationProviderRegistry } from './translation-provider.registry';
import { LanguageDetectorService } from './language-detector.service';
import { LanguageDetectionResult } from './interfaces/language-detection.interface';

export interface TranslateResult {
  translatedText: string;
  resolutionSource: TranslationResolutionSource;
  providerType?: string | null;
  tokensUsed?: number | null;
  costEstimate?: number | null;
}

function hashText(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

/**
 * TRANSLATION ENGINE — standalone module, zero dependency on any
 * WorkForce Connect entity (Message/Conversation/etc). Any product can
 * import this module and call `translate()` — it only needs a
 * companyId, source text, and a language pair.
 *
 * SMART TRANSLATION POLICY (implemented exactly as specified):
 *   1. sourceLanguage === targetLanguage → return the original text, no lookup at all
 *   2. Translation Cache (fast exact-match) → return if found
 *   3. Company Dictionary (curated per-company terms) → return if found, also populates the cache
 *   4. Translation Memory (accumulated reusable translations) → return if found, also populates the cache
 *   5. AI Provider (via TranslationProviderRegistry) → call, then persist to BOTH cache and memory
 *
 * Every call is recorded in TranslationAuditLog regardless of which step
 * answered it, including token/cost accounting when available — this is
 * the same data the Billing Engine's AI Usage Tracking reads from.
 */
@Injectable()
export class TranslationEngineService {
  constructor(
    private prisma: PrismaService,
    private dictionary: CompanyDictionaryService,
    private providerRegistry: TranslationProviderRegistry,
    private languageDetector: LanguageDetectorService,
  ) {}

  /** Heuristic, offline, no-API-key language detection — see LanguageDetectorService for why this is the default rather than a provider round-trip. */
  detectLanguage(text: string): LanguageDetectionResult {
    return this.languageDetector.detect(text);
  }

  /** Convenience wrapper: detects the source language automatically, then runs it through the normal 5-step policy. */
  async translateAutoDetect(companyId: string, text: string, targetLanguage: string, requestedById?: string): Promise<TranslateResult & { detectedLanguage: string; detectionConfidence: number }> {
    const detection = this.detectLanguage(text);
    const result = await this.translate(companyId, text, detection.languageCode, targetLanguage, requestedById);
    return { ...result, detectedLanguage: detection.languageCode, detectionConfidence: detection.confidence };
  }

  async translate(
    companyId: string,
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    requestedById?: string,
  ): Promise<TranslateResult> {
    // ---- Step 1: same language — no lookup, no audit entry needed (nothing was resolved) ----
    if (sourceLanguage === targetLanguage) {
      return { translatedText: text, resolutionSource: TranslationResolutionSource.SAME_LANGUAGE };
    }

    const textHash = hashText(text);

    // ---- Step 2: Cache ----
    const cached = await this.prisma.translationCacheEntry.findUnique({
      where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash: textHash, sourceLanguage, targetLanguage } },
    });
    if (cached) {
      await this.recordAudit(companyId, sourceLanguage, targetLanguage, TranslationResolutionSource.CACHE, requestedById);
      return { translatedText: cached.translatedText, resolutionSource: TranslationResolutionSource.CACHE, providerType: cached.providerType };
    }

    // ---- Step 3: Company Dictionary ----
    const dictionaryHit = await this.dictionary.lookupExactMatch(companyId, text, sourceLanguage, targetLanguage);
    if (dictionaryHit) {
      await this.saveToCache(companyId, text, textHash, sourceLanguage, targetLanguage, dictionaryHit, null, null, null);
      await this.recordAudit(companyId, sourceLanguage, targetLanguage, TranslationResolutionSource.DICTIONARY, requestedById);
      return { translatedText: dictionaryHit, resolutionSource: TranslationResolutionSource.DICTIONARY };
    }

    // ---- Step 4: Translation Memory ----
    const memoryHit = await this.prisma.translationMemoryEntry.findUnique({
      where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash: textHash, sourceLanguage, targetLanguage } },
    });
    if (memoryHit) {
      await this.prisma.translationMemoryEntry.update({
        where: { id: memoryHit.id },
        data: { timesReused: { increment: 1 }, lastUsedAt: new Date() },
      });
      await this.saveToCache(companyId, text, textHash, sourceLanguage, targetLanguage, memoryHit.translatedText, null, null, null);
      await this.recordAudit(companyId, sourceLanguage, targetLanguage, TranslationResolutionSource.MEMORY, requestedById);
      return { translatedText: memoryHit.translatedText, resolutionSource: TranslationResolutionSource.MEMORY };
    }

    // ---- Step 5: AI Provider ----
    const { provider, apiKey, region, model } = await this.providerRegistry.resolveForCompany(companyId);
    const result = await provider.translate({ text, sourceLanguage, targetLanguage }, { apiKey, region, model });

    await Promise.all([
      this.saveToCache(companyId, text, textHash, sourceLanguage, targetLanguage, result.translatedText, provider.providerType, result.tokensUsed, result.costEstimate),
      this.prisma.translationMemoryEntry.upsert({
        where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash: textHash, sourceLanguage, targetLanguage } },
        create: { companyId, sourceTextHash: textHash, sourceText: text, sourceLanguage, targetLanguage, translatedText: result.translatedText, timesReused: 0 },
        update: {},
      }),
    ]);
    await this.recordAudit(
      companyId,
      sourceLanguage,
      targetLanguage,
      TranslationResolutionSource.PROVIDER,
      requestedById,
      provider.providerType,
      result.tokensUsed,
      result.costEstimate,
    );

    return {
      translatedText: result.translatedText,
      resolutionSource: TranslationResolutionSource.PROVIDER,
      providerType: provider.providerType,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    };
  }

  /** Explicit re-translation — bypasses cache/dictionary/memory and always calls the provider, bumping the cache entry's version. Used when a company changes provider or corrects a dictionary term. */
  async retranslate(companyId: string, text: string, sourceLanguage: string, targetLanguage: string, requestedById?: string): Promise<TranslateResult> {
    if (sourceLanguage === targetLanguage) {
      return { translatedText: text, resolutionSource: TranslationResolutionSource.SAME_LANGUAGE };
    }
    const textHash = hashText(text);
    const { provider, apiKey, region, model } = await this.providerRegistry.resolveForCompany(companyId);
    const result = await provider.translate({ text, sourceLanguage, targetLanguage }, { apiKey, region, model });

    const existing = await this.prisma.translationCacheEntry.findUnique({
      where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash: textHash, sourceLanguage, targetLanguage } },
    });
    await this.prisma.translationCacheEntry.upsert({
      where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash: textHash, sourceLanguage, targetLanguage } },
      create: {
        companyId,
        sourceTextHash: textHash,
        sourceText: text,
        sourceLanguage,
        targetLanguage,
        translatedText: result.translatedText,
        providerType: provider.providerType as never,
        tokensUsed: result.tokensUsed,
        costEstimate: result.costEstimate,
        version: 1,
      },
      update: {
        translatedText: result.translatedText,
        providerType: provider.providerType as never,
        tokensUsed: result.tokensUsed,
        costEstimate: result.costEstimate,
        version: (existing?.version ?? 0) + 1,
      },
    });

    await this.recordAudit(
      companyId,
      sourceLanguage,
      targetLanguage,
      TranslationResolutionSource.PROVIDER,
      requestedById,
      provider.providerType,
      result.tokensUsed,
      result.costEstimate,
    );

    return {
      translatedText: result.translatedText,
      resolutionSource: TranslationResolutionSource.PROVIDER,
      providerType: provider.providerType,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    };
  }

  private async saveToCache(
    companyId: string,
    sourceText: string,
    sourceTextHash: string,
    sourceLanguage: string,
    targetLanguage: string,
    translatedText: string,
    providerType: string | null,
    tokensUsed: number | null,
    costEstimate: number | null,
  ) {
    await this.prisma.translationCacheEntry.upsert({
      where: { companyId_sourceTextHash_sourceLanguage_targetLanguage: { companyId, sourceTextHash, sourceLanguage, targetLanguage } },
      create: {
        companyId,
        sourceTextHash,
        sourceText,
        sourceLanguage,
        targetLanguage,
        translatedText,
        providerType: providerType as never,
        tokensUsed,
        costEstimate,
      },
      update: { translatedText, providerType: providerType as never, tokensUsed, costEstimate },
    });
  }

  private async recordAudit(
    companyId: string,
    sourceLanguage: string,
    targetLanguage: string,
    resolutionSource: TranslationResolutionSource,
    requestedById?: string,
    providerType?: string,
    tokensUsed?: number | null,
    costEstimate?: number | null,
  ) {
    await this.prisma.translationAuditLog.create({
      data: {
        companyId,
        requestedById,
        sourceLanguage,
        targetLanguage,
        resolutionSource,
        providerType: (providerType ?? null) as never,
        tokensUsed: tokensUsed ?? null,
        costEstimate: costEstimate ?? null,
      },
    });
  }
}
