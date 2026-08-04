import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SpeechToTextProvider, TranscriptionResult } from '../voice-processing.interfaces';
import { LanguageDetectorService } from '../../translation-engine/language-detector.service';

/**
 * Real implementation — calls OpenAI's Whisper transcription endpoint
 * (POST /v1/audio/transcriptions). Uses the SAME OPENAI_API_KEY env var
 * already configured and confirmed working for text translation (see
 * prisma/seed.ts's platform-default OpenAI TranslationProviderConfig,
 * apiKeyEnvVar: 'OPENAI_API_KEY') — no separate credential to set up.
 *
 * Whisper's own `language` response field is the model's BEST GUESS at
 * spoken language and can be unreliable on short/accented/mixed-language
 * clips. Rather than trust it blindly (and risk silently mislabeling a
 * transcript the same way sender.preferredLanguage used to mislabel text
 * messages — see MessagesService.sendText's own bug-fix history), the
 * transcribed TEXT is re-run through the same script-based
 * LanguageDetectorService already used for text messages, keeping voice
 * and text originalLang detection consistent and equally trustworthy.
 */
@Injectable()
export class WhisperSpeechToTextProvider implements SpeechToTextProvider {
  private readonly logger = new Logger(WhisperSpeechToTextProvider.name);

  constructor(private languageDetector: LanguageDetectorService) {}

  async transcribe(input: { audioUrl?: string; audioBuffer?: Buffer; mimeType: string }): Promise<TranscriptionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Whisper speech-to-text is not configured (missing OPENAI_API_KEY)');
    }

    // LocalStorageProvider.save() always returns an absolute, publicly
    // fetchable URL (PUBLIC_BASE_URL + /uploads/...) — the exact same
    // URL mobile's audio player itself streams from — so fetching it
    // here to get a buffer works without needing direct filesystem
    // access, and stays storage-provider-agnostic (works the same if
    // this later moves to S3/similar).
    let audioBuffer = input.audioBuffer;
    if (!audioBuffer) {
      if (!input.audioUrl) {
        throw new ServiceUnavailableException('Whisper provider requires either an audio buffer or a fetchable audio URL');
      }
      const audioResponse = await fetch(input.audioUrl);
      if (!audioResponse.ok) {
        throw new ServiceUnavailableException(`Could not fetch audio for transcription: HTTP ${audioResponse.status}`);
      }
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    }

    const extension = input.mimeType.includes('webm') ? 'webm' : input.mimeType.includes('mp4') ? 'm4a' : 'ogg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audioBuffer)], { type: input.mimeType }), `voice.${extension}`);
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Whisper transcription request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Whisper transcription request failed');
    }

    const data = (await response.json()) as { text: string };
    const text = data.text?.trim() ?? '';
    const detection = this.languageDetector.detect(text);

    return { text, languageCode: detection.languageCode, confidence: detection.confidence };
  }
}
