import { Test } from '@nestjs/testing';
import { TranslationResolutionSource } from '@prisma/client';
import { TranslationEngineService } from '../../../src/modules/translation-engine/translation-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { CompanyDictionaryService } from '../../../src/modules/company-dictionary/company-dictionary.service';
import { TranslationProviderRegistry } from '../../../src/modules/translation-engine/translation-provider.registry';
import { LanguageDetectorService } from '../../../src/modules/translation-engine/language-detector.service';

describe('TranslationEngineService — Smart Translation Policy', () => {
  let service: TranslationEngineService;
  let prisma: any;
  let dictionary: any;
  let registry: any;

  beforeEach(async () => {
    prisma = {
      translationCacheEntry: { findUnique: jest.fn(), upsert: jest.fn() },
      translationMemoryEntry: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      translationAuditLog: { create: jest.fn() },
    };
    dictionary = { lookupExactMatch: jest.fn() };
    registry = { resolveForCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TranslationEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyDictionaryService, useValue: dictionary },
        { provide: TranslationProviderRegistry, useValue: registry },
        LanguageDetectorService,
      ],
    }).compile();

    service = moduleRef.get(TranslationEngineService);
  });

  it('RULE 1: same language short-circuits — no cache/dictionary/memory/provider lookup at all', async () => {
    const result = await service.translate('company-A', 'Hello', 'en', 'en');

    expect(result).toEqual({ translatedText: 'Hello', resolutionSource: TranslationResolutionSource.SAME_LANGUAGE });
    expect(prisma.translationCacheEntry.findUnique).not.toHaveBeenCalled();
    expect(dictionary.lookupExactMatch).not.toHaveBeenCalled();
    expect(prisma.translationMemoryEntry.findUnique).not.toHaveBeenCalled();
    expect(registry.resolveForCompany).not.toHaveBeenCalled();
    expect(prisma.translationAuditLog.create).not.toHaveBeenCalled();
  });

  it('RULE 2: cache hit short-circuits dictionary, memory, AND the provider', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue({
      translatedText: 'مرحبا (من الذاكرة المؤقتة)',
      providerType: 'OPENAI',
    });

    const result = await service.translate('company-A', 'Hello', 'en', 'ar');

    expect(result.resolutionSource).toBe(TranslationResolutionSource.CACHE);
    expect(result.translatedText).toBe('مرحبا (من الذاكرة المؤقتة)');
    expect(dictionary.lookupExactMatch).not.toHaveBeenCalled();
    expect(prisma.translationMemoryEntry.findUnique).not.toHaveBeenCalled();
    expect(registry.resolveForCompany).not.toHaveBeenCalled();
    expect(prisma.translationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ resolutionSource: TranslationResolutionSource.CACHE }) }),
    );
  });

  it('RULE 3: dictionary hit is consulted BEFORE memory and the provider, and populates the cache', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue(null);
    dictionary.lookupExactMatch.mockResolvedValue('صمام الأمان');

    const result = await service.translate('company-A', 'safety valve', 'en', 'ar');

    expect(result.resolutionSource).toBe(TranslationResolutionSource.DICTIONARY);
    expect(result.translatedText).toBe('صمام الأمان');
    expect(prisma.translationMemoryEntry.findUnique).not.toHaveBeenCalled();
    expect(registry.resolveForCompany).not.toHaveBeenCalled();
    expect(prisma.translationCacheEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ translatedText: 'صمام الأمان' }) }),
    );
  });

  it('RULE 4: memory hit is consulted BEFORE the provider, increments reuse count, and populates the cache', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue(null);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    prisma.translationMemoryEntry.findUnique.mockResolvedValue({
      id: 'mem-1',
      translatedText: 'صباح الخير',
      timesReused: 3,
    });

    const result = await service.translate('company-A', 'Good morning', 'en', 'ar');

    expect(result.resolutionSource).toBe(TranslationResolutionSource.MEMORY);
    expect(registry.resolveForCompany).not.toHaveBeenCalled();
    expect(prisma.translationMemoryEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem-1' }, data: expect.objectContaining({ timesReused: { increment: 1 } }) }),
    );
    expect(prisma.translationCacheEntry.upsert).toHaveBeenCalled();
  });

  it('RULE 5: falls back to the AI provider when nothing else matches, and saves to BOTH cache and memory', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue(null);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    prisma.translationMemoryEntry.findUnique.mockResolvedValue(null);
    const mockProvider = {
      providerType: 'DEEPL',
      translate: jest.fn().mockResolvedValue({ translatedText: 'إجازة سعيدة', tokensUsed: null, costEstimate: 0.0002 }),
    };
    registry.resolveForCompany.mockResolvedValue({ provider: mockProvider, apiKey: 'fake-key', region: null, model: null });

    const result = await service.translate('company-A', 'Happy holiday', 'en', 'ar', 'user-1');

    expect(result.resolutionSource).toBe(TranslationResolutionSource.PROVIDER);
    expect(result.translatedText).toBe('إجازة سعيدة');
    expect(result.providerType).toBe('DEEPL');
    expect(mockProvider.translate).toHaveBeenCalledWith(
      { text: 'Happy holiday', sourceLanguage: 'en', targetLanguage: 'ar' },
      { apiKey: 'fake-key', region: null, model: null },
    );
    expect(prisma.translationCacheEntry.upsert).toHaveBeenCalled();
    expect(prisma.translationMemoryEntry.upsert).toHaveBeenCalled();
    expect(prisma.translationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolutionSource: TranslationResolutionSource.PROVIDER,
          tokensUsed: null,
          costEstimate: 0.0002,
        }),
      }),
    );
  });

  it('retranslate() always calls the provider, bypassing cache/dictionary/memory entirely, even for a previously cached pair', async () => {
    const mockProvider = {
      providerType: 'OPENAI',
      translate: jest.fn().mockResolvedValue({ translatedText: 'نسخة مُحدَّثة', tokensUsed: 42, costEstimate: 0.001 }),
    };
    registry.resolveForCompany.mockResolvedValue({ provider: mockProvider, apiKey: 'fake-key', region: null, model: 'gpt-4o-mini' });
    prisma.translationCacheEntry.findUnique.mockResolvedValue({ version: 2 });

    const result = await service.retranslate('company-A', 'Updated notice', 'en', 'ar');

    expect(mockProvider.translate).toHaveBeenCalled();
    expect(result.resolutionSource).toBe(TranslationResolutionSource.PROVIDER);
    expect(prisma.translationCacheEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ version: 3 }) }),
    );
  });

  it('never breaks the request when tokensUsed/costEstimate are null (character-billed providers like Google/DeepL/Azure)', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue(null);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    prisma.translationMemoryEntry.findUnique.mockResolvedValue(null);
    const mockProvider = {
      providerType: 'GOOGLE',
      translate: jest.fn().mockResolvedValue({ translatedText: 'مرحبا', tokensUsed: null, costEstimate: 0.00004 }),
    };
    registry.resolveForCompany.mockResolvedValue({ provider: mockProvider, apiKey: 'k', region: null, model: null });

    const result = await service.translate('company-A', 'Hello', 'en', 'ar');
    expect(result.tokensUsed).toBeNull();
    expect(result.costEstimate).toBe(0.00004);
  });

  it('translateAutoDetect() detects the source language then runs the normal policy', async () => {
    prisma.translationCacheEntry.findUnique.mockResolvedValue(null);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    prisma.translationMemoryEntry.findUnique.mockResolvedValue(null);
    const mockProvider = {
      providerType: 'OPENAI',
      translate: jest.fn().mockResolvedValue({ translatedText: 'Hello', tokensUsed: 10, costEstimate: 0.001 }),
    };
    registry.resolveForCompany.mockResolvedValue({ provider: mockProvider, apiKey: 'k', region: null, model: null });

    const result = await service.translateAutoDetect('company-A', 'مرحبا', 'en');

    expect(result.detectedLanguage).toBe('ar');
    expect(mockProvider.translate).toHaveBeenCalledWith(
      { text: 'مرحبا', sourceLanguage: 'ar', targetLanguage: 'en' },
      expect.anything(),
    );
  });
});
