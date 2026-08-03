import { Module } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatGatewayModule } from '../websocket/chat-gateway.module';

@Module({
  imports: [NotificationsModule, ChatGatewayModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
