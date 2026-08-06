import { Test } from '@nestjs/testing';
import { MessagesService } from '../../../src/modules/messages/messages.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

/**
 * sendText() now fires translation fan-out WITHOUT awaiting it (see the
 * "BUG FIX" comment on that call site — confirmed via real production
 * logs that awaiting it blocked every message send for 1-2.5s). Tests
 * that assert on side effects happening INSIDE that background chain
 * (recordUsage, tokenWallet.debit, messageTranslation.upsert) need to
 * let its internal awaits actually drain before asserting — setImmediate
 * defers past the current microtask queue, which a bare extra
 * `await Promise.resolve()` isn't reliably enough for a chain with
 * multiple nested awaits.
 */
const flushBackgroundWork = () => new Promise((resolve) => setImmediate(resolve));
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { STORAGE_PROVIDER } from '../../../src/common/storage/storage.interface';
import { TranslationEngineService } from '../../../src/modules/translation-engine/translation-engine.service';
import { LanguageDetectorService } from '../../../src/modules/translation-engine/language-detector.service';
import { TokenWalletService } from '../../../src/modules/billing-engine/token-wallet.service';
import { UsageEngineService } from '../../../src/modules/billing-engine/usage-engine.service';
import { VoiceProcessingService } from '../../../src/modules/voice-processing/voice-processing.service';
import { ImageMetaExtractorService } from '../../../src/common/storage/image-meta-extractor.service';
import { VideoThumbnailExtractorService } from '../../../src/common/storage/video-thumbnail-extractor.service';

