import { Module } from '@nestjs/common';
import { FuelRequestsService } from './fuel-requests.service';
import { FuelRequestsController } from './fuel-requests.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ApprovalEngineModule } from '../approval-engine/approval-engine.module';

@Module({
  imports: [AuditLogsModule, ApprovalEngineModule],
  controllers: [FuelRequestsController],
  providers: [FuelRequestsService],
  exports: [FuelRequestsService],
})
export class FuelRequestsModule {}
