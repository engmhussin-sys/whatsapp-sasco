import { Test } from '@nestjs/testing';
import { LanguageDetectorService } from '../../../src/modules/translation-engine/language-detector.service';

describe('LanguageDetectorService', () => {
  let service: LanguageDetectorService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [LanguageDetectorService] }).compile();
    service = moduleRef.get(LanguageDetectorService);
  });

  it('detects Arabic text', () => {
    const result = service.detect('مرحبا كيف حالك اليوم');
    expect(result.languageCode).toBe('ar');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects Urdu text (disambiguated from Arabic via Urdu-only letters)', () => {
    const result = service.detect('آپ کیسے ہیں گے');
    expect(result.languageCode).toBe('ur');
  });

  it('detects Hindi text (Devanagari script)', () => {
    const result = service.detect('आप कैसे हैं');
    expect(result.languageCode).toBe('hi');
  });

  it('detects Bengali text', () => {
    const result = service.detect('আপনি কেমন আছেন');
    expect(result.languageCode).toBe('bn');
  });

  it('defaults Latin-script text to English with moderate confidence', () => {
    const result = service.detect('Hello, how are you today?');
    expect(result.languageCode).toBe('en');
    expect(result.confidence).toBeLessThan(0.9);
  });

  it('returns zero confidence for empty text rather than throwing', () => {
    const result = service.detect('   ');
    expect(result.confidence).toBe(0);
  });

  it('does not misclassify a short Arabic phrase mixed with Latin numerals', () => {
    const result = service.detect('الفاتورة رقم 12345');
    expect(result.languageCode).toBe('ar');
  });
});
