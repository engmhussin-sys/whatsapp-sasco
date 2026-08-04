import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { AuthModule } from '../auth/auth.module';
import { ModulesCatalogModule } from '../modules-catalog/modules-catalog.module';

@Module({
  imports: [AuthModule, ModulesCatalogModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
