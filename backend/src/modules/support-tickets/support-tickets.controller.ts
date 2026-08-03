import { Body, Controller, Get, Param, Post, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole, TicketStatus } from '@prisma/client';
import { SupportTicketsService } from './support-tickets.service';
import { CreateTicketDto, AddTicketMessageDto, UpdateTicketStatusDto } from './dto/support-tickets.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

/** Company-scoped: a company's own support tickets. */
@ApiTags('support-tickets')
@ApiBearerAuth()
@Controller('companies/:companyId/support-tickets')
export class SupportTicketsController {
  constructor(private tickets: SupportTicketsService) {}

  @Post()
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(companyId, user.sub, dto.subject, dto.body, dto.priority);
  }

  @Get()
  list(@TenantId() companyId: string) {
    return this.tickets.listForCompany(companyId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tickets.getOne(id);
  }

  @Post(':id/messages')
  addMessage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AddTicketMessageDto) {
    return this.tickets.addMessage(id, user.sub, dto.body);
  }
}

/** Platform-wide: Super Admin's support queue across every company. */
@ApiTags('support-tickets')
@ApiBearerAuth()
@Controller('support-tickets')
export class PlatformSupportTicketsController {
  constructor(private tickets: SupportTicketsService) {}

  @Get()
  @Roles(SystemRole.SUPER_ADMIN)
  listAll(@Query('status') status?: TicketStatus) {
    return this.tickets.listAllPlatform(status);
  }

  @Get(':id')
  @Roles(SystemRole.SUPER_ADMIN)
  get(@Param('id') id: string) {
    return this.tickets.getOne(id);
  }

  @Post(':id/messages')
  @Roles(SystemRole.SUPER_ADMIN)
  addMessage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AddTicketMessageDto) {
    return this.tickets.addMessage(id, user.sub, dto.body);
  }

  @Patch(':id/status')
  @Roles(SystemRole.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.tickets.updateStatus(id, dto.status);
  }
}
