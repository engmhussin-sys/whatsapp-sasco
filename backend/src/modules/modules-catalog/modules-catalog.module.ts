import { Module } from '@nestjs/common';
import { ModulesCatalogService } from './modules-catalog.service';
import { ModulesCatalogController } from './modules-catalog.controller';

@Module({
  controllers: [ModulesCatalogController],
  providers: [ModulesCatalogService],
  exports: [ModulesCatalogService],
})
export class ModulesCatalogModule {}
