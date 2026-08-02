import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePlanDto, CreateFeatureDto, SetPlanFeatureLimitDto } from './dto/billing-engine.dto';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  createPlan(dto: CreatePlanDto) {
    return this.prisma.billingPlan.create({ data: dto });
  }

  listPlans() {
    return this.prisma.billingPlan.findMany({ include: { featureLimits: { include: { feature: true } } }, orderBy: { basePrice: 'asc' } });
  }

  async getPlan(planCode: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { code: planCode }, include: { featureLimits: { include: { feature: true } } } });
    if (!plan) throw new NotFoundException(`Plan "${planCode}" not found`);
    return plan;
  }

  createFeature(dto: CreateFeatureDto) {
    return this.prisma.billingFeature.create({ data: dto });
  }

  listFeatures() {
    return this.prisma.billingFeature.findMany({ orderBy: { code: 'asc' } });
  }

  async setPlanFeatureLimit(planCode: string, dto: SetPlanFeatureLimitDto) {
    const plan = await this.getPlan(planCode);
    const feature = await this.prisma.billingFeature.findUnique({ where: { code: dto.featureCode } });
    if (!feature) throw new NotFoundException(`Feature "${dto.featureCode}" not found`);

    return this.prisma.planFeatureLimit.upsert({
      where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
      create: { planId: plan.id, featureId: feature.id, includedLimit: dto.includedLimit ?? null, overageUnitPrice: dto.overageUnitPrice },
      update: { includedLimit: dto.includedLimit ?? null, overageUnitPrice: dto.overageUnitPrice },
    });
  }
}
