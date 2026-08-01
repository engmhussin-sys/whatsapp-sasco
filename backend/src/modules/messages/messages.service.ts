import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus, MessageType, AttachmentKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { STORAGE_PROVIDER, StorageProvider } from '../../common/storage/storage.interface';
import { SendTextMessageDto } from './dto/messages.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async sendText(companyId: string, conversationId: string, senderId: string, dto: SendTextMessageDto) {
    await this.conversationsService.assertMembership(companyId, conversationId, senderId);
    await this.conversationsService.assertCanPost(companyId, conversationId, senderId);

    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });

    const message = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId,
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          originalText: dto.text,
          originalLang: dto.originalLang ?? sender?.preferredLanguage ?? 'en',
        },
      });

      const otherMembers = await tx.conversationMember.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      });
      if (otherMembers.length) {
        await tx.messageReceipt.createMany({
          data: otherMembers.map((m: { userId: string }) => ({ messageId: created.id, userId: m.userId, status: MessageStatus.SENT })),
        });
      }

      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

      return created;
    });

    return this.findOne(companyId, senderId, message.id);
  }

  /** Voice message: audio buffer is uploaded, stored, and referenced as the message's primary clip. */
  async sendVoice(
    companyId: string,
    conversationId: string,
    senderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    durationMs?: number,
  ) {
    await this.conversationsService.assertMembership(companyId, conversationId, senderId);
    await this.conversationsService.assertCanPost(companyId, conversationId, senderId);

    const stored = await this.storage.save(file.buffer, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: `voice-messages/${companyId}`,
    });

    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });

    const message = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId,
          type: MessageType.VOICE,
          status: MessageStatus.SENT,
          audioUrl: stored.url,
          audioDurationMs: durationMs,
          originalLang: sender?.preferredLanguage ?? 'en',
          // originalText intentionally null here — Phase 2's Speech-to-Text
          // service (see modules/voice-processing) will populate a
          // transcription asynchronously once implemented.
        },
      });

      const otherMembers = await tx.conversationMember.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      });
      if (otherMembers.length) {
        await tx.messageReceipt.createMany({
          data: otherMembers.map((m: { userId: string }) => ({ messageId: created.id, userId: m.userId, status: MessageStatus.SENT })),
        });
      }

      return created;
    });

    return this.findOne(companyId, senderId, message.id);
  }

  async addAttachment(
    companyId: string,
    conversationId: string,
    messageId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    kind: AttachmentKind,
  ) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId },
    });
    if (!message) throw new NotFoundException('Message not found or you are not its sender');

    const stored = await this.storage.save(file.buffer, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: `message-attachments/${companyId}`,
    });

    return this.prisma.messageAttachment.create({
      data: {
        messageId,
        kind,
        url: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
      },
    });
  }

  async list(companyId: string, conversationId: string, userId: string, cursor?: string, take = 30) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        attachments: true,
        receipts: true,
      },
    });
  }

  async findOne(companyId: string, userId: string, id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        attachments: true,
        receipts: true,
        conversation: { select: { id: true, companyId: true } },
      },
    });
    if (!message || message.conversation.companyId !== companyId) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  /** Called by ChatGateway when a message is pushed to a connected recipient. */
  async markDelivered(messageId: string, userId: string) {
    return this.prisma.messageReceipt.updateMany({
      where: { messageId, userId, status: MessageStatus.SENT },
      data: { status: MessageStatus.DELIVERED },
    });
  }

  /** Marks every unread message in a conversation up to `upToMessageId` (or the latest) as READ for this user. */
  async markRead(companyId: string, conversationId: string, userId: string, upToMessageId?: string) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    // SECURITY (defense in depth): upToMessageId is client-supplied. Even
    // though the subsequent updateMany is already confined to this
    // conversationId (so no cross-tenant row could ever be mutated), we
    // additionally verify the cutoff message itself belongs to THIS
    // conversation before trusting its timestamp — otherwise a caller
    // could reference an arbitrary message id from anywhere to skew the
    // cutoff used for their own (authorized) conversation.
    const cutoff = upToMessageId
      ? await this.prisma.message.findFirst({
          where: { id: upToMessageId, conversationId },
          select: { createdAt: true },
        })
      : null;
    if (upToMessageId && !cutoff) {
      throw new NotFoundException('upToMessageId does not belong to this conversation');
    }

    const messageWhere = {
      conversationId,
      ...(cutoff ? { createdAt: { lte: cutoff.createdAt } } : {}),
    };

    await this.prisma.messageReceipt.updateMany({
      where: { userId, status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] }, message: messageWhere },
      data: { status: MessageStatus.READ },
    });

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }
}
