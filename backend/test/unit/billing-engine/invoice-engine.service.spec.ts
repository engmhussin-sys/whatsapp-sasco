import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceEngineService } from '../../../src/modules/billing-engine/invoice-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { CouponService } from '../../../src/modules/billing-engine/coupon.service';
import { WebhookDispatcherService } from '../../../src/modules/billing-engine/webhook-dispatcher.service';

describe('InvoiceEngineService', () => {
  let service: InvoiceEngineService;
  let prisma: any;
  let coupons: any;
  let webhooks: any;

  const baseSubscription = {
    id: 'sub-1',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    plan: {
      name: 'Professional',
      basePrice: 500,
      featureLimits: [
        { featureId: 'f-tokens', includedLimit: 1000, overageUnitPrice: 0.05, feature: { code: 'monthly_ai_tokens', name: 'AI Tokens', unit: 'TOKENS' } },
        { featureId: 'f-users', includedLimit: 20, overageUnitPrice: null, feature: { code: 'max_users', name: 'Users', unit: 'COUNT' } }, // no overage price -> never billed even if exceeded
      ],
    },
    addOns: [],
  };

  beforeEach(async () => {
    prisma = {
      companySubscription: { findUnique: jest.fn() },
      usageCounter: { findUnique: jest.fn() },
      invoice: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    };
    coupons = { validate: jest.fn(), redeem: jest.fn() };
    webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoiceEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: CouponService, useValue: coupons },
        { provide: WebhookDispatcherService, useValue: webhooks },
      ],
    }).compile();

    service = moduleRef.get(InvoiceEngineService);
  });

  it('throws when the company has no subscription', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(null);
    await expect(service.generateInvoice('company-A')).rejects.toThrow(NotFoundException);
  });

  it('bills ONLY the base plan price when usage is within limits (no overage line items)', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(baseSubscription);
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 500 }); // under the 1000 token limit
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-1' }));

    const invoice = await service.generateInvoice('company-A');

    expect(invoice.subtotal).toBe(500);
    expect(invoice.total).toBe(500);
    const lineItemDescriptions = invoice.lineItems.create.map((li: any) => li.featureCode);
    expect(lineItemDescriptions).not.toContain('monthly_ai_tokens'); // no overage line since usage <= limit
  });

  it('adds an overage line item ONLY for features with BOTH usage over the limit AND a configured overageUnitPrice', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(baseSubscription);
    // First feature (tokens) exceeds its limit; second (users) has no overageUnitPrice so must never bill even if checked.
    prisma.usageCounter.findUnique
      .mockResolvedValueOnce({ usedAmount: 1500 }) // tokens: 1500 used, 1000 included -> 500 overage
      .mockResolvedValueOnce({ usedAmount: 25 }); // users: over limit but no overageUnitPrice -> skipped entirely (not even queried in real flow, but harmless either way)
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-2' }));

    const invoice = await service.generateInvoice('company-A');

    const tokenLine = invoice.lineItems.create.find((li: any) => li.featureCode === 'monthly_ai_tokens');
    expect(tokenLine).toBeDefined();
    expect(tokenLine.quantity).toBe(500);
    expect(tokenLine.amount).toBe(25); // 500 * 0.05
    expect(invoice.subtotal).toBe(525); // 500 base + 25 overage
  });

  it('applies a VALID coupon discount before tax, and redeems it after invoice creation', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(baseSubscription);
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 0 });
    coupons.validate.mockResolvedValue({ valid: true, discountAmount: 50 });
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-3' }));

    const invoice = await service.generateInvoice('company-A', { couponCode: 'SAVE50' });

    expect(invoice.discountTotal).toBe(50);
    expect(invoice.total).toBe(450); // 500 - 50, no tax configured
    expect(coupons.redeem).toHaveBeenCalledWith('SAVE50', 'company-A', 'inv-3');
  });

  it('does NOT redeem an INVALID coupon and applies zero discount', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(baseSubscription);
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 0 });
    coupons.validate.mockResolvedValue({ valid: false, reason: 'EXPIRED' });
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-4' }));

    const invoice = await service.generateInvoice('company-A', { couponCode: 'EXPIRED10' });

    expect(invoice.discountTotal).toBe(0);
    expect(coupons.redeem).not.toHaveBeenCalled();
  });

  it('applies tax to the POST-discount amount, not the raw subtotal', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue(baseSubscription);
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 0 });
    coupons.validate.mockResolvedValue({ valid: true, discountAmount: 100 });
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-5' }));

    // subtotal 500, discount 100 -> taxable 400, tax 15% = 60 -> total 460
    const invoice = await service.generateInvoice('company-A', { couponCode: 'SAVE100', taxRatePercent: 15 });

    expect(invoice.taxTotal).toBe(60);
    expect(invoice.total).toBe(460);
  });

  it('includes active add-ons as their own line items', async () => {
    prisma.companySubscription.findUnique.mockResolvedValue({
      ...baseSubscription,
      addOns: [{ addOn: { name: 'Extra Storage', price: 30, featureId: null } }],
    });
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 0 });
    prisma.invoice.create.mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'inv-6' }));

    const invoice = await service.generateInvoice('company-A');

    expect(invoice.subtotal).toBe(530); // 500 base + 30 add-on
  });

  it('markPaid() dispatches an INVOICE_PAID webhook with the invoice details', async () => {
    prisma.invoice.update.mockResolvedValue({
      id: 'inv-7',
      companyId: 'company-A',
      invoiceNumber: 'INV-TEST-1',
      total: 500,
      currency: 'SAR',
      paidAt: new Date('2026-01-15'),
    });

    await service.markPaid('inv-7');

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-7' }, data: expect.objectContaining({ status: 'PAID' }) }),
    );
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'company-A',
      'INVOICE_PAID',
      expect.objectContaining({ invoiceId: 'inv-7', total: 500 }),
    );
  });
});
