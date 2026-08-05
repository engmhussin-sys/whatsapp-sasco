import { Module } from '@nestjs/common';
import { StorageStatsService } from './storage-stats.service';
import { StorageStatsController } from './storage-stats.controller';

@Module({
  controllers: [StorageStatsController],
  providers: [StorageStatsService],
})
export class StorageStatsModule {}
