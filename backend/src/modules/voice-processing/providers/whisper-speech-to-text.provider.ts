import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SpeechToTextProvider, TranscriptionResult } from '../voice-processing.interfaces';
import { LanguageDetectorService } from '../../translation-engine/language-detector.service';

const FETCH_TIMEOUT_MS = 20_000;

/**
 * Real implementation — calls OpenAI's Whisper transcription endpoint
 * (POST /v1/audio/transcriptions). Uses the SAME OPENAI_API_KEY env var
 * already configured and confirmed working for text translation (see
 * prisma/seed.ts's platform-default OpenAI TranslationProviderConfig,
 * apiKeyEnvVar: 'OPENAI_API_KEY') — no separate credential to set up.
 *
 * BUG FIX (confirmed via a real production log: a voice message's
 * transcription silently produced NEITHER a success nor any error log,
 * for 10+ minutes): neither fetch() call here had a timeout. Node's
 * built-in fetch has no default timeout — if either OpenAI's endpoint or
 * a network egress rule silently drops packets instead of actively
 * refusing the connection, the request hangs forever, the fire-and-
 * forget promise in MessagesService.sendVoice() never settles, and its
 * .catch() log line never fires — exactly a silent, undiagnosable hang.
 * AbortSignal.timeout() forces both requests to fail loudly within a
 * bounded time either way, and this now logs each individual step so
 * the NEXT attempt's Railway log shows exactly where things stand.
 *
 * Whisper's own `language` response field is the model's BEST GUESS at
 * spoken language and can be unreliable on short/accented/mixed-language
 * clips. Rather than trust it blindly, the transcribed TEXT is re-run
 * through the same script-based LanguageDetectorService already used for
 * text messages, keeping voice and text originalLang detection
 * consistent and equally trustworthy.
 */
@Injectable()
export class WhisperSpeechToTextProvider implements SpeechToTextProvider {
  private readonly logger = new Logger(WhisperSpeechToTextProvider.name);

  constructor(private languageDetector: LanguageDetectorService) {}

  async transcribe(input: { audioUrl?: string; audioBuffer?: Buffer; mimeType: string }): Promise<TranscriptionResult> {
    this.logger.log(`transcribe() starting for ${input.audioUrl ?? '(in-memory buffer)'}`);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not set — cannot transcribe');
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
      let audioResponse: Response;
      try {
        audioResponse = await fetch(input.audioUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (err) {
        this.logger.error(`Fetching audio for transcription timed out or failed: ${(err as Error).message}`);
        throw new ServiceUnavailableException('Could not fetch audio for transcription (timed out or network error)');
      }
      if (!audioResponse.ok) {
        this.logger.error(`Fetching audio for transcription returned HTTP ${audioResponse.status}`);
        throw new ServiceUnavailableException(`Could not fetch audio for transcription: HTTP ${audioResponse.status}`);
      }
      audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      this.logger.log(`Audio fetched (${audioBuffer.length} bytes) — calling Whisper`);
    }

    const extension = input.mimeType.includes('webm') ? 'webm' : input.mimeType.includes('mp4') ? 'm4a' : 'ogg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audioBuffer)], { type: input.mimeType }), `voice.${extension}`);
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      // Covers both an actual network failure AND AbortSignal.timeout()
      // firing (surfaces as a DOMException named "TimeoutError" /
      // "AbortError" depending on the Node version) — either way, this
      // is the single most likely explanation for the exact symptom
      // that was reported (no success, no error, forever): the request
      // hung with no timeout at all before this fix.
      this.logger.error(`Whisper request timed out or failed to connect: ${(err as Error).name} — ${(err as Error).message}`);
      throw new ServiceUnavailableException('Whisper transcription request timed out or failed to connect');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Whisper transcription request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Whisper transcription request failed');
    }

    const data = (await response.json()) as { text: string };
    const text = data.text?.trim() ?? '';
    const detection = this.languageDetector.detect(text);
    this.logger.log(`Transcription succeeded: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}" (detected ${detection.languageCode})`);

    return { text, languageCode: detection.languageCode, confidence: detection.confidence };
  }
}
