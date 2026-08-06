import { Test } from '@nestjs/testing';
import { MessagesService } from '../../../src/modules/messages/messages.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { STORAGE_PROVIDER } from '../../../src/common/storage/storage.interface';
import { TranslationEngineService } from '../../../src/modules/translation-engine/translation-engine.service';
import { LanguageDetectorService } from '../../../src/modules/translation-engine/language-detector.service';
import { TokenWalletService } from '../../../src/modules/billing-engine/token-wallet.service';
import { UsageEngineService } from '../../../src/modules/billing-engine/usage-engine.service';
import { ChatGateway } from '../../../src/modules/websocket/chat.gateway';
import { VoiceProcessingService } from '../../../src/modules/voice-processing/voice-processing.service';

const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve));

/**
 * ROOT CAUSE (discovered while building live voice translation, not by
 * design): sendVoice() had NO broadcast call at all — the same "REST
 * path never fires message:new/message:notification" bug already fixed
 * for sendText() turned out to apply here too, just never verified
 * specifically for voice until this file. Also covers the new
 * transcription trigger: sendVoice() must fire processVoiceMessage()
 * in the background without ever blocking the upload response on it.
 */
describe('MessagesService.sendVoice() — realtime broadcast + transcription trigger', () => {
  let service: MessagesService;
  let prisma: any;
  let storage: any;
  let socketServer: any;
  let voiceProcessing: any;

  const senderId = 'sender-1';
  const conversationId = 'conv-1';
  const companyId = 'company-A';

  beforeEach(async () => {
    socketServer = { to: jest.fn().mockReturnThis(), emit: jest.fn(), in: jest.fn().mockReturnThis(), fetchSockets: jest.fn().mockResolvedValue([]) };
    storage = { save: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/uploads/voice-messages/company-A/clip.webm' }) };
    voiceProcessing = { processVoiceMessage: jest.fn().mockResolvedValue(undefined) };

    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ preferredLanguage: 'ar' }) },
      conversationMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'user-2' }]) },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'voice-msg-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'voice-msg-1',
          conversation: { id: conversationId, companyId },
          sender: {},
          attachments: [],
          receipts: [],
          translations: [],
          reactions: [],
        }),
      },
      messageReceipt: { createMany: jest.fn() },
      $transaction: jest.fn(async (fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: { assertMembership: jest.fn(), assertCanPost: jest.fn() } },
        { provide: STORAGE_PROVIDER, useValue: storage },
        { provide: TranslationEngineService, useValue: { translate: jest.fn() } },
        { provide: LanguageDetectorService, useValue: { detect: () => ({ languageCode: 'ar' }) } },
        { provide: TokenWalletService, useValue: { debit: jest.fn() } },
        { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
        { provide: ChatGateway, useValue: { server: socketServer } },
        { provide: VoiceProcessingService, useValue: voiceProcessing },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  const file = { buffer: Buffer.from('fake-audio-bytes'), originalname: 'clip.webm', mimetype: 'audio/webm' };

  it('broadcasts message:new to the conversation room, exactly like a text message', async () => {
    await service.sendVoice(companyId, conversationId, senderId, file, 4200);
    await flushBackgroundWork();

    expect(socketServer.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(socketServer.emit).toHaveBeenCalledWith('message:new', expect.objectContaining({ id: 'voice-msg-1' }));
  });

  it('broadcasts message:notification with a voice-specific preview label', async () => {
    await service.sendVoice(companyId, conversationId, senderId, file, 4200);
    await flushBackgroundWork();

    expect(socketServer.emit).toHaveBeenCalledWith(
      'message:notification',
      expect.objectContaining({ conversationId, messageId: 'voice-msg-1', preview: 'رسالة صوتية' }),
    );
  });

  it('triggers processVoiceMessage() in the background for the newly created message', async () => {
    await service.sendVoice(companyId, conversationId, senderId, file, 4200);
    await flushBackgroundWork();

    expect(voiceProcessing.processVoiceMessage).toHaveBeenCalledWith('voice-msg-1');
  });

  it('does NOT block the upload response on transcription completing', async () => {
    // A processVoiceMessage that never resolves must not hang sendVoice()
    // itself — this is the whole point of firing it without awaiting.
    voiceProcessing.processVoiceMessage.mockReturnValue(new Promise(() => {}));

    await expect(service.sendVoice(companyId, conversationId, senderId, file, 4200)).resolves.toBeDefined();
  });

  it('a transcription trigger failure does NOT surface as an unhandled rejection or fail the upload', async () => {
    voiceProcessing.processVoiceMessage.mockRejectedValue(new Error('whisper exploded'));

    await expect(service.sendVoice(companyId, conversationId, senderId, file, 4200)).resolves.toBeDefined();
    await flushBackgroundWork();
  });
});
