import { Test } from '@nestjs/testing';
import { MessagesService } from '../../../src/modules/messages/messages.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { STORAGE_PROVIDER } from '../../../src/common/storage/storage.interface';
import { TranslationEngineService } from '../../../src/modules/translation-engine/translation-engine.service';
import { TokenWalletService } from '../../../src/modules/billing-engine/token-wallet.service';
import { UsageEngineService } from '../../../src/modules/billing-engine/usage-engine.service';

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
        { provide: TokenWalletService, useValue: tokenWallet },
        { provide: UsageEngineService, useValue: usageEngine },
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
        { provide: TokenWalletService, useValue: { debit: jest.fn() } },
        { provide: UsageEngineService, useValue: { recordUsage: jest.fn() } },
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
        { provide: TokenWalletService, useValue: {} },
        { provide: UsageEngineService, useValue: {} },
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
