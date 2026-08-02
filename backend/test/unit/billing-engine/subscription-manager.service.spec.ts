import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SubscriptionManagerService } from '../../../src/modules/billing-engine/subscription-manager.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { TokenWalletService } from '../../../src/modules/billing-engine/token-wallet.service';

describe('SubscriptionManagerService', () => {
  let service: SubscriptionManagerService;
  let prisma: any;
  let tokenWallet: any;

  beforeEach(async () => {
    prisma = {
      billingPlan: { findUnique: jest.fn() },
      companySubscription: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    tokenWallet = { getOrCreateWallet: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionManagerService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenWalletService, useValue: tokenWallet },
      ],
    }).compile();
    service = moduleRef.get(SubscriptionManagerService);
  });

  it('subscribe() throws for an unknown or inactive plan', async () => {
    prisma.billingPlan.findUnique.mockResolvedValue(null);
    await expect(service.subscribe('company-A', 'nonexistent')).rejects.toThrow(NotFoundException);

    prisma.billingPlan.findUnique.mockResolvedValue({ id: 'plan-1', isActive: false });
    await expect(service.subscribe('company-A', 'inactive-plan')).rejects.toThrow(NotFoundException);
  });

  it('subscribe() creates the subscription AND ensures a token wallet exists', async () => {
    prisma.billingPlan.findUnique.mockResolvedValue({ id: 'plan-1', isActive: true });
    prisma.companySubscription.upsert.mockResolvedValue({ id: 'sub-1' });

    await service.subscribe('company-A', 'professional', 1);

    expect(prisma.companySubscription.upsert).toHaveBeenCalled();
    expect(tokenWallet.getOrCreateWallet).toHaveBeenCalledWith('company-A');
  });

  it('renew() throws when there is no existing subscription', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(null);
    await expect(service.renew('company-A')).rejects.toThrow(NotFoundException);
  });

  it('renew() advances currentPeriodStart to the OLD currentPeriodEnd (no gap or overlap)', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
    });
    prisma.companySubscription.update.mockResolvedValue({});

    await service.renew('company-A', 1);

    expect(prisma.companySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentPeriodStart: new Date('2026-02-01') }),
      }),
    );
  });

  it('cancel() marks the subscription inactive with a cancelledAt timestamp', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({ id: 'sub-1' });
    prisma.companySubscription.update.mockResolvedValue({});

    await service.cancel('company-A');

    expect(prisma.companySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false, cancelledAt: expect.any(Date) }) }),
    );
  });
});
