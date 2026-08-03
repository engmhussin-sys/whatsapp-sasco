import { Module } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { SafetyController } from './safety.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatGatewayModule } from '../websocket/chat-gateway.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [NotificationsModule, ChatGatewayModule, StorageModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
