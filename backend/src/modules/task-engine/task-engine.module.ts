import { Module } from '@nestjs/common';
import { TaskEngineService } from './task-engine.service';
import { TaskTemplatesController, TasksController } from './task-engine.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ApprovalEngineModule } from '../approval-engine/approval-engine.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuditLogsModule, ApprovalEngineModule, StorageModule],
  controllers: [TaskTemplatesController, TasksController],
  providers: [TaskEngineService],
  exports: [TaskEngineService],
})
export class TaskEngineModule {}