describe('MessagesService — Translation Engine activation', () => {
  let service: MessagesService;
  let prisma: any;
  let conversations: any;
  let translationEngine: any;
  let tokenWallet: any;
  let usageEngine: any;

  const senderId = 'sender-1';
  const conversationId = 'conv-1';
  const companyId = 'company-A';

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      conversationMember: { findMany: jest.fn(), createMany: jest.fn() },
      conversation: { update: jest.fn() },
      message: { findUnique: jest.fn(), create: jest.fn() },
      messageReceipt: { createMany: jest.fn() },
      messageTranslation: { upsert: jest.fn() },
      $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    conversations = { assertMembership: jest.fn(), assertCanPost: jest.fn() };
    translationEngine = { translate: jest.fn() };
    tokenWallet = { debit: jest.fn().mockResolvedValue({}) };
    usageEngine = { recordUsage: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: translationEngine },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: tokenWallet },
        { provide: UsageEngineService, useValue: usageEngine },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);

    prisma.user.findUnique.mockResolvedValue({ id: senderId, preferredLanguage: 'ar' });
    prisma.message.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'msg-1', ...data }));
    prisma.message.findUnique.mockImplementation(() =>
      Promise.resolve({
        id: 'msg-1',
        originalLang: 'ar',
        conversation: { id: conversationId, companyId },
        sender: {},
        attachments: [],
        receipts: [],
        translations: [],
      }),
    );
  });

  it('calls the Translation Engine ONCE per DISTINCT target language among other members (deduped)', async () => {
    prisma.conversationMember.findMany.mockResolvedValue([
      { userId: 'sender-1' }, // included once for the receipt-creation call inside the transaction
    ]);
    // Second call (inside fanOutTranslations) needs the "other members with preferredLanguage" shape —
    // mockImplementation lets us differentiate by call order.
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([{ userId: 'user-2' }, { userId: 'user-3' }]); // inside tx, for receipts
      return Promise.resolve([
        { userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'en' } },
        { userId: 'user-3', user: { id: 'user-3', preferredLanguage: 'en' } }, // same target lang as user-2 — must dedupe
        { userId: 'user-4', user: { id: 'user-4', preferredLanguage: 'ar' } }, // same as sender — must skip
      ]);
    });
    translationEngine.translate.mockResolvedValue({ translatedText: 'Hello', resolutionSource: 'PROVIDER', providerType: 'OPENAI' });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(translationEngine.translate).toHaveBeenCalledTimes(1);
    expect(translationEngine.translate).toHaveBeenCalledWith(companyId, 'مرحبا', 'ar', 'en', senderId);
  });

  it('does NOT persist a translation row when the resolution is SAME_LANGUAGE', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'ar' } }]);
    });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    // Same language as sender ('ar') is filtered out BEFORE calling the engine at all.
    expect(translationEngine.translate).not.toHaveBeenCalled();
    expect(prisma.messageTranslation.upsert).not.toHaveBeenCalled();
  });

  it('persists the translation via upsert with the correct language code', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'ur' } }]);
    });
    translationEngine.translate.mockResolvedValue({ translatedText: 'خوش آمدید', resolutionSource: 'CACHE', providerType: null });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(prisma.messageTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageId_langCode: { messageId: 'msg-1', langCode: 'ur' } },
        create: expect.objectContaining({ langCode: 'ur', translatedText: 'خوش آمدید' }),
      }),
    );
  });

  it('a translation FAILURE is caught and logged — the message send itself still succeeds', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockRejectedValue(new Error('provider not configured'));

    await expect(service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any)).resolves.toBeDefined();
    await flushBackgroundWork();
    expect(prisma.messageTranslation.upsert).not.toHaveBeenCalled();
  });

  it('TOKEN WALLET: debits the wallet after a PROVIDER-sourced translation that reports token usage', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({
      translatedText: 'Bonjour',
      resolutionSource: 'PROVIDER',
      providerType: 'OPENAI',
      tokensUsed: 25,
    });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(tokenWallet.debit).toHaveBeenCalledWith(companyId, 25, 'translation_usage', 'Message', 'msg-1');
  });

  it('TOKEN WALLET: does NOT debit for cache/dictionary/memory hits (no tokens were actually consumed)', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({ translatedText: 'Bonjour', resolutionSource: 'CACHE', providerType: null });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(tokenWallet.debit).not.toHaveBeenCalled();
  });

  it('TOKEN WALLET: an insufficient-balance debit failure is caught — the translation stays delivered', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({
      translatedText: 'Bonjour',
      resolutionSource: 'PROVIDER',
      providerType: 'OPENAI',
      tokensUsed: 999999,
    });
    tokenWallet.debit.mockRejectedValue(new Error('Insufficient token balance'));

    await expect(service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any)).resolves.toBeDefined();
    await flushBackgroundWork();
    expect(prisma.messageTranslation.upsert).toHaveBeenCalled(); // translation itself was still persisted
  });

  it('USAGE ENGINE: records "monthly_ai_tokens" usage for PROVIDER-sourced translations', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({
      translatedText: 'Bonjour',
      resolutionSource: 'PROVIDER',
      providerType: 'OPENAI',
      tokensUsed: 25,
    });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(usageEngine.recordUsage).toHaveBeenCalledWith(companyId, 'monthly_ai_tokens', 25);
  });

  it('USAGE ENGINE: does NOT record usage for cache/dictionary/memory hits', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({ translatedText: 'Bonjour', resolutionSource: 'DICTIONARY', providerType: null });

    await service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any);
    await flushBackgroundWork();

    expect(usageEngine.recordUsage).not.toHaveBeenCalled();
  });

  it('USAGE ENGINE: a recordUsage failure (e.g. no subscription / unknown feature) is caught — the translation stays delivered', async () => {
    let call = 0;
    prisma.conversationMember.findMany.mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve([]);
      return Promise.resolve([{ userId: 'user-2', user: { id: 'user-2', preferredLanguage: 'fr' } }]);
    });
    translationEngine.translate.mockResolvedValue({
      translatedText: 'Bonjour',
      resolutionSource: 'PROVIDER',
      providerType: 'OPENAI',
      tokensUsed: 25,
    });
    usageEngine.recordUsage.mockRejectedValue(new Error('Company has no active subscription to meter usage against'));

    await expect(service.sendText(companyId, conversationId, senderId, { text: 'مرحبا' } as any)).resolves.toBeDefined();
    await flushBackgroundWork();
    expect(prisma.messageTranslation.upsert).toHaveBeenCalled();
  });
});

