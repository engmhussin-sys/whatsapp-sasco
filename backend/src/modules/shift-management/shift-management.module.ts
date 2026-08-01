import { Module } from '@nestjs/common';
import { ShiftManagementService } from './shift-management.service';
import { ShiftsController, ShiftLogsController } from './shift-management.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TaskEngineModule } from '../task-engine/task-engine.module';

@Module({
  imports: [AuditLogsModule, TaskEngineModule],
  controllers: [ShiftsController, ShiftLogsController],
  providers: [ShiftManagementService],
  exports: [ShiftManagementService],
})
export class ShiftManagementModule {}
