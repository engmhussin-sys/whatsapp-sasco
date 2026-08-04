import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { StorageModule } from '../../common/storage/storage.module';
import { TranslationEngineModule } from '../translation-engine/translation-engine.module';
import { BillingEngineModule } from '../billing-engine/billing-engine.module';
import { VoiceProcessingModule } from '../voice-processing/voice-processing.module';

@Module({
  imports: [ConversationsModule, StorageModule, TranslationEngineModule, BillingEngineModule, VoiceProcessingModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
