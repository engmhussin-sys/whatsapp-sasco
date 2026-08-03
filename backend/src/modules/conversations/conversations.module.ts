import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { ChatPolicyModule } from '../chat-policy/chat-policy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ChatPolicyModule, NotificationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
