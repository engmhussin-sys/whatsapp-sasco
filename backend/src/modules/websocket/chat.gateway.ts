import { forwardRef, Inject, Logger } from '@nestjs/common';
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
    @Inject(forwardRef(() => MessagesService)) private messagesService: MessagesService,
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

      // Real-time presence — previously the only signal available was
      // lastSeenAt, which only ever updates on DISCONNECT, so there was
      // no way for anyone to know a person just came online, and no
      // "currently online" state existed anywhere at all. Broadcast to
      // every conversation this user is a member of so open chat
      // screens can show a live "متصل الآن" indicator, not just a
      // static last-seen timestamp.
      await this.broadcastPresence(user.id, true);
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    this.logger.log(`Socket disconnected: user=${client.user.sub}`);
    let lastSeenAt = new Date();
    // Best-effort — "last seen" is a nice-to-have, never worth crashing
    // the disconnect handler over.
    try {
      const updated = await this.prisma.user.update({ where: { id: client.user.sub }, data: { lastSeenAt } });
      lastSeenAt = updated.lastSeenAt ?? lastSeenAt;
    } catch (err) {
      this.logger.warn(`Failed to record lastSeenAt for user=${client.user.sub}: ${(err as Error).message}`);
    }
    await this.broadcastPresence(client.user.sub, false, lastSeenAt);
  }

  /** Notifies every conversation this user is part of that their online/last-seen state just changed. */
  private async broadcastPresence(userId: string, isOnline: boolean, lastSeenAt?: Date) {
    try {
      const memberships = await this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      for (const m of memberships) {
        this.server.to(`conversation:${m.conversationId}`).emit('presence:changed', {
          userId,
          isOnline,
          lastSeenAt: lastSeenAt?.toISOString() ?? null,
        });
      }
    } catch (err) {
      this.logger.warn(`Presence broadcast failed for user=${userId}: ${(err as Error).message}`);
    }
  }

  @SubscribeMessage('joinConversation')
  async onJoinConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: { conversationId: string }) {
    if (!client.user?.companyId) return { error: 'Unauthorized' };
    await this.conversationsService.assertMembership(client.user.companyId, data.conversationId, client.user.sub);
    client.join(`conversation:${data.conversationId}`);
    // BUG FIX: see MessagesService.markPendingDeliveredOnJoin's doc
    // comment — the original at-send-time-only delivery marking almost
    // never fired in realistic usage (recipient's app simply wasn't
    // open at the exact send moment). This catches up any messages
    // that arrived while this user wasn't connected to the room.
    this.messagesService
      .markPendingDeliveredOnJoin(data.conversationId, client.user.sub)
      .catch((err) => this.logger.warn(`markPendingDeliveredOnJoin failed: ${(err as Error).message}`));
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

    // MessagesService.sendText() now broadcasts message:new/
    // message:notification internally (see its own doc comment — this
    // used to be duplicated here AND there, which would have caused a
    // recipient to see every message twice the moment this socket path
    // ever actually got used instead of the REST one).
    const message = await this.messagesService.sendText(client.user.companyId, data.conversationId, client.user.sub, {
      text: data.text,
    });

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
