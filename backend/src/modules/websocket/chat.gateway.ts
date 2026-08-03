import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

interface AuthedSocket extends Socket {
  user?: AuthenticatedUser;
}

/**
 * Real-time layer. Auth model: the client connects with the same JWT
 * access token used for REST calls (`socket.handshake.auth.token`),
 * verified manually here (Nest's HTTP guards do not run over WS
 * transport). Every event handler re-validates conversation membership
 * via ConversationsService before touching data — the socket connection
 * being authenticated is NOT sufficient authorization for any specific
 * conversation.
 *
 * Room strategy: each user joins a personal room `user:{userId}` (for
 * cross-device delivery) and a room per conversation `conversation:{id}`
 * (joined lazily on `joinConversation`) so message fan-out doesn't
 * require a DB round-trip per emit.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('ChatGateway');

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Missing auth token');

      const payload = this.jwt.verify<AuthenticatedUser>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('Invalid user');

      client.user = {
        sub: user.id,
        companyId: user.companyId,
        systemRole: user.systemRole,
        email: user.email,
      };
      client.join(`user:${user.id}`);
      this.logger.log(`Socket connected: user=${user.id}`);
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    this.logger.log(`Socket disconnected: user=${client.user.sub}`);
    // Best-effort — "last seen" is a nice-to-have, never worth crashing
    // the disconnect handler over.
    try {
      await this.prisma.user.update({ where: { id: client.user.sub }, data: { lastSeenAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Failed to record lastSeenAt for user=${client.user.sub}: ${(err as Error).message}`);
    }
  }

  @SubscribeMessage('joinConversation')
  async onJoinConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { conversationId: string }) {
    if (!client.user?.companyId) return { error: 'Unauthorized' };
    await this.conversationsService.assertMembership(client.user.companyId, data.conversationId, client.user.sub);
    client.join(`conversation:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('leaveConversation')
  onLeaveConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { conversationId: string }) {
    client.leave(`conversation:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; text: string },
  ) {
    if (!client.user?.companyId) return { error: 'Unauthorized' };

    const message = await this.messagesService.sendText(client.user.companyId, data.conversationId, client.user.sub, {
      text: data.text,
    });

    // Fan out to everyone currently subscribed to the conversation room,
    // and separately to each member's personal room so devices that
    // haven't opened this specific conversation still get a notification.
    this.server.to(`conversation:${data.conversationId}`).emit('message:new', message);

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: data.conversationId },
      select: { userId: true },
    });
    // Enriches the notification with a sender name + short preview —
    // cheap enough (one extra small query) that it's worth doing here
    // rather than shipping a bare {conversationId, messageId} payload
    // that would force every recipient device to do its own fetch just
    // to render a useful "Ahmed: hello" notification.
    const sender = await this.prisma.user.findUnique({ where: { id: client.user.sub }, select: { firstName: true, lastName: true } });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : '';
    const preview = data.text.length > 80 ? `${data.text.slice(0, 80)}…` : data.text;

    for (const m of members) {
      if (m.userId === client.user.sub) continue;
      this.server.to(`user:${m.userId}`).emit('message:notification', {
        conversationId: data.conversationId,
        messageId: message.id,
        senderName,
        preview,
      });
      // Best-effort: mark delivered if the recipient has an active socket in that room.
      const room = this.server.sockets.adapter.rooms.get(`conversation:${data.conversationId}`);
      if (room && room.size > 0) {
        await this.messagesService.markDelivered(message.id, m.userId);
      }
    }

    return { ok: true, messageId: message.id };
  }

  @SubscribeMessage('typing')
  onTyping(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { conversationId: string; isTyping: boolean }) {
    if (!client.user) return;
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      userId: client.user.sub,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('markRead')
  async onMarkRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; upToMessageId?: string },
  ) {
    if (!client.user?.companyId) return { error: 'Unauthorized' };
    await this.messagesService.markRead(client.user.companyId, data.conversationId, client.user.sub, data.upToMessageId);
    this.server.to(`conversation:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      userId: client.user.sub,
      upToMessageId: data.upToMessageId,
    });
    return { ok: true };
  }
}
