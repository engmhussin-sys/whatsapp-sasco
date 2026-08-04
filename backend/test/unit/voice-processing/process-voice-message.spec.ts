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
import { ChatGateway } from '../../../src/modules/websocket/chat.gateway';

/**
 * processVoiceMessage() is the Phase-2 activation entry point that
 * existed, fully written, since before this project's voice-translation
 * work — but nothing ever called it (see MessagesService.sendVoice's own
 * fix). These tests cover the orchestration itself: transcribe -> save
 * onto originalText/originalLang -> fan out translations -> broadcast
 * message:translated so an already-open chat updates live, exactly the
 * same class of fix already shipped for text messages.
 */
describe('VoiceProcessingService.processVoiceMessage() — end-to-end orchestration', () => {
  let service: VoiceProcessingService;
  let prisma: any;
  let stt: any;
  let translationProvider: any;
  let socketServer: any;

  const messageId = 'voice-msg-1';
  const conversationId = 'conv-1';
  const companyId = 'company-A';

  const conversationInclude = {
    companyId,
    company: { supportedLanguages: [{ langCode: 'ar' }, { langCode: 'en' }] },
  };

  beforeEach(async () => {
    socketServer = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    stt = { transcribe: jest.fn() };
    translationProvider = { translateBatch: jest.fn() };

    prisma = {
      message: { findUnique: jest.fn(), update: jest.fn() },
      messageTranslation: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VoiceProcessingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyDictionaryService, useValue: { lookupExactMatch: jest.fn().mockResolvedValue(null) } },
        { provide: SPEECH_TO_TEXT_PROVIDER, useValue: stt },
        { provide: TRANSLATION_PROVIDER, useValue: translationProvider },
        { provide: TEXT_TO_SPEECH_PROVIDER, useValue: { synthesize: jest.fn() } },
        { provide: ChatGateway, useValue: { server: socketServer } },
      ],
    }).compile();

    service = moduleRef.get(VoiceProcessingService);
  });

  it('does nothing (no crash) when the message no longer exists or has no audio', async () => {
    prisma.message.findUnique.mockResolvedValue(null);
    await expect(service.processVoiceMessage(messageId)).resolves.toBeUndefined();
    expect(stt.transcribe).not.toHaveBeenCalled();
  });

  it('transcribes the audio and saves the result onto originalText/originalLang', async () => {
    prisma.message.findUnique
      .mockResolvedValueOnce({ id: messageId, audioUrl: 'https://cdn/clip.webm', conversationId, conversation: conversationInclude })
      .mockResolvedValueOnce({ id: messageId, conversationId, conversation: conversationInclude }) // re-fetched inside fanOutTranslations for supportedLanguages
      .mockResolvedValueOnce({
        id: messageId,
        conversationId,
        conversation: { id: conversationId, companyId },
        sender: {},
        attachments: [],
        receipts: [],
        translations: [],
        reactions: [],
      });
    stt.transcribe.mockResolvedValue({ text: 'مرحبا كيف حالك', languageCode: 'ar', confidence: 0.9 });
    translationProvider.translateBatch.mockResolvedValue([{ targetLanguage: 'en', translatedText: 'Hello how are you', engine: 'openai' }]);

    await service.processVoiceMessage(messageId);

    expect(stt.transcribe).toHaveBeenCalledWith({ audioUrl: 'https://cdn/clip.webm', mimeType: 'audio/webm' });
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { originalText: 'مرحبا كيف حالك', originalLang: 'ar' },
    });
  });

  it('broadcasts message:translated to the conversation room once transcription+translation complete', async () => {
    prisma.message.findUnique
      .mockResolvedValueOnce({ id: messageId, audioUrl: 'https://cdn/clip.webm', conversationId, conversation: conversationInclude })
      .mockResolvedValueOnce({ id: messageId, conversationId, conversation: conversationInclude }) // re-fetched inside fanOutTranslations for supportedLanguages
      .mockResolvedValueOnce({
        id: messageId,
        conversationId,
        conversation: { id: conversationId, companyId },
        sender: {},
        attachments: [],
        receipts: [{ langCode: 'en', translatedText: 'Hello' }],
        translations: [{ langCode: 'en', translatedText: 'Hello' }],
        reactions: [],
      });
    stt.transcribe.mockResolvedValue({ text: 'مرحبا', languageCode: 'ar', confidence: 0.9 });
    translationProvider.translateBatch.mockResolvedValue([{ targetLanguage: 'en', translatedText: 'Hello', engine: 'openai' }]);

    await service.processVoiceMessage(messageId);

    expect(socketServer.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(socketServer.emit).toHaveBeenCalledWith('message:translated', expect.objectContaining({ id: messageId }));
  });

  it('is a graceful no-op on the broadcast when ChatGateway is not wired (@Optional())', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VoiceProcessingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyDictionaryService, useValue: { lookupExactMatch: jest.fn().mockResolvedValue(null) } },
        { provide: SPEECH_TO_TEXT_PROVIDER, useValue: stt },
        { provide: TRANSLATION_PROVIDER, useValue: translationProvider },
        { provide: TEXT_TO_SPEECH_PROVIDER, useValue: { synthesize: jest.fn() } },
        // ChatGateway deliberately NOT provided.
      ],
    }).compile();
    const serviceWithoutGateway = moduleRef.get(VoiceProcessingService);

    prisma.message.findUnique
      .mockResolvedValueOnce({ id: messageId, audioUrl: 'https://cdn/clip.webm', conversationId, conversation: conversationInclude })
      .mockResolvedValueOnce({ id: messageId, conversationId, conversation: conversationInclude });
    stt.transcribe.mockResolvedValue({ text: 'مرحبا', languageCode: 'ar', confidence: 0.9 });
    translationProvider.translateBatch.mockResolvedValue([{ targetLanguage: 'en', translatedText: 'Hello', engine: 'openai' }]);

    await expect(serviceWithoutGateway.processVoiceMessage(messageId)).resolves.toBeUndefined();
  });

  it('does not call transcribe again for a SYSTEM-type message edge case (defensive — audioUrl absent)', async () => {
    prisma.message.findUnique.mockResolvedValue({ id: messageId, type: MessageType.SYSTEM, audioUrl: null });
    await service.processVoiceMessage(messageId);
    expect(stt.transcribe).not.toHaveBeenCalled();
  });
});
