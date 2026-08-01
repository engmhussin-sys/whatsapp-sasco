import { Module } from '@nestjs/common';
import { ChatPolicyService } from './chat-policy.service';
import { ChatPolicyController } from './chat-policy.controller';
import { DirectoryModule } from '../directory/directory.module';

@Module({
  imports: [DirectoryModule],
  controllers: [ChatPolicyController],
  providers: [ChatPolicyService],
  exports: [ChatPolicyService],
})
export class ChatPolicyModule {}
