import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TaskEngineModule } from '../task-engine/task-engine.module';

@Module({
  imports: [AuditLogsModule, TaskEngineModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
