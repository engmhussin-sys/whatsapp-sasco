import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MODULE_CATALOG } from './module-catalog.data';

@Injectable()
export class ModulesCatalogService {
  constructor(private prisma: PrismaService) {}

  /** The full platform catalog — same for every company. */
  getCatalog() {
    return MODULE_CATALOG;
  }

  /** This company's per-module activation state, merged onto the catalog
   * so the marketplace UI can render everything in one call — active
   * modules, inactive-but-available ones, and roadmap ones — without a
   * second round trip. */
  async getCompanyModules(companyId: string) {
    const activations = await this.prisma.companyModule.findMany({ where: { companyId } });
    const activeByCode = new Map(activations.map((a: { moduleCode: ModuleCode; isActive: boolean }) => [a.moduleCode, a.isActive]));

    return MODULE_CATALOG.map((entry) => ({
      ...entry,
      isActive: activeByCode.get(entry.code) ?? false,
    }));
  }

  async activate(companyId: string, moduleCode: ModuleCode, activatedById: string) {
    const entry = MODULE_CATALOG.find((m) => m.code === moduleCode);
    if (!entry) throw new NotFoundException('Unknown module code');

    return this.prisma.companyModule.upsert({
      where: { companyId_moduleCode: { companyId, moduleCode } },
      create: { companyId, moduleCode, isActive: true, activatedById },
      update: { isActive: true, activatedAt: new Date(), activatedById },
    });
  }

  async deactivate(companyId: string, moduleCode: ModuleCode) {
    const existing = await this.prisma.companyModule.findUnique({
      where: { companyId_moduleCode: { companyId, moduleCode } },
    });
    if (!existing) throw new NotFoundException('This module was never activated for this company');

    return this.prisma.companyModule.update({
      where: { companyId_moduleCode: { companyId, moduleCode } },
      data: { isActive: false },
    });
  }

  /** Used by ModuleGuard indirectly is unnecessary (it queries Prisma
   * directly for latency reasons), but exposed here for anywhere else
   * in the app that needs a quick boolean check without a full HTTP
   * round trip (e.g. conditionally rendering something server-side). */
  async isActive(companyId: string, moduleCode: ModuleCode): Promise<boolean> {
    const activation = await this.prisma.companyModule.findUnique({
      where: { companyId_moduleCode: { companyId, moduleCode } },
    });
    return activation?.isActive ?? false;
  }
}
