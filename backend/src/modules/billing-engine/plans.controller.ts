import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { PlansService } from './plans.service';
import { CouponService } from './coupon.service';
import { AddOnsService } from './add-ons.service';
import { CreatePlanDto, CreateFeatureDto, SetPlanFeatureLimitDto, CreateCouponDto, CreateAddOnDto } from './dto/billing-engine.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Platform-level catalog (not scoped to a company — a BillingPlan is
 * shared across every company that subscribes to it). Only Super Admins
 * manage this; individual companies only ever READ plans (to choose one)
 * via GET, which is intentionally public within the authenticated app
 * (no tenant scoping needed since plans aren't tenant data).
 */
@ApiTags('billing-plans')
@ApiBearerAuth()
@Controller('billing/plans')
export class PlansController {
  constructor(
    private plans: PlansService,
    private coupons: CouponService,
    private addOns: AddOnsService,
  ) {}

  @Get()
  list() {
    return this.plans.listPlans();
  }

  @Get(':code')
  get(@Param('code') code: string) {
    return this.plans.getPlan(code);
  }

  @Post()
  @Roles(SystemRole.SUPER_ADMIN)
  create(@Body() dto: CreatePlanDto) {
    return this.plans.createPlan(dto);
  }

  @Get('features/all')
  listFeatures() {
    return this.plans.listFeatures();
  }

  @Post('features')
  @Roles(SystemRole.SUPER_ADMIN)
  createFeature(@Body() dto: CreateFeatureDto) {
    return this.plans.createFeature(dto);
  }

  @Post(':code/feature-limits')
  @Roles(SystemRole.SUPER_ADMIN)
  setFeatureLimit(@Param('code') code: string, @Body() dto: SetPlanFeatureLimitDto) {
    return this.plans.setPlanFeatureLimit(code, dto);
  }

  @Get('coupons/all')
  @Roles(SystemRole.SUPER_ADMIN)
  listCoupons() {
    return this.coupons.listAll();
  }

  @Post('coupons')
  @Roles(SystemRole.SUPER_ADMIN)
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Get('add-ons/all')
  listAddOns() {
    return this.addOns.listCatalog();
  }

  @Post('add-ons')
  @Roles(SystemRole.SUPER_ADMIN)
  createAddOn(@Body() dto: CreateAddOnDto) {
    return this.addOns.create(dto);
  }
}
