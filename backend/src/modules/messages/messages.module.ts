import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { StorageModule } from '../../common/storage/storage.module';
import { TranslationEngineModule } from '../translation-engine/translation-engine.module';

@Module({
  imports: [ConversationsModule, StorageModule, TranslationEngineModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
