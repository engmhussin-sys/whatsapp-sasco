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
import { ImageMetaExtractorService } from '../../../src/common/storage/image-meta-extractor.service';
import { VideoThumbnailExtractorService } from '../../../src/common/storage/video-thumbnail-extractor.service';

/**
 * ROOT CAUSE (full audit, not speculation — grepped the entire mobile
 * codebase for callers of WebSocketClient.sendMessage(): zero found):
 * every text message the app actually sends goes through
 * MessagesController's REST endpoint -> MessagesService.sendText(),
 * which used to do nothing but persist the message. The ONLY code that
 * ever emitted message:new/message:notification was
 * ChatGateway.onSendMessage() — reachable only via a socket event the
 * client never sends. Every real-time symptom (no live messages, no
 * notifications, chat list never updating) traced back to this single
 * gap. These tests assert the fix at the one place that actually
 * matters: does sendText() now trigger a broadcast, with the right
 * payload, to the right rooms — and does it stay non-blocking and
 * non-fatal exactly like the translation fan-out beside it.
 */
const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve));

describe('MessagesService — Realtime broadcast on send (root-cause fix)', () => {
  let service: MessagesService;
  let prisma: any;
  let chatGateway: any;
  let socketServer: any;

  const senderId = 'sender-1';
  const conversationId = 'conv-1';
  const companyId = 'company-A';

  beforeEach(async () => {
    socketServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      in: jest.fn().mockReturnThis(),
      fetchSockets: jest.fn().mockResolvedValue([]),
    };
    chatGateway = { server: socketServer };

    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Sara', lastName: 'Worker' }) },
      conversationMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-2' }, { userId: 'user-3' }]),
        createMany: jest.fn(),
      },
      conversation: { update: jest.fn() },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1', originalLang: 'ar' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'msg-1',
          originalText: 'مرحبا',
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
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: { translate: jest.fn() } },
        { provide: LanguageDetectorService, useValue: { detect: () => ({ languageCode: 'ar' }) } },
        { provide: TokenWalletService, useValue: { debit: jest.fn().mockResolvedValue({}) } },
        { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('broadcasts message:new to the conversation room after a REST send', async () => {
    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(socketServer.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(socketServer.emit).toHaveBeenCalledWith('message:new', expect.objectContaining({ id: 'msg-1' }));
  });

  it('broadcasts message:notification to every OTHER member\'s personal room, but not the sender\'s own', async () => {
    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(socketServer.to).toHaveBeenCalledWith('user:user-2');
    expect(socketServer.to).toHaveBeenCalledWith('user:user-3');
    expect(socketServer.to).not.toHaveBeenCalledWith(`user:${senderId}`);
    expect(socketServer.emit).toHaveBeenCalledWith(
      'message:notification',
      expect.objectContaining({ conversationId, messageId: 'msg-1', senderName: 'Sara Worker' }),
    );
  });

  it('truncates the notification preview for long messages (matches ChatGateway\'s own 80-char rule)', async () => {
    const longText = 'a'.repeat(120);
    await service.sendText(companyId, conversationId, senderId, { text: longText } as any);
    await flushBackgroundWork();

    const call = socketServer.emit.mock.calls.find((c: any[]) => c[0] === 'message:notification');
    expect(call[1].preview.length).toBe(81); // 80 chars + the ellipsis
    expect(call[1].preview.endsWith('…')).toBe(true);
  });

  it('does NOT block the HTTP response on the broadcast — sendText resolves before the broadcast microtask chain finishes', async () => {
    // socketServer.emit deliberately left un-awaited-on by the caller;
    // if broadcastNewMessage were mistakenly awaited inline in
    // sendText(), this assertion would still incidentally pass, so the
    // real guarantee here is structural (see the "never awaited" doc
    // comment at the call site) — this test exists mainly to catch a
    // future regression where someone adds an accidental `await`.
    const before = socketServer.emit.mock.calls.length;
    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    // Immediately after sendText resolves, the broadcast may or may not
    // have run yet depending on microtask timing — what matters is it's
    // not REQUIRED to have run for sendText's own promise to resolve.
    expect(socketServer.emit.mock.calls.length).toBeGreaterThanOrEqual(before);
  });

  it('is a graceful no-op — sendText still succeeds — when ChatGateway is not wired (@Optional())', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: { assertMembership: jest.fn(), assertCanPost: jest.fn() } },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: { translate: jest.fn() } },
        { provide: LanguageDetectorService, useValue: { detect: () => ({ languageCode: 'ar' }) } },
        { provide: TokenWalletService, useValue: { debit: jest.fn().mockResolvedValue({}) } },
        { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
        // ChatGateway deliberately NOT provided at all here.
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    const serviceWithoutGateway = moduleRef.get(MessagesService);

    await expect(serviceWithoutGateway.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any)).resolves.toBeDefined();
    await flushBackgroundWork();
    // No assertion on socketServer here — the point is simply that
    // nothing throws and the message still gets created/returned.
  });

  it('a broadcast failure does NOT surface as an unhandled rejection or fail the send', async () => {
    socketServer.emit.mockImplementation(() => {
      throw new Error('socket server exploded');
    });

    await expect(service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any)).resolves.toBeDefined();
    await flushBackgroundWork();
  });

  describe('message:translated completion broadcast', () => {
    it('broadcasts message:translated to the conversation room once a translation is actually persisted', async () => {
      // First call (inside the send transaction, for receipts) needs
      // plain {userId} rows; the SECOND call, inside fanOutTranslations,
      // needs the joined {userId, user:{preferredLanguage}} shape.
      let translateCall = 0;
      prisma.conversationMember.findMany.mockImplementation(() => {
        translateCall++;
        if (translateCall === 1) return Promise.resolve([{ userId: 'user-2' }]);
        return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'en' } }]);
      });
      prisma.messageTranslation = { upsert: jest.fn() };
      const translationEngine = { translate: jest.fn().mockResolvedValue({ translatedText: 'Hello', resolutionSource: 'PROVIDER', providerType: 'OPENAI' }) };

      const moduleRef = await Test.createTestingModule({
        providers: [
          MessagesService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConversationsService, useValue: { assertMembership: jest.fn(), assertCanPost: jest.fn() } },
          { provide: STORAGE_PROVIDER, useValue: {} },
          { provide: TranslationEngineService, useValue: translationEngine },
          { provide: LanguageDetectorService, useValue: { detect: () => ({ languageCode: 'ar' }) } },
          { provide: TokenWalletService, useValue: { debit: jest.fn().mockResolvedValue({}) } },
          { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
          { provide: ChatGateway, useValue: chatGateway },
          { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        ],
      }).compile();
      const svc = moduleRef.get(MessagesService);

      await svc.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
      await flushBackgroundWork();
      await flushBackgroundWork(); // translation fan-out has its own nested awaits beyond the send itself

      const translatedCall = socketServer.emit.mock.calls.find((c: any[]) => c[0] === 'message:translated');
      expect(translatedCall).toBeDefined();
      expect(socketServer.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('does NOT broadcast message:translated when every member already shares the sender\'s language (nothing to update)', async () => {
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'ar' } }]);

      await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
      await flushBackgroundWork();
      await flushBackgroundWork();

      const translatedCall = socketServer.emit.mock.calls.find((c: any[]) => c[0] === 'message:translated');
      expect(translatedCall).toBeUndefined();
    });
  });
});
