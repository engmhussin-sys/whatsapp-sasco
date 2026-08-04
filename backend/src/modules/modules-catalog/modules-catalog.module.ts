import { Module } from '@nestjs/common';
import { ModulesCatalogService } from './modules-catalog.service';
import { ModulesCatalogController } from './modules-catalog.controller';
import { EntitlementsService } from './entitlements.service';

@Module({
  controllers: [ModulesCatalogController],
  providers: [ModulesCatalogService, EntitlementsService],
  exports: [ModulesCatalogService, EntitlementsService],
})
export class ModulesCatalogModule {}
