import { Test } from '@nestjs/testing';
import { DiscountType } from '@prisma/client';
import { CouponService } from '../../../src/modules/billing-engine/coupon.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('CouponService', () => {
  let service: CouponService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      coupon: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      couponRedemption: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CouponService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CouponService);
  });

  it('rejects an unknown coupon code', async () => {
    prisma.coupon.findUnique.mockResolvedValue(null);
    const result = await service.validate('DOES_NOT_EXIST', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_NOT_FOUND');
  });

  it('rejects an inactive coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ isActive: false });
    const result = await service.validate('INACTIVE', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_INACTIVE');
  });

  it('rejects an EXPIRED coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ isActive: true, validFrom: null, validUntil: new Date('2020-01-01') });
    const result = await service.validate('OLD', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('rejects a coupon whose redemption limit is already reached', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ isActive: true, validFrom: null, validUntil: null, maxRedemptions: 5, redeemedCount: 5 });
    const result = await service.validate('MAXED', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MAX_REDEMPTIONS_REACHED');
  });

  it('computes a PERCENTAGE discount correctly', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      isActive: true, validFrom: null, validUntil: null, maxRedemptions: null, redeemedCount: 0,
      discountType: DiscountType.PERCENTAGE, discountValue: 20,
    });
    const result = await service.validate('20OFF', 500);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
  });

  it('computes a FIXED_AMOUNT discount correctly', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      isActive: true, validFrom: null, validUntil: null, maxRedemptions: null, redeemedCount: 0,
      discountType: DiscountType.FIXED_AMOUNT, discountValue: 75,
    });
    const result = await service.validate('75FLAT', 500);
    expect(result.discountAmount).toBe(75);
  });

  it('caps a FIXED_AMOUNT discount at the subtotal — never produces a negative total', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      isActive: true, validFrom: null, validUntil: null, maxRedemptions: null, redeemedCount: 0,
      discountType: DiscountType.FIXED_AMOUNT, discountValue: 1000,
    });
    const result = await service.validate('BIGFLAT', 50);
    expect(result.discountAmount).toBe(50); // capped, not 1000
  });

  it('redeem() increments redeemedCount and creates a CouponRedemption row', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ id: 'coupon-1' });
    await service.redeem('CODE', 'company-A', 'inv-1');
    expect(prisma.coupon.update).toHaveBeenCalledWith({ where: { id: 'coupon-1' }, data: { redeemedCount: { increment: 1 } } });
    expect(prisma.couponRedemption.create).toHaveBeenCalledWith({ data: { couponId: 'coupon-1', companyId: 'company-A', invoiceId: 'inv-1' } });
  });
});
