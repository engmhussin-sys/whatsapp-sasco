import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { BroadcastService } from './broadcast.service';
import { SendBroadcastDto } from './dto/broadcast.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('broadcast')
@ApiBearerAuth()
@Controller('companies/:companyId/broadcast')
export class BroadcastController {
  constructor(private broadcast: BroadcastService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  send(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: SendBroadcastDto) {
    return this.broadcast.send(companyId, user.sub, dto.text, dto.sourceLanguage, dto.urgent ?? false);
  }
}
