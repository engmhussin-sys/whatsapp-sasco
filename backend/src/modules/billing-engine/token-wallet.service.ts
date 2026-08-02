import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * TOKEN WALLET — every AI-consuming service (Translation Engine, future
 * OCR/Speech/Image Analysis engines) debits from this wallet. The
 * balance is NEVER mutated directly — every change goes through a
 * TokenWalletTransaction row inside a single DB transaction, so the
 * balance is always reconstructable/auditable from its transaction
 * history alone.
 */
@Injectable()
export class TokenWalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateWallet(companyId: string) {
    return this.prisma.tokenWallet.upsert({
      where: { companyId },
      create: { companyId, balanceTokens: 0 },
      update: {},
    });
  }

  async getBalance(companyId: string): Promise<number> {
    const wallet = await this.prisma.tokenWallet.findUnique({ where: { companyId } });
    return wallet ? Number(wallet.balanceTokens) : 0;
  }

  async credit(companyId: string, amount: number, reason: string, relatedEntityType?: string, relatedEntityId?: string) {
    if (amount <= 0) throw new BadRequestException('Credit amount must be positive');

    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.tokenWallet.upsert({
        where: { companyId },
        create: { companyId, balanceTokens: amount },
        update: { balanceTokens: { increment: amount } },
      });
      await tx.tokenWalletTransaction.create({
        data: { walletId: wallet.id, amount, reason, relatedEntityType, relatedEntityId },
      });
      return wallet;
    });
  }

  /** Throws if the wallet doesn't have enough balance — debits are never allowed to go negative. */
  async debit(companyId: string, amount: number, reason: string, relatedEntityType?: string, relatedEntityId?: string) {
    if (amount <= 0) throw new BadRequestException('Debit amount must be positive');

    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.tokenWallet.findUnique({ where: { companyId } });
      const currentBalance = wallet ? Number(wallet.balanceTokens) : 0;
      if (currentBalance < amount) {
        throw new BadRequestException(`Insufficient token balance: has ${currentBalance}, needs ${amount}`);
      }
      const updated = await tx.tokenWallet.update({
        where: { companyId },
        data: { balanceTokens: { decrement: amount } },
      });
      await tx.tokenWalletTransaction.create({
        data: { walletId: updated.id, amount: -amount, reason, relatedEntityType, relatedEntityId },
      });
      return updated;
    });
  }

  listTransactions(companyId: string) {
    return this.prisma.tokenWallet
      .findUnique({ where: { companyId } })
      .then((wallet: { id: string } | null) =>
        wallet
          ? this.prisma.tokenWalletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' } })
          : [],
      );
  }
}
