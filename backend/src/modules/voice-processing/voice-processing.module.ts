import { Module } from '@nestjs/common';
import { VoiceProcessingService } from './voice-processing.service';
import {
  SPEECH_TO_TEXT_PROVIDER,
  TRANSLATION_PROVIDER,
  TEXT_TO_SPEECH_PROVIDER,
} from './voice-processing.interfaces';
import {
  NoopSpeechToTextProvider,
  NoopTranslationProvider,
  NoopTextToSpeechProvider,
} from './providers/noop-voice-processing.providers';
import { NoopOcrProvider, NoopImageAnalysisProvider } from './providers/noop-ocr-image.providers';
import { OCR_PROVIDER, IMAGE_ANALYSIS_PROVIDER } from './ocr-image.interfaces';
import { CompanyDictionaryModule } from '../company-dictionary/company-dictionary.module';

/**
 * Phase 2 migration: replace the `useClass` stubs below with real
 * provider implementations (e.g. WhisperSttProvider, DeepLTranslationProvider,
 * ElevenLabsTtsProvider, GoogleVisionOcrProvider, ...) that satisfy the
 * same interfaces. No other module needs to change.
 */
@Module({
  imports: [CompanyDictionaryModule],
  providers: [
    VoiceProcessingService,
    { provide: SPEECH_TO_TEXT_PROVIDER, useClass: NoopSpeechToTextProvider },
    { provide: TRANSLATION_PROVIDER, useClass: NoopTranslationProvider },
    { provide: TEXT_TO_SPEECH_PROVIDER, useClass: NoopTextToSpeechProvider },
    { provide: OCR_PROVIDER, useClass: NoopOcrProvider },
    { provide: IMAGE_ANALYSIS_PROVIDER, useClass: NoopImageAnalysisProvider },
  ],
  exports: [VoiceProcessingService, OCR_PROVIDER, IMAGE_ANALYSIS_PROVIDER],
})
export class VoiceProcessingModule {}
