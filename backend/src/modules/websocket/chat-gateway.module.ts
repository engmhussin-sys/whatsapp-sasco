import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';

// @Global() — CRITICAL and deliberate, not a style choice. MessagesService
// needs to inject ChatGateway (see the "ROOT CAUSE" comment on
// MessagesService.sendText — REST-sent messages were never broadcast
// over the socket at all). Explicitly importing ChatGatewayModule into
// MessagesModule would recreate the exact circular dependency chain
// (ConversationsModule <-> NotificationsModule <-> ChatGatewayModule <->
// MessagesModule) that a real boot crash already proved NestJS cannot
// resolve here even with forwardRef() at every edge. @Global() makes
// ChatGateway visible for injection everywhere without adding a single
// new module-graph edge — MessagesModule's own imports array is
// completely untouched by this change.
@Global()
@Module({
  imports: [JwtModule.register({}), MessagesModule, ConversationsModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatGatewayModule {}
