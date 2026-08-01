/**
 * PHASE 2 READINESS — OCR + Image Analysis. Same pattern as
 * voice-processing.interfaces.ts: pure contracts, no AI implemented in
 * Phase 1, Noop stubs registered below so calling code (e.g. a future
 * "scan meter reading photo" task field, or auto-tagging a fuel-request
 * photo) can already be written against the final shape.
 */

export interface OcrResult {
  text: string;
  confidence?: number;
  /** Optional structured line/word boxes — left as provider-specific `unknown` since formats vary widely (Tesseract vs. cloud OCR vs. on-device). */
  regions?: unknown;
}

export interface OcrProvider {
  extractText(input: { imageUrl?: string; imageBuffer?: Buffer; mimeType: string }): Promise<OcrResult>;
}

export interface ImageAnalysisResult {
  labels: string[];
  /** e.g. detected anomalies for AI Inspection in Phase 2 (leak, damage, missing PPE, ...) — empty in Phase 1. */
  anomalies?: string[];
  confidence?: number;
}

export interface ImageAnalysisProvider {
  analyze(input: { imageUrl?: string; imageBuffer?: Buffer; mimeType: string }): Promise<ImageAnalysisResult>;
}

export const OCR_PROVIDER = 'OCR_PROVIDER';
export const IMAGE_ANALYSIS_PROVIDER = 'IMAGE_ANALYSIS_PROVIDER';
