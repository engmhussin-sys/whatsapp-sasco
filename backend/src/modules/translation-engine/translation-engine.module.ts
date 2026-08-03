import { Module } from '@nestjs/common';
import { TranslationEngineService } from './translation-engine.service';
import { TranslationEngineController } from './translation-engine.controller';
import { TranslationProviderRegistry } from './translation-provider.registry';
import { TranslationProviderConfigService } from './translation-provider-config.service';
import { OpenAiTranslationProvider } from './providers/openai-translation.provider';
import { GoogleTranslationProvider } from './providers/google-translation.provider';
import { AzureTranslationProvider } from './providers/azure-translation.provider';
import { DeepLTranslationProvider } from './providers/deepl-translation.provider';
import { OfflineStubTranslationProvider } from './providers/offline-stub-translation.provider';
import { CompanyDictionaryModule } from '../company-dictionary/company-dictionary.module';
import { LanguageDetectorService } from './language-detector.service';

/**
 * STANDALONE, REUSABLE ENGINE — this module (and everything under
 * translation-engine/) imports nothing from any WorkForce-Connect-
 * specific module except CompanyDictionaryModule, which is itself
 * already generic (companyId + term pairs, no Message/Conversation
 * coupling). This module could be copy-pasted into a different product
 * unchanged, provided that product also brings a CompanyDictionaryModule
 * with the same shape (or the dependency is swapped for a no-op).
 */
@Module({
  imports: [CompanyDictionaryModule],
  controllers: [TranslationEngineController],
  providers: [
    OpenAiTranslationProvider,
    GoogleTranslationProvider,
    AzureTranslationProvider,
    DeepLTranslationProvider,
    OfflineStubTranslationProvider,
    TranslationProviderRegistry,
    TranslationProviderConfigService,
    LanguageDetectorService,
    TranslationEngineService,
  ],
  exports: [TranslationEngineService, TranslationProviderConfigService, LanguageDetectorService],
})
export class TranslationEngineModule {}
