import { Test } from '@nestjs/testing';
import { ModuleCode } from '@prisma/client';
import { ModulesCatalogService } from '../../../src/modules/modules-catalog/modules-catalog.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { MODULE_CATALOG } from '../../../src/modules/modules-catalog/module-catalog.data';

describe('ModulesCatalogService', () => {
  let service: ModulesCatalogService;
  let prisma: any;

  const companyId = 'company-A';

  beforeEach(async () => {
    prisma = {
      companyModule: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ModulesCatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ModulesCatalogService);
  });

  describe('getCatalog', () => {
    it('returns the full static catalog unchanged', () => {
      expect(service.getCatalog()).toBe(MODULE_CATALOG);
    });
  });

  describe('getCompanyModules', () => {
    it('merges per-company activation onto every catalog entry, defaulting to inactive when no row exists', async () => {
      prisma.companyModule.findMany.mockResolvedValue([{ moduleCode: ModuleCode.CHAT, isActive: true }]);

      const result = await service.getCompanyModules(companyId);

      const chat = result.find((m) => m.code === ModuleCode.CHAT);
      const attendance = result.find((m) => m.code === ModuleCode.ATTENDANCE);
      expect(chat!.isActive).toBe(true);
      expect(attendance!.isActive).toBe(false); // no CompanyModule row at all -> inactive, not a crash
      expect(result.length).toBe(MODULE_CATALOG.length);
    });

    it('reports a row explicitly marked isActive=false as inactive (not just "missing = inactive")', async () => {
      prisma.companyModule.findMany.mockResolvedValue([{ moduleCode: ModuleCode.SAFETY, isActive: false }]);

      const result = await service.getCompanyModules(companyId);

      expect(result.find((m) => m.code === ModuleCode.SAFETY)!.isActive).toBe(false);
    });
  });

  describe('activate', () => {
    it('upserts an active row, recording who activated it', async () => {
      await service.activate(companyId, ModuleCode.SAFETY, 'admin-1');

      expect(prisma.companyModule.upsert).toHaveBeenCalledWith({
        where: { companyId_moduleCode: { companyId, moduleCode: ModuleCode.SAFETY } },
        create: { companyId, moduleCode: ModuleCode.SAFETY, isActive: true, activatedById: 'admin-1' },
        update: { isActive: true, activatedAt: expect.any(Date), activatedById: 'admin-1' },
      });
    });

    it('rejects an unknown module code rather than silently creating a row for it', async () => {
      await expect(service.activate(companyId, 'NOT_A_REAL_MODULE' as ModuleCode, 'admin-1')).rejects.toThrow(
        'Unknown module code',
      );
      expect(prisma.companyModule.upsert).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('flips isActive to false for an existing row', async () => {
      prisma.companyModule.findUnique.mockResolvedValue({ companyId, moduleCode: ModuleCode.CHAT, isActive: true });

      await service.deactivate(companyId, ModuleCode.CHAT);

      expect(prisma.companyModule.update).toHaveBeenCalledWith({
        where: { companyId_moduleCode: { companyId, moduleCode: ModuleCode.CHAT } },
        data: { isActive: false },
      });
    });

    it('rejects deactivating a module that was never activated for this company', async () => {
      prisma.companyModule.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(companyId, ModuleCode.CHAT)).rejects.toThrow(
        'This module was never activated for this company',
      );
    });
  });

  describe('isActive', () => {
    it('returns true only for an active row', async () => {
      prisma.companyModule.findUnique.mockResolvedValue({ isActive: true });
      expect(await service.isActive(companyId, ModuleCode.CHAT)).toBe(true);
    });

    it('returns false when no row exists at all', async () => {
      prisma.companyModule.findUnique.mockResolvedValue(null);
      expect(await service.isActive(companyId, ModuleCode.CHAT)).toBe(false);
    });
  });
});
