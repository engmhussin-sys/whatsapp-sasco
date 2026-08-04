import { Test } from '@nestjs/testing';
import { MessageType } from '@prisma/client';
import { VoiceProcessingService } from '../../../src/modules/voice-processing/voice-processing.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { CompanyDictionaryService } from '../../../src/modules/company-dictionary/company-dictionary.service';
import {
  SPEECH_TO_TEXT_PROVIDER,
  TRANSLATION_PROVIDER,
  TEXT_TO_SPEECH_PROVIDER,
} from '../../../src/modules/voice-processing/voice-processing.interfaces';

describe('VoiceProcessingService — Smart Translation Policy', () => {
  let service: VoiceProcessingService;
  let prisma: any;
  let translationProvider: any;
  let dictionary: any;

  const baseMessage = {
    id: 'msg-1',
    type: MessageType.TEXT,
    conversation: {
      companyId: 'company-A',
      company: {
        supportedLanguages: [{ langCode: 'en' }, { langCode: 'ar' }, { langCode: 'hi' }],
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      message: { findUnique: jest.fn() },
      messageTranslation: { findMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    translationProvider = { translateBatch: jest.fn() };
    dictionary = { lookupExactMatch: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VoiceProcessingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyDictionaryService, useValue: dictionary },
        { provide: SPEECH_TO_TEXT_PROVIDER, useValue: { transcribe: jest.fn() } },
        { provide: TRANSLATION_PROVIDER, useValue: translationProvider },
        { provide: TEXT_TO_SPEECH_PROVIDER, useValue: { synthesize: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(VoiceProcessingService);
  });

  it('RULE 1: never creates a translation row for the sender\'s own language', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.messageTranslation.findMany.mockResolvedValue([]);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    translationProvider.translateBatch.mockResolvedValue([
      { targetLanguage: 'hi', translatedText: 'नमस्ते', engine: 'noop' },
    ]);

    await service.fanOutTranslations('msg-1', 'Hello', 'en');

    // targetLanguages passed to the provider must exclude 'en' (source == sender language)
    expect(translationProvider.translateBatch).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguages: expect.not.arrayContaining(['en']) }),
    );
  });

  it('RULE 2: uses the cache and skips the provider entirely when a translation already exists', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.messageTranslation.findMany.mockResolvedValue([
      { langCode: 'ar' },
      { langCode: 'hi' },
    ]); // both non-English targets already cached

    await service.fanOutTranslations('msg-1', 'Hello', 'en');

    expect(translationProvider.translateBatch).not.toHaveBeenCalled();
    expect(dictionary.lookupExactMatch).not.toHaveBeenCalled();
  });

  it('RULE 3: SYSTEM messages use templates and NEVER call the provider or dictionary', async () => {
    prisma.message.findUnique.mockResolvedValue({ ...baseMessage, type: MessageType.SYSTEM });
    prisma.messageTranslation.findMany.mockResolvedValue([]);

    await service.fanOutTranslations('msg-1', 'shift_opened', 'en');

    expect(translationProvider.translateBatch).not.toHaveBeenCalled();
    expect(dictionary.lookupExactMatch).not.toHaveBeenCalled();
    expect(prisma.messageTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ langCode: 'ar', translatedText: 'تم فتح الوردية', engine: 'system-template' }),
      }),
    );
  });

  it('RULE 4: consults the Company Dictionary BEFORE the general translation provider', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.messageTranslation.findMany.mockResolvedValue([]);
    dictionary.lookupExactMatch.mockImplementation((_companyId: string, _text: string, _src: string, target: string) =>
      target === 'ar' ? Promise.resolve('صمام الأمان') : Promise.resolve(null),
    );
    translationProvider.translateBatch.mockResolvedValue([
      { targetLanguage: 'hi', translatedText: 'सुरक्षा वाल्व', engine: 'noop' },
    ]);

    await service.fanOutTranslations('msg-1', 'safety valve', 'en');

    // 'ar' resolved via dictionary — must NOT be sent to the provider.
    expect(translationProvider.translateBatch).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguages: ['hi'] }),
    );
    expect(prisma.messageTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ langCode: 'ar', translatedText: 'صمام الأمان', engine: 'company-dictionary' }),
      }),
    );
  });

  it('RULE 5: falls back to the general provider when no dictionary term matches', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    prisma.messageTranslation.findMany.mockResolvedValue([]);
    dictionary.lookupExactMatch.mockResolvedValue(null);
    translationProvider.translateBatch.mockResolvedValue([
      { targetLanguage: 'ar', translatedText: 'مرحبا', engine: 'noop-stub' },
      { targetLanguage: 'hi', translatedText: 'नमस्ते', engine: 'noop-stub' },
    ]);

    await service.fanOutTranslations('msg-1', 'Hello', 'en');

    expect(translationProvider.translateBatch).toHaveBeenCalledWith({
      companyId: 'company-A',
      text: 'Hello',
      sourceLanguage: 'en',
      targetLanguages: ['ar', 'hi'],
    });
  });

  it('forceRetranslate bypasses the cache and increments version', async () => {
    prisma.message.findUnique.mockResolvedValue(baseMessage);
    // With forceRetranslate, findMany for existing cache should never even be consulted.
    dictionary.lookupExactMatch.mockResolvedValue(null);
    translationProvider.translateBatch.mockResolvedValue([
      { targetLanguage: 'ar', translatedText: 'مرحبا مجددًا', engine: 'noop-stub' },
      { targetLanguage: 'hi', translatedText: 'फिर से नमस्ते', engine: 'noop-stub' },
    ]);

    await service.fanOutTranslations('msg-1', 'Hello', 'en', { forceRetranslate: true });

    expect(prisma.messageTranslation.findMany).not.toHaveBeenCalled();
    expect(prisma.messageTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ version: { increment: 1 } }) }),
    );
  });
});
