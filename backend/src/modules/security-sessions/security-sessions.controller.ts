import { Controller, Get, Param, Patch } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SecuritySessionsService } from './security-sessions.service';

@Roles(SystemRole.SUPER_ADMIN)
@Controller('security/sessions')
export class SecuritySessionsController {
  constructor(private sessionsService: SecuritySessionsService) {}

  @Get()
  listActive() {
    return this.sessionsService.listActive();
  }

  @Patch(':sessionId/revoke')
  revoke(@Param('sessionId') sessionId: string) {
    return this.sessionsService.revoke(sessionId);
  }
}
