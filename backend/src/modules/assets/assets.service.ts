import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto, CreateVehicleDto, UpdateVehicleDto } from './dto/assets.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  // ---- Generic assets (ModuleCode.ASSET_MANAGEMENT) ----

  createAsset(companyId: string, dto: CreateAssetDto) {
    return this.prisma.asset.create({ data: { companyId, ...dto } });
  }

  listAssets(companyId: string) {
    return this.prisma.asset.findMany({
      where: { companyId },
      include: { assignedToUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAsset(companyId: string, assetId: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.prisma.asset.update({ where: { id: assetId }, data: dto });
  }

  // ---- Fleet vehicles (ModuleCode.FLEET_MANAGEMENT) ----

  createVehicle(companyId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: { companyId, ...dto } });
  }

  listVehicles(companyId: string) {
    return this.prisma.vehicle.findMany({
      where: { companyId },
      include: { assignedToUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateVehicle(companyId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...dto,
        lastMaintenanceAt: dto.lastMaintenanceAt ? new Date(dto.lastMaintenanceAt) : undefined,
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : undefined,
      },
    });
  }

  /** Vehicles whose next scheduled maintenance is within 7 days —
   * honest, rule-based, matching the same "needs attention" pattern
   * already used in the platform dashboard's own analytics. */
  async vehiclesDueForMaintenance(companyId: string) {
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.vehicle.findMany({
      where: { companyId, nextMaintenanceAt: { lte: in7Days } },
      orderBy: { nextMaintenanceAt: 'asc' },
    });
  }
}