describe('MessagesService.retranslateConversation() — T5 backfill', () => {
  let service: MessagesService;
  let prisma: any;
  let conversations: any;
  let translationEngine: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      message: { findMany: jest.fn() },
      messageTranslation: { upsert: jest.fn() },
    };
    conversations = { assertMembership: jest.fn() };
    translationEngine = { translate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: translationEngine },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: { debit: jest.fn() } },
        { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('checks membership before doing anything (a non-member cannot trigger translation spend for a conversation they cannot see)', async () => {
    conversations.assertMembership.mockRejectedValue(new Error('not a member'));
    await expect(service.retranslateConversation(companyId, conversationId, userId, 'bn')).rejects.toThrow('not a member');
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('only translates messages that have NO existing translation row for the target language yet', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'm1', originalText: 'مرحبا', originalLang: 'ar', translations: [] }, // needs translation
      { id: 'm2', originalText: 'كيف حالك', originalLang: 'ar', translations: [{ langCode: 'bn' }] }, // already has one
    ]);
    translationEngine.translate.mockResolvedValue({ translatedText: 'হ্যালো', resolutionSource: 'PROVIDER', providerType: 'OPENAI' });

    const result = await service.retranslateConversation(companyId, conversationId, userId, 'bn');

    expect(translationEngine.translate).toHaveBeenCalledTimes(1);
    expect(translationEngine.translate).toHaveBeenCalledWith(companyId, 'مرحبا', 'ar', 'bn', userId);
    expect(result).toEqual({ conversationId, targetLanguage: 'bn', messagesConsidered: 1, messagesTranslated: 1 });
  });

  it('excludes messages whose originalLang already matches the target language (Prisma filter, no API call needed)', async () => {
    prisma.message.findMany.mockResolvedValue([]); // the `where: { originalLang: { not: targetLanguage } }` already excludes these at the DB level

    await service.retranslateConversation(companyId, conversationId, userId, 'ar');

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ originalLang: { not: 'ar' } }) }),
    );
    expect(translationEngine.translate).not.toHaveBeenCalled();
  });

  it('a per-message translation failure is caught and does not stop the rest of the backfill', async () => {
    prisma.message.findMany.mockResolvedValue([
      { id: 'm1', originalText: 'واحد', originalLang: 'ar', translations: [] },
      { id: 'm2', originalText: 'اثنان', originalLang: 'ar', translations: [] },
    ]);
    translationEngine.translate
      .mockRejectedValueOnce(new Error('provider timeout'))
      .mockResolvedValueOnce({ translatedText: 'two', resolutionSource: 'PROVIDER', providerType: 'OPENAI' });

    const result = await service.retranslateConversation(companyId, conversationId, userId, 'en');

    expect(result.messagesConsidered).toBe(2);
    expect(result.messagesTranslated).toBe(1); // only the one that succeeded
  });

  it('skips messages with no originalText (e.g. voice messages) without crashing', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'm1', originalText: null, originalLang: 'ar', translations: [] }]);

    const result = await service.retranslateConversation(companyId, conversationId, userId, 'bn');

    expect(translationEngine.translate).not.toHaveBeenCalled();
    expect(result.messagesTranslated).toBe(0);
  });
});

describe('MessagesService.deleteMessage() — Group 2 "Delete for everyone"', () => {
  let service: MessagesService;
  let prisma: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';

  beforeEach(async () => {
    prisma = {
      message: { findFirst: jest.fn(), update: jest.fn() },
      conversation: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: {} },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('throws NotFoundException for a message outside this conversation', async () => {
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.deleteMessage(companyId, conversationId, 'ghost', 'user-1')).rejects.toThrow('Message not found');
  });

  it('throws NotFoundException when the conversation does not belong to this company (tenant isolation)', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1' });
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(service.deleteMessage(companyId, conversationId, 'm1', 'user-1')).rejects.toThrow('Conversation not found');
  });

  it('REJECTS deletion by anyone other than the original sender', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1' });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    await expect(service.deleteMessage(companyId, conversationId, 'm1', 'someone-else')).rejects.toThrow(
      'Only the sender can delete this message for everyone',
    );
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('soft-deletes and BLANKS originalText/audioUrl (tombstone must never leak content)', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1' });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    prisma.message.update.mockResolvedValue({ id: 'm1' });

    await service.deleteMessage(companyId, conversationId, 'm1', 'user-1');

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ deletedForEveryone: true, originalText: null, audioUrl: null, deletedAt: expect.any(Date) }),
    });
  });
});

