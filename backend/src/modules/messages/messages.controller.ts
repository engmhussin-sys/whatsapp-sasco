import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AttachmentKind } from '@prisma/client';
import { MessagesService } from './messages.service';
import { SendTextMessageDto, MarkReadDto, ReactToMessageDto, EditMessageDto } from './dto/messages.dto';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

const MAX_VOICE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

@ApiTags('messages')
@ApiBearerAuth()
@Controller('companies/:companyId/conversations/:conversationId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  list(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor: string,
    @Query('take') take: string,
  ) {
    return this.messagesService.list(companyId, conversationId, user.sub, cursor, take ? parseInt(take, 10) : undefined);
  }

  /** Group 4 (WhatsApp parity): search within THIS conversation only. */
  @Get('search')
  search(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    return this.messagesService.searchMessages(companyId, conversationId, user.sub, query ?? '');
  }

  @Post('text')
  sendText(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendTextMessageDto,
  ) {
    return this.messagesService.sendText(companyId, conversationId, user.sub, dto);
  }

  @Post('voice')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_VOICE_SIZE_BYTES } }))
  sendVoice(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('durationMs') durationMs?: string,
  ) {
    if (!file) throw new BadRequestException('audio file is required');
    if (!file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('Uploaded file must be an audio type');
    }
    return this.messagesService.sendVoice(
      companyId,
      conversationId,
      user.sub,
      file,
      durationMs ? parseInt(durationMs, 10) : undefined,
    );
  }

  /** A1 (real-user review, 2026-08-05): explicit retry button on the
   * mobile voice-transcription failure notice. */
  @Post(':messageId/retry-transcription')
  retryVoiceTranscription(
    @TenantId() companyId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.retryVoiceTranscription(companyId, messageId, user.sub);
  }

  @Post(':messageId/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } }))
  addAttachment(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kind: AttachmentKind,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.messagesService.addAttachment(companyId, conversationId, messageId, user.sub, file, kind ?? AttachmentKind.DOCUMENT);
  }

  @Post('read')
  markRead(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkReadDto,
  ) {
    return this.messagesService.markRead(companyId, conversationId, user.sub, dto.upToMessageId);
  }

  /** T5: backfills translations for OLDER messages after a user changes their language. */
  @Post('retranslate')
  retranslate(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('targetLanguage') targetLanguage: string,
  ) {
    return this.messagesService.retranslateConversation(companyId, conversationId, user.sub, targetLanguage);
  }

  /** Group 2 (WhatsApp parity): "Delete for everyone" — sender only. */
  @Delete(':messageId')
  deleteMessage(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.deleteMessage(companyId, conversationId, messageId, user.sub);
  }

  /** Group 3 (WhatsApp parity): toggle a reaction (same emoji again = remove). */
  @Post(':messageId/reactions')
  react(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReactToMessageDto,
  ) {
    return this.messagesService.reactToMessage(companyId, conversationId, messageId, user.sub, dto.emoji);
  }

  /** Group 3 (WhatsApp parity): edit a text message — sender only. */
  @Patch(':messageId')
  editMessage(
    @TenantId() companyId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(companyId, conversationId, messageId, user.sub, dto.text);
  }
}
