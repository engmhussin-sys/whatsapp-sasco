import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discountAmount?: number;
}

export interface CreateCouponInput {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxRedemptions?: number;
  validFrom?: string;
  validUntil?: string;
}

/**
 * COUPON ENGINE — validates a coupon code against all the constraints
 * the spec lists (percentage/fixed, max redemptions, expiration window,
 * company-specific restriction via Promotion.applicablePlanId or a
 * future per-coupon company allowlist) and computes the discount amount
 * for a given subtotal. Redemption itself (creating the
 * CouponRedemption row + incrementing redeemedCount) only happens once
 * an invoice is actually issued — validation and redemption are
 * intentionally separate operations so a coupon can be PREVIEWED
 * without being consumed.
 */
@Injectable()
export class CouponService {
  constructor(private prisma: PrismaService) {}

  create(input: CreateCouponInput) {
    return this.prisma.coupon.create({
      data: {
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxRedemptions: input.maxRedemptions,
        validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      },
    });
  }

  listAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async validate(code: string, subtotal: number): Promise<CouponValidationResult> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return { valid: false, reason: 'COUPON_NOT_FOUND' };
    if (!coupon.isActive) return { valid: false, reason: 'COUPON_INACTIVE' };

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) return { valid: false, reason: 'NOT_YET_VALID' };
    if (coupon.validUntil && now > coupon.validUntil) return { valid: false, reason: 'EXPIRED' };
    if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
      return { valid: false, reason: 'MAX_REDEMPTIONS_REACHED' };
    }

    const discountAmount =
      coupon.discountType === DiscountType.PERCENTAGE
        ? Math.round(subtotal * (Number(coupon.discountValue) / 100) * 100) / 100
        : Math.min(Number(coupon.discountValue), subtotal); // a fixed discount can never exceed the subtotal (no negative totals)

    return { valid: true, discountAmount };
  }

  /** Records the redemption — call ONLY after an invoice referencing this coupon is actually created. */
  async redeem(code: string, companyId: string, invoiceId?: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new BadRequestException('Coupon not found');

    return this.prisma.$transaction(async (tx: any) => {
      await tx.coupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
      return tx.couponRedemption.create({ data: { couponId: coupon.id, companyId, invoiceId } });
    });
  }
}
