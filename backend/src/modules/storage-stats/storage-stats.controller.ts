import { Controller, Get } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageStatsService } from './storage-stats.service';

@Roles(SystemRole.SUPER_ADMIN)
@Controller('platform-storage')
export class StorageStatsController {
  constructor(private storageStats: StorageStatsService) {}

  @Get()
  getSummary() {
    return this.storageStats.getPlatformSummary();
  }
}
