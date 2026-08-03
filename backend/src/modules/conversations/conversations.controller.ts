import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/conversations.dto';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('companies/:companyId/conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(companyId, user.sub, dto);
  }

  @Get()
  findAll(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.conversationsService.findAllForUser(companyId, user.sub, includeArchived === 'true');
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findOne(companyId, user.sub, id);
  }

  /** Group 4 (WhatsApp parity): mute/unmute — per-member. */
  @Patch(':id/mute')
  setMuted(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('isMuted') isMuted: boolean,
  ) {
    return this.conversationsService.setMuted(companyId, id, user.sub, isMuted);
  }

  /** Group 4 (WhatsApp parity): archive/unarchive — per-member. */
  @Patch(':id/archive')
  setArchived(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('isArchived') isArchived: boolean,
  ) {
    return this.conversationsService.setArchived(companyId, id, user.sub, isArchived);
  }
}
