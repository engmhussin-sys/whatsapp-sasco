import { Controller, Get } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SystemHealthService } from './system-health.service';

@Controller('system-health')
export class SystemHealthController {
  constructor(private systemHealthService: SystemHealthService) {}

  @Roles(SystemRole.SUPER_ADMIN)
  @Get()
  getSnapshot() {
    return this.systemHealthService.getSnapshot();
  }
}
