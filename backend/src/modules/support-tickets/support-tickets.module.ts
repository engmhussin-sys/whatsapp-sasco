import { Module } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController, PlatformSupportTicketsController } from './support-tickets.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SupportTicketsController, PlatformSupportTicketsController],
  providers: [SupportTicketsService],
})
export class SupportTicketsModule {}
