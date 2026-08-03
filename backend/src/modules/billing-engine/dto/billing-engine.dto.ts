import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BillingModel, DiscountType, FeatureUnit, WebhookEventType } from '@prisma/client';

export class CreatePlanDto {
  @IsString() @MinLength(2) code: string;
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(BillingModel) billingModel: BillingModel;
  @IsNumber() basePrice: number;
  @IsOptional() @IsString() currency?: string;
}

export class CreateFeatureDto {
  @IsString() @MinLength(2) code: string;
  @IsString() @MinLength(2) name: string;
  @IsEnum(FeatureUnit) unit: FeatureUnit;
  @IsOptional() @IsString() description?: string;
}

export class SetPlanFeatureLimitDto {
  @IsString() featureCode: string;
  @IsOptional() @IsInt() includedLimit?: number; // omit for unlimited
  @IsOptional() @IsNumber() overageUnitPrice?: number;
}

export class SubscribeDto {
  @IsString() planCode: string;
  @IsOptional() @IsInt() @Min(1) periodMonths?: number;
}

export class RecordUsageDto {
  @IsString() featureCode: string;
  @IsNumber() @Min(0) amount: number;
}

export class GenerateInvoiceDto {
  @IsOptional() @IsNumber() taxRatePercent?: number;
  @IsOptional() @IsString() couponCode?: string;
}

export class CreateCouponDto {
  @IsString() @MinLength(3) code: string;
  @IsEnum(DiscountType) discountType: DiscountType;
  @IsNumber() discountValue: number;
  @IsOptional() @IsInt() maxRedemptions?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
}

export class ValidateCouponDto {
  @IsString() code: string;
  @IsNumber() subtotal: number;
}

export class CreateWebhookEndpointDto {
  @IsString() url: string;
  @IsArray() @IsEnum(WebhookEventType, { each: true }) events: WebhookEventType[];
}

export class TokenWalletTxDto {
  @IsNumber() amount: number;
  @IsString() reason: string;
}

export class CreateAddOnDto {
  @IsString() @MinLength(2) code: string;
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() price: number;
  @IsOptional() @IsString() featureCode?: string;
  @IsOptional() @IsNumber() extraLimitAmount?: number;
}

export class ActivateAddOnDto {
  @IsString() addOnCode: string;
}
