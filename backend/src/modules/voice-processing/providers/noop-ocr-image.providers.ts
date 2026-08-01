import { Injectable, Logger } from '@nestjs/common';
import { OcrProvider, OcrResult, ImageAnalysisProvider, ImageAnalysisResult } from '../ocr-image.interfaces';

@Injectable()
export class NoopOcrProvider implements OcrProvider {
  private readonly logger = new Logger('OCR[stub]');

  async extractText(input: { imageUrl?: string; mimeType: string }): Promise<OcrResult> {
    this.logger.debug(`extractText() for ${input.imageUrl ?? '(buffer)'} — Phase 2 not yet implemented`);
    return { text: '', confidence: 0 };
  }
}

@Injectable()
export class NoopImageAnalysisProvider implements ImageAnalysisProvider {
  private readonly logger = new Logger('ImageAnalysis[stub]');

  async analyze(input: { imageUrl?: string; mimeType: string }): Promise<ImageAnalysisResult> {
    this.logger.debug(`analyze() for ${input.imageUrl ?? '(buffer)'} — Phase 2 not yet implemented`);
    return { labels: [], anomalies: [], confidence: 0 };
  }
}