describe('MessagesService.reactToMessage() — Group 3', () => {
  let service: MessagesService;
  let prisma: any;
  let conversations: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';

  beforeEach(async () => {
    prisma = {
      message: { findFirst: jest.fn() },
      messageReaction: { findUnique: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
    };
    conversations = { assertMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: {} },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('checks membership before anything else', async () => {
    conversations.assertMembership.mockRejectedValue(new Error('not a member'));
    await expect(service.reactToMessage(companyId, conversationId, 'm1', 'user-1', '❤️')).rejects.toThrow('not a member');
    expect(prisma.message.findFirst).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a message outside this conversation', async () => {
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.reactToMessage(companyId, conversationId, 'ghost', 'user-1', '❤️')).rejects.toThrow('Message not found');
  });

  it('creates a NEW reaction when the user has none yet', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.messageReaction.findUnique.mockResolvedValue(null);

    const result = await service.reactToMessage(companyId, conversationId, 'm1', 'user-1', '👍');

    expect(prisma.messageReaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { messageId: 'm1', userId: 'user-1', emoji: '👍' } }),
    );
    expect(result).toEqual({ removed: false, emoji: '👍' });
  });

  it('REMOVES the reaction when tapping the SAME emoji again (toggle-off)', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.messageReaction.findUnique.mockResolvedValue({ messageId: 'm1', userId: 'user-1', emoji: '👍' });

    const result = await service.reactToMessage(companyId, conversationId, 'm1', 'user-1', '👍');

    expect(prisma.messageReaction.delete).toHaveBeenCalledWith({ where: { messageId_userId: { messageId: 'm1', userId: 'user-1' } } });
    expect(prisma.messageReaction.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: true, emoji: '👍' });
  });

  it('REPLACES the reaction when tapping a DIFFERENT emoji', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.messageReaction.findUnique.mockResolvedValue({ messageId: 'm1', userId: 'user-1', emoji: '👍' });

    const result = await service.reactToMessage(companyId, conversationId, 'm1', 'user-1', '❤️');

    expect(prisma.messageReaction.delete).not.toHaveBeenCalled();
    expect(prisma.messageReaction.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { emoji: '❤️' } }));
    expect(result).toEqual({ removed: false, emoji: '❤️' });
  });
});

describe('MessagesService.editMessage() — Group 3', () => {
  let service: MessagesService;
  let prisma: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';

  beforeEach(async () => {
    prisma = {
      message: { findFirst: jest.fn(), update: jest.fn() },
      conversation: { findFirst: jest.fn() },
      messageTranslation: { deleteMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: {} },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: {} },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('throws NotFoundException for a message outside this conversation', async () => {
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.editMessage(companyId, conversationId, 'ghost', 'user-1', 'new text')).rejects.toThrow('Message not found');
  });

  it('REJECTS editing by anyone other than the original sender', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1', type: 'TEXT', deletedAt: null });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    await expect(service.editMessage(companyId, conversationId, 'm1', 'someone-else', 'x')).rejects.toThrow(
      'Only the sender can edit this message',
    );
  });

  it('REJECTS editing a non-text message (voice)', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1', type: 'VOICE', deletedAt: null });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    await expect(service.editMessage(companyId, conversationId, 'm1', 'user-1', 'x')).rejects.toThrow('Only text messages can be edited');
  });

  it('REJECTS editing an already-deleted message', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1', type: 'TEXT', deletedAt: new Date() });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    await expect(service.editMessage(companyId, conversationId, 'm1', 'user-1', 'x')).rejects.toThrow('Cannot edit a deleted message');
  });

  it('clears ALL existing translations (they become stale the instant the original text changes) and sets editedAt', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'm1', senderId: 'user-1', type: 'TEXT', deletedAt: null });
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId });
    prisma.message.update.mockResolvedValue({ id: 'm1' });

    await service.editMessage(companyId, conversationId, 'm1', 'user-1', 'نص مُعدَّل');

    expect(prisma.messageTranslation.deleteMany).toHaveBeenCalledWith({ where: { messageId: 'm1' } });
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { originalText: 'نص مُعدَّل', editedAt: expect.any(Date) },
    });
  });
});

