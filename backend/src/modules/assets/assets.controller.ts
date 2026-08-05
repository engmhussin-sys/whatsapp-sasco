import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto, CreateVehicleDto, UpdateVehicleDto } from './dto/assets.dto';

@Controller('companies/:companyId')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  // ---- Generic assets ----
  @RequireModule(ModuleCode.ASSET_MANAGEMENT)
  @Post('assets')
  createAsset(@TenantId() companyId: string, @Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(companyId, dto);
  }

  @RequireModule(ModuleCode.ASSET_MANAGEMENT)
  @Get('assets')
  listAssets(@TenantId() companyId: string) {
    return this.assetsService.listAssets(companyId);
  }

  @RequireModule(ModuleCode.ASSET_MANAGEMENT)
  @Patch('assets/:assetId')
  updateAsset(@TenantId() companyId: string, @Param('assetId') assetId: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.updateAsset(companyId, assetId, dto);
  }

  // ---- Fleet vehicles ----
  @RequireModule(ModuleCode.FLEET_MANAGEMENT)
  @Post('vehicles')
  createVehicle(@TenantId() companyId: string, @Body() dto: CreateVehicleDto) {
    return this.assetsService.createVehicle(companyId, dto);
  }

  @RequireModule(ModuleCode.FLEET_MANAGEMENT)
  @Get('vehicles')
  listVehicles(@TenantId() companyId: string) {
    return this.assetsService.listVehicles(companyId);
  }

  @RequireModule(ModuleCode.FLEET_MANAGEMENT)
  @Get('vehicles/due-maintenance')
  vehiclesDueForMaintenance(@TenantId() companyId: string) {
    return this.assetsService.vehiclesDueForMaintenance(companyId);
  }

  @RequireModule(ModuleCode.FLEET_MANAGEMENT)
  @Patch('vehicles/:vehicleId')
  updateVehicle(@TenantId() companyId: string, @Param('vehicleId') vehicleId: string, @Body() dto: UpdateVehicleDto) {
    return this.assetsService.updateVehicle(companyId, vehicleId, dto);
  }
}
