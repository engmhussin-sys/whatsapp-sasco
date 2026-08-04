import { Module } from '@nestjs/common';
import { VoiceProcessingService } from './voice-processing.service';
import {
  SPEECH_TO_TEXT_PROVIDER,
  TRANSLATION_PROVIDER,
  TEXT_TO_SPEECH_PROVIDER,
} from './voice-processing.interfaces';
import { NoopTextToSpeechProvider } from './providers/noop-voice-processing.providers';
import { WhisperSpeechToTextProvider } from './providers/whisper-speech-to-text.provider';
import { TranslationEngineBridgeProvider } from './providers/translation-engine-bridge.provider';
import { NoopOcrProvider, NoopImageAnalysisProvider } from './providers/noop-ocr-image.providers';
import { OCR_PROVIDER, IMAGE_ANALYSIS_PROVIDER } from './ocr-image.interfaces';
import { CompanyDictionaryModule } from '../company-dictionary/company-dictionary.module';
import { TranslationEngineModule } from '../translation-engine/translation-engine.module';

/**
 * Phase 2 activation: Speech-to-Text (Whisper) and translation (bridged
 * to the existing TranslationEngineService, not a second parallel
 * implementation) are now real. Text-to-Speech and OCR/image-analysis
 * remain no-op stubs — genuinely out of scope for this activation; swap
 * them the same one-line way whenever they're built for real.
 */
@Module({
  imports: [CompanyDictionaryModule, TranslationEngineModule],
  providers: [
    VoiceProcessingService,
    WhisperSpeechToTextProvider,
    TranslationEngineBridgeProvider,
    { provide: SPEECH_TO_TEXT_PROVIDER, useExisting: WhisperSpeechToTextProvider },
    { provide: TRANSLATION_PROVIDER, useExisting: TranslationEngineBridgeProvider },
    { provide: TEXT_TO_SPEECH_PROVIDER, useClass: NoopTextToSpeechProvider },
    { provide: OCR_PROVIDER, useClass: NoopOcrProvider },
    { provide: IMAGE_ANALYSIS_PROVIDER, useClass: NoopImageAnalysisProvider },
  ],
  exports: [VoiceProcessingService, OCR_PROVIDER, IMAGE_ANALYSIS_PROVIDER],
})
export class VoiceProcessingModule {}
