import { Test } from '@nestjs/testing';
import { TranslationEngineBridgeProvider } from '../../../src/modules/voice-processing/providers/translation-engine-bridge.provider';
import { TranslationEngineService } from '../../../src/modules/translation-engine/translation-engine.service';

/**
 * Confirms the bridge genuinely delegates to TranslationEngineService
 * (the same, already-working text-translation engine) rather than
 * duplicating a second OpenAI-calling implementation — and adapts its
 * shape correctly both ways.
 */
describe('TranslationEngineBridgeProvider', () => {
  let provider: TranslationEngineBridgeProvider;
  let translationEngine: any;

  beforeEach(async () => {
    translationEngine = { translate: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [TranslationEngineBridgeProvider, { provide: TranslationEngineService, useValue: translationEngine }],
    }).compile();
    provider = moduleRef.get(TranslationEngineBridgeProvider);
  });

  it('translate() delegates to TranslationEngineService.translate() with the right arguments', async () => {
    translationEngine.translate.mockResolvedValue({ translatedText: 'Hello', resolutionSource: 'PROVIDER', providerType: 'OPENAI' });

    const result = await provider.translate({ companyId: 'company-A', text: 'مرحبا', sourceLanguage: 'ar', targetLanguage: 'en' });

    expect(translationEngine.translate).toHaveBeenCalledWith('company-A', 'مرحبا', 'ar', 'en');
    expect(result).toEqual({ translatedText: 'Hello', sourceLanguage: 'ar', targetLanguage: 'en', engine: 'OPENAI' });
  });

  it('falls back to resolutionSource as the engine label when providerType is absent (e.g. a cache/dictionary hit)', async () => {
    translationEngine.translate.mockResolvedValue({ translatedText: 'Hello', resolutionSource: 'CACHE', providerType: null });

    const result = await provider.translate({ companyId: 'company-A', text: 'مرحبا', sourceLanguage: 'ar', targetLanguage: 'en' });

    expect(result.engine).toBe('CACHE');
  });

  it('translateBatch() fans out into one translate() call per target language', async () => {
    translationEngine.translate
      .mockResolvedValueOnce({ translatedText: 'Hello', resolutionSource: 'PROVIDER', providerType: 'OPENAI' })
      .mockResolvedValueOnce({ translatedText: 'Bonjour', resolutionSource: 'PROVIDER', providerType: 'OPENAI' });

    const results = await provider.translateBatch({ companyId: 'company-A', text: 'مرحبا', sourceLanguage: 'ar', targetLanguages: ['en', 'fr'] });

    expect(translationEngine.translate).toHaveBeenCalledTimes(2);
    expect(translationEngine.translate).toHaveBeenNthCalledWith(1, 'company-A', 'مرحبا', 'ar', 'en');
    expect(translationEngine.translate).toHaveBeenNthCalledWith(2, 'company-A', 'مرحبا', 'ar', 'fr');
    expect(results.map((r) => r.translatedText)).toEqual(['Hello', 'Bonjour']);
  });
});
