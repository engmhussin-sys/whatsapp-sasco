import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatGateway } from '../websocket/chat.gateway';

export interface CreateNotificationInput {
  userId: string;
  companyId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * NOTIFICATION CENTER — in-app notifications with real-time delivery.
 * Reuses the ChatGateway's existing per-user Socket.io room
 * (`user:{userId}`, already joined by every connected client for
 * direct-message delivery) rather than standing up a second WebSocket
 * server — one real-time channel per user, shared by chat and
 * notifications alike.
 *
 * `ChatGateway` is `@Optional()` so this service can still be used
 * (creation/listing/read-state all work via plain HTTP) in contexts
 * where the WebSocket gateway isn't wired — real-time push is a
 * best-effort enhancement on top of a fully functional REST-only base,
 * not a hard dependency.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private chatGateway?: ChatGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });

    try {
      this.chatGateway?.server?.to(`user:${input.userId}`).emit('notification:new', notification);
    } catch (err) {
      // Real-time push is best-effort — the notification itself was
      // already persisted and will show up on next poll/page load
      // regardless of whether the socket emit succeeded.
      this.logger.warn(`Real-time push failed for notification ${notification.id}: ${(err as Error).message}`);
    }

    return notification;
  }

  async listForUser(userId: string, options: { skip?: number; take?: number; unreadOnly?: boolean } = {}) {
    const where = { userId, ...(options.unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 30,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }
}
