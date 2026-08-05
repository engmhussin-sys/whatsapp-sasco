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

  /** Sprint 15/16 add-on ("استهلاك الذكاء" screen) — platform-wide AI
   * token consumption, built entirely from TokenWalletTransaction rows
   * that were already being recorded on every translation/AI debit.
   * No new tracking added; just the first aggregate view of data that
   * already existed. */
  async getPlatformUsageSummary() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalDebitsLast30Days, wallets] = await Promise.all([
      this.prisma.tokenWalletTransaction.aggregate({
        where: { amount: { lt: 0 }, createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
      // BUG AVOIDED (same class caught earlier in this project on
      // CompanySubscription): TokenWallet has a plain companyId COLUMN,
      // not a `@relation` to Company — no `include: { company }` here.
      // Company names are fetched via a separate lookup below instead.
      this.prisma.tokenWallet.findMany({
        include: {
          transactions: {
            where: { amount: { lt: 0 }, createdAt: { gte: thirtyDaysAgo } },
            select: { amount: true },
          },
        },
      }),
    ]);

    const companies = await this.prisma.company.findMany({
      where: { id: { in: wallets.map((w: { companyId: string }) => w.companyId) } },
      select: { id: true, name: true },
    });
    const companyNameById = new Map(companies.map((c: { id: string; name: string }) => [c.id, c.name]));

    const companyBreakdown = wallets
      .map((w: { companyId: string; balanceTokens: any; transactions: { amount: any }[] }) => ({
        companyId: w.companyId,
        companyName: companyNameById.get(w.companyId) ?? '—',
        currentBalance: Number(w.balanceTokens),
        consumedLast30Days: Math.abs(w.transactions.reduce((sum: number, t: { amount: any }) => sum + Number(t.amount), 0)),
      }))
      .sort((a: { consumedLast30Days: number }, b: { consumedLast30Days: number }) => b.consumedLast30Days - a.consumedLast30Days);

    return {
      totalConsumedLast30Days: Math.abs(Number(totalDebitsLast30Days._sum.amount ?? 0)),
      companyBreakdown,
    };
  }
}
