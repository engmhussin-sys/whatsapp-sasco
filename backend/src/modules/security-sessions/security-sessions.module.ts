import { Module } from '@nestjs/common';
import { SecuritySessionsService } from './security-sessions.service';
import { SecuritySessionsController } from './security-sessions.controller';

@Module({
  controllers: [SecuritySessionsController],
  providers: [SecuritySessionsService],
})
export class SecuritySessionsModule {}
