import { Module } from '@nestjs/common';
import { LanguagesService } from './languages.service';
import { LanguagesController, CompanyLanguagesController } from './languages.controller';

@Module({
  controllers: [LanguagesController, CompanyLanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
