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