describe('MessagesService.searchMessages() — Group 4', () => {
  let service: MessagesService;
  let prisma: any;
  let conversations: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = { message: { findMany: jest.fn() } };
    conversations = { assertMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: {} },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn().mockReturnValue({ languageCode: 'ar', confidence: 0.9 }) } },
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  it('checks membership before searching', async () => {
    conversations.assertMembership.mockRejectedValue(new Error('not a member'));
    await expect(service.searchMessages(companyId, conversationId, userId, 'test')).rejects.toThrow('not a member');
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array without querying the DB for a blank/whitespace-only query', async () => {
    const result = await service.searchMessages(companyId, conversationId, userId, '   ');
    expect(result).toEqual([]);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('searches originalText case-insensitively, excludes deleted messages, caps at 50', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'm1' }]);

    await service.searchMessages(companyId, conversationId, userId, 'مرحبا');

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId, deletedAt: null, originalText: { contains: 'مرحبا', mode: 'insensitive' } },
        take: 50,
      }),
    );
  });
});

describe('MessagesService — delivery status aggregation (sender-visible ticks)', () => {
  let service: MessagesService;
  let prisma: any;
  let conversations: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      messageReceipt: { updateMany: jest.fn(), findMany: jest.fn() },
      message: { findFirst: jest.fn(), update: jest.fn() },
      conversationMember: { update: jest.fn() },
    };
    conversations = { assertMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: STORAGE_PROVIDER, useValue: {} },
        { provide: TranslationEngineService, useValue: {} },
        { provide: LanguageDetectorService, useValue: { detect: jest.fn() } },
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
        { provide: VoiceProcessingService, useValue: { processVoiceMessage: jest.fn().mockResolvedValue(undefined) } },
        { provide: ImageMetaExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
        { provide: VideoThumbnailExtractorService, useValue: { extract: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  describe('markDelivered()', () => {
    it('recomputes and writes the aggregate status onto the parent Message row', async () => {
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 1 });
      prisma.messageReceipt.findMany.mockResolvedValue([{ status: 'DELIVERED' }]);

      await service.markDelivered('msg-1', userId);

      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { status: 'DELIVERED' } });
    });
  });

  describe('recomputeMessageStatus() semantics (exercised via markDelivered)', () => {
    it('is SENT if ANY recipient still has not received it', async () => {
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 0 });
      prisma.messageReceipt.findMany.mockResolvedValue([{ status: 'DELIVERED' }, { status: 'SENT' }]);

      await service.markDelivered('msg-1', userId);

      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { status: 'SENT' } });
    });

    it('is DELIVERED if every recipient has it but not everyone has read it yet', async () => {
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 0 });
      prisma.messageReceipt.findMany.mockResolvedValue([{ status: 'READ' }, { status: 'DELIVERED' }]);

      await service.markDelivered('msg-1', userId);

      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { status: 'DELIVERED' } });
    });

    it('is READ only once EVERY recipient has read it', async () => {
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 0 });
      prisma.messageReceipt.findMany.mockResolvedValue([{ status: 'READ' }, { status: 'READ' }]);

      await service.markDelivered('msg-1', userId);

      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'msg-1' }, data: { status: 'READ' } });
    });

    it('does nothing if the message has no receipts at all (edge case, should not crash)', async () => {
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 0 });
      prisma.messageReceipt.findMany.mockResolvedValue([]);

      await service.markDelivered('msg-1', userId);

      expect(prisma.message.update).not.toHaveBeenCalled();
    });
  });

  describe('markRead()', () => {
    it('recomputes status for every message that was actually flipped to READ', async () => {
      conversations.assertMembership.mockResolvedValue({});
      prisma.message.findFirst.mockResolvedValue(null); // no upToMessageId cutoff in this test
      prisma.messageReceipt.findMany
        .mockResolvedValueOnce([{ messageId: 'm1' }, { messageId: 'm2' }]) // "affected" lookup before the bulk update
        .mockResolvedValueOnce([{ status: 'READ' }]) // recompute for m1
        .mockResolvedValueOnce([{ status: 'READ' }]); // recompute for m2
      prisma.messageReceipt.updateMany.mockResolvedValue({ count: 2 });
      prisma.conversationMember.update.mockResolvedValue({});

      await service.markRead(companyId, conversationId, userId);

      expect(prisma.message.update).toHaveBeenCalledTimes(2);
      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'READ' } });
      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { status: 'READ' } });
    });
  });
});
