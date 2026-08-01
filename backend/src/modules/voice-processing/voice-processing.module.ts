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

/**
 * Phase 2 migration: replace the three `useClass` stubs below with real
 * provider implementations (e.g. WhisperSttProvider, DeepLTranslationProvider,
 * ElevenLabsTtsProvider) that satisfy the same interfaces. No other module
 * needs to change.
 */
@Module({
  providers: [
    VoiceProcessingService,
    { provide: SPEECH_TO_TEXT_PROVIDER, useClass: NoopSpeechToTextProvider },
    { provide: TRANSLATION_PROVIDER, useClass: NoopTranslationProvider },
    { provide: TEXT_TO_SPEECH_PROVIDER, useClass: NoopTextToSpeechProvider },
  ],
  exports: [VoiceProcessingService],
})
export class VoiceProcessingModule {}
