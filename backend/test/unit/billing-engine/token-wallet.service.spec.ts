import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TokenWalletService } from '../../../src/modules/billing-engine/token-wallet.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('TokenWalletService', () => {
  let service: TokenWalletService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tokenWallet: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      tokenWalletTransaction: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [TokenWalletService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TokenWalletService);
  });

  describe('credit()', () => {
    it('rejects a non-positive amount', async () => {
      await expect(service.credit('company-A', 0, 'top_up')).rejects.toThrow(BadRequestException);
      await expect(service.credit('company-A', -5, 'top_up')).rejects.toThrow(BadRequestException);
    });

    it('creates a TokenWalletTransaction with a POSITIVE amount and increments the balance', async () => {
      prisma.tokenWallet.upsert.mockResolvedValue({ id: 'wallet-1', balanceTokens: 500 });

      await service.credit('company-A', 500, 'top_up');

      expect(prisma.tokenWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { balanceTokens: { increment: 500 } } }),
      );
      expect(prisma.tokenWalletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ walletId: 'wallet-1', amount: 500, reason: 'top_up' }) }),
      );
    });
  });

  describe('debit()', () => {
    it('rejects a non-positive amount', async () => {
      await expect(service.debit('company-A', 0, 'translation_usage')).rejects.toThrow(BadRequestException);
    });

    it('REJECTS a debit that would push the balance negative', async () => {
      prisma.tokenWallet.findUnique.mockResolvedValue({ id: 'wallet-1', balanceTokens: 100 });

      await expect(service.debit('company-A', 500, 'translation_usage')).rejects.toThrow(BadRequestException);
      expect(prisma.tokenWallet.update).not.toHaveBeenCalled();
    });

    it('treats a non-existent wallet as a zero balance (rejects any debit)', async () => {
      prisma.tokenWallet.findUnique.mockResolvedValue(null);
      await expect(service.debit('company-A', 1, 'translation_usage')).rejects.toThrow(BadRequestException);
    });

    it('creates a TokenWalletTransaction with a NEGATIVE amount and decrements the balance when sufficient', async () => {
      prisma.tokenWallet.findUnique.mockResolvedValue({ id: 'wallet-1', balanceTokens: 1000 });
      prisma.tokenWallet.update.mockResolvedValue({ id: 'wallet-1', balanceTokens: 900 });

      await service.debit('company-A', 100, 'translation_usage', 'TranslationAuditLog', 'log-1');

      expect(prisma.tokenWallet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { balanceTokens: { decrement: 100 } } }),
      );
      expect(prisma.tokenWalletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ walletId: 'wallet-1', amount: -100, reason: 'translation_usage', relatedEntityId: 'log-1' }),
        }),
      );
    });
  });

  describe('getBalance()', () => {
    it('returns 0 for a company with no wallet yet', async () => {
      prisma.tokenWallet.findUnique.mockResolvedValue(null);
      expect(await service.getBalance('company-A')).toBe(0);
    });

    it('returns the actual balance when a wallet exists', async () => {
      prisma.tokenWallet.findUnique.mockResolvedValue({ balanceTokens: 750 });
      expect(await service.getBalance('company-A')).toBe(750);
    });
  });
});
