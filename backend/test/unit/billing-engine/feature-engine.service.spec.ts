import { Test } from '@nestjs/testing';
import { FeatureEngineService } from '../../../src/modules/billing-engine/feature-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('FeatureEngineService', () => {
  let service: FeatureEngineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { companySubscription: { findUnique: jest.fn() }, usageCounter: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [FeatureEngineService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FeatureEngineService);
  });

  it('DENIES access when the company has no active subscription', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(null);
    const result = await service.checkAccess('company-A', 'can_use_translation');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NO_ACTIVE_SUBSCRIPTION');
  });

  it('DENIES access when the feature is not included in the company\'s plan', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      isActive: true,
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      plan: { featureLimits: [{ featureId: 'f1', includedLimit: 100, feature: { code: 'can_use_voice' } }] },
    });
    const result = await service.checkAccess('company-A', 'can_use_translation');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_INCLUDED_IN_PLAN');
  });

  it('ALLOWS unlimited access when includedLimit is null, without querying usage at all', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      isActive: true,
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      plan: { featureLimits: [{ featureId: 'f1', includedLimit: null, feature: { code: 'can_use_chat' } }] },
    });
    const result = await service.checkAccess('company-A', 'can_use_chat');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
    expect(prisma.usageCounter.findUnique).not.toHaveBeenCalled();
  });

  it('ALLOWS access when usage is below the limit, and reports remaining correctly', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      isActive: true,
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      plan: { featureLimits: [{ featureId: 'f1', includedLimit: 1000, feature: { code: 'monthly_ai_tokens' } }] },
    });
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 400 });

    const result = await service.checkAccess('company-A', 'monthly_ai_tokens');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(400);
    expect(result.remaining).toBe(600);
  });

  it('DENIES access once usage reaches or exceeds the limit', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      isActive: true,
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      plan: { featureLimits: [{ featureId: 'f1', includedLimit: 1000, feature: { code: 'monthly_ai_tokens' } }] },
    });
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 1000 });

    const result = await service.checkAccess('company-A', 'monthly_ai_tokens');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('LIMIT_EXCEEDED');
    expect(result.remaining).toBe(0);
  });

  it('assertAccess() throws when access is not allowed', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(null);
    await expect(service.assertAccess('company-A', 'can_use_api')).rejects.toThrow();
  });
});
