import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddOnsService } from '../../../src/modules/billing-engine/add-ons.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('AddOnsService', () => {
  let service: AddOnsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      billingFeature: { findUnique: jest.fn() },
      addOn: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
      companyAddOn: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      companySubscription: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AddOnsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AddOnsService);
  });

  describe('create()', () => {
    it('creates an add-on with no linked feature when featureCode is omitted', async () => {
      prisma.addOn.create.mockResolvedValue({ id: 'addon-1' });
      await service.create({ code: 'extra_storage', name: 'Extra 10GB', price: 25 });
      expect(prisma.billingFeature.findUnique).not.toHaveBeenCalled();
      expect(prisma.addOn.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ featureId: undefined }) }));
    });

    it('throws when featureCode is provided but does not exist', async () => {
      prisma.billingFeature.findUnique.mockResolvedValue(null);
      await expect(service.create({ code: 'x', name: 'x', price: 1, featureCode: 'nonexistent' })).rejects.toThrow(NotFoundException);
    });

    it('resolves the featureId when a valid featureCode is provided', async () => {
      prisma.billingFeature.findUnique.mockResolvedValue({ id: 'feature-1' });
      prisma.addOn.create.mockResolvedValue({ id: 'addon-1' });
      await service.create({ code: 'extra_tokens', name: '+500 tokens', price: 10, featureCode: 'monthly_ai_tokens', extraLimitAmount: 500 });
      expect(prisma.addOn.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ featureId: 'feature-1', extraLimitAmount: 500 }) }));
    });
  });

  describe('activateForCompany()', () => {
    it('throws for an unknown or inactive add-on code', async () => {
      prisma.addOn.findUnique.mockResolvedValue(null);
      await expect(service.activateForCompany('company-A', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('links the activation to the company subscription when one exists', async () => {
      prisma.addOn.findUnique.mockResolvedValue({ id: 'addon-1', isActive: true });
      prisma.companySubscription.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.companyAddOn.create.mockResolvedValue({});

      await service.activateForCompany('company-A', 'extra_storage');

      expect(prisma.companyAddOn.create).toHaveBeenCalledWith({
        data: { companyId: 'company-A', addOnId: 'addon-1', subscriptionId: 'sub-1' },
      });
    });
  });

  describe('deactivateForCompany()', () => {
    it('throws when the activation does not belong to this company', async () => {
      prisma.companyAddOn.findFirst.mockResolvedValue(null);
      await expect(service.deactivateForCompany('company-A', 'ca-1')).rejects.toThrow(NotFoundException);
      expect(prisma.companyAddOn.update).not.toHaveBeenCalled();
    });

    it('marks the activation inactive with an expiresAt timestamp', async () => {
      prisma.companyAddOn.findFirst.mockResolvedValue({ id: 'ca-1', companyId: 'company-A' });
      prisma.companyAddOn.update.mockResolvedValue({});

      await service.deactivateForCompany('company-A', 'ca-1');

      expect(prisma.companyAddOn.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ca-1' }, data: expect.objectContaining({ isActive: false, expiresAt: expect.any(Date) }) }),
      );
    });
  });
});
