import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController, PlatformReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController, PlatformReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
