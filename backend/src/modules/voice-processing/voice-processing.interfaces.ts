/**
 * PHASE 2 READINESS LAYER
 * -----------------------------------------------------------------------
 * These interfaces define the contracts that real AI providers will
 * implement in Phase 2 (e.g. Whisper/Google STT, DeepL/Google Translate,
 * ElevenLabs/Azure TTS). Phase 1 ships NO-OP stub implementations so the
 * rest of the system (Messages, TaskResponses, dynamic form PHOTO/AUDIO
 * fields) can already be written against the final interface shape.
 *
 * Swapping a stub for a real provider in Phase 2 is a one-line change in
 * VoiceProcessingModule — no calling code changes.
 */

export interface TranscriptionResult {
  text: string;
  languageCode: string;
  confidence?: number;
}

export interface SpeechToTextProvider {
  /** Transcribes an audio buffer (or a URL to a previously-stored file) into text. */
  transcribe(input: { audioUrl?: string; audioBuffer?: Buffer; mimeType: string }): Promise<TranscriptionResult>;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  engine: string;
}

export interface TranslationProvider {
  /** Translates text from one language to another. */
  translate(input: { text: string; sourceLanguage: string; targetLanguage: string }): Promise<TranslationResult>;
  /** Translates one source text into several target languages in a single call, where the provider supports batching. */
  translateBatch(input: {
    text: string;
    sourceLanguage: string;
    targetLanguages: string[];
  }): Promise<TranslationResult[]>;
}

export interface SynthesisResult {
  audioUrl: string;
  durationMs?: number;
  voice?: string;
}

export interface TextToSpeechProvider {
  /** Synthesizes speech audio for the given text in the given language, returning a stored file URL. */
  synthesize(input: { text: string; languageCode: string; voice?: string }): Promise<SynthesisResult>;
}

export const SPEECH_TO_TEXT_PROVIDER = 'SPEECH_TO_TEXT_PROVIDER';
export const TRANSLATION_PROVIDER = 'TRANSLATION_PROVIDER';
export const TEXT_TO_SPEECH_PROVIDER = 'TEXT_TO_SPEECH_PROVIDER';
