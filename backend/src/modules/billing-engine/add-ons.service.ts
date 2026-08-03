import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateAddOnInput {
  code: string;
  name: string;
  description?: string;
  price: number;
  featureCode?: string;
  extraLimitAmount?: number;
}

@Injectable()
export class AddOnsService {
  constructor(private prisma: PrismaService) {}

  listCatalog() {
    return this.prisma.addOn.findMany({ where: { isActive: true }, include: { feature: true }, orderBy: { name: 'asc' } });
  }

  async create(input: CreateAddOnInput) {
    let featureId: string | undefined;
    if (input.featureCode) {
      const feature = await this.prisma.billingFeature.findUnique({ where: { code: input.featureCode } });
      if (!feature) throw new NotFoundException(`Unknown billing feature code: ${input.featureCode}`);
      featureId = feature.id;
    }

    return this.prisma.addOn.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        price: input.price,
        featureId,
        extraLimitAmount: input.extraLimitAmount,
      },
    });
  }

  listForCompany(companyId: string) {
    return this.prisma.companyAddOn.findMany({ where: { companyId, isActive: true }, include: { addOn: true } });
  }

  async activateForCompany(companyId: string, addOnCode: string) {
    const addOn = await this.prisma.addOn.findUnique({ where: { code: addOnCode } });
    if (!addOn || !addOn.isActive) throw new NotFoundException(`Add-on "${addOnCode}" not found or inactive`);

    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });

    return this.prisma.companyAddOn.create({
      data: { companyId, addOnId: addOn.id, subscriptionId: subscription?.id },
    });
  }

  async deactivateForCompany(companyId: string, companyAddOnId: string) {
    const companyAddOn = await this.prisma.companyAddOn.findFirst({ where: { id: companyAddOnId, companyId } });
    if (!companyAddOn) throw new NotFoundException('Add-on activation not found for this company');

    return this.prisma.companyAddOn.update({ where: { id: companyAddOnId }, data: { isActive: false, expiresAt: new Date() } });
  }
}
