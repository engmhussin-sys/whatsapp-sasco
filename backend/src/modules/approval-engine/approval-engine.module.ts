import { Module } from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalFlowsController, ApprovalsController } from './approval-engine.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ApprovalFlowsController, ApprovalsController],
  providers: [ApprovalEngineService],
  exports: [ApprovalEngineService],
})
export class ApprovalEngineModule {}
