import { Test } from '@nestjs/testing';
import { WhisperSpeechToTextProvider } from '../../../src/modules/voice-processing/providers/whisper-speech-to-text.provider';
import { LanguageDetectorService } from '../../../src/modules/translation-engine/language-detector.service';

describe('WhisperSpeechToTextProvider', () => {
  let provider: WhisperSpeechToTextProvider;
  let languageDetector: any;
  let originalFetch: typeof global.fetch;
  let originalKey: string | undefined;

  beforeEach(async () => {
    languageDetector = { detect: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [WhisperSpeechToTextProvider, { provide: LanguageDetectorService, useValue: languageDetector }],
    }).compile();
    provider = moduleRef.get(WhisperSpeechToTextProvider);

    originalFetch = global.fetch;
    originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('throws a clear error when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(provider.transcribe({ audioBuffer: Buffer.from('x'), mimeType: 'audio/webm' })).rejects.toThrow(
      'Whisper speech-to-text is not configured',
    );
  });

  it('fetches the audio from a URL first when no buffer is given (LocalStorageProvider always returns a fetchable absolute URL)', async () => {
    const fakeAudioResponse = { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    const fakeWhisperResponse = { ok: true, json: async () => ({ text: 'Hello there' }) };
    global.fetch = jest.fn().mockResolvedValueOnce(fakeAudioResponse).mockResolvedValueOnce(fakeWhisperResponse) as any;
    languageDetector.detect.mockReturnValue({ languageCode: 'en', confidence: 0.5 });

    const result = await provider.transcribe({ audioUrl: 'https://cdn.example.com/clip.webm', mimeType: 'audio/webm' });

    expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/clip.webm');
    expect(result.text).toBe('Hello there');
  });

  it('re-detects the transcribed text\'s language via the same script-based detector used for text messages, rather than trusting Whisper\'s own language guess blindly', async () => {
    const fakeWhisperResponse = { ok: true, json: async () => ({ text: 'مرحبا بك' }) };
    global.fetch = jest.fn().mockResolvedValue(fakeWhisperResponse) as any;
    languageDetector.detect.mockReturnValue({ languageCode: 'ar', confidence: 0.9 });

    const result = await provider.transcribe({ audioBuffer: Buffer.from('fake'), mimeType: 'audio/webm' });

    expect(languageDetector.detect).toHaveBeenCalledWith('مرحبا بك');
    expect(result.languageCode).toBe('ar');
  });

  it('throws a clear error when the Whisper API request itself fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }) as any;

    await expect(provider.transcribe({ audioBuffer: Buffer.from('fake'), mimeType: 'audio/webm' })).rejects.toThrow(
      'Whisper transcription request failed',
    );
  });

  it('throws a clear error when neither a buffer nor a URL is given', async () => {
    await expect(provider.transcribe({ mimeType: 'audio/webm' })).rejects.toThrow(
      'Whisper provider requires either an audio buffer or a fetchable audio URL',
    );
  });
});
