import { Module } from '@nestjs/common';
import { CompanyDictionaryService } from './company-dictionary.service';
import { CompanyDictionaryController } from './company-dictionary.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [CompanyDictionaryController],
  providers: [CompanyDictionaryService],
  exports: [CompanyDictionaryService],
})
export class CompanyDictionaryModule {}
