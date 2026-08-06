import { Injectable, Logger } from '@nestjs/common';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImageMetaExtractorService, ImageMeta } from './image-meta-extractor.service';

/**
 * CHAT_SPEC.md §5: "صورة/فيديو: معاينة مصغّرة بدل الأيقونة" — الفيديو
 * لم يكن يحصل على أي معاينة إطلاقاً (يُعامَل كملف عام بأيقونة فقط).
 *
 * منهجية مُختبَرة يدوياً قبل الكتابة (مطابقة تماماً لـWaveformExtractor):
 * كتابة buffer الفيديو لملف مؤقت (ffmpeg يحتاج مساراً فعلياً، لا يقرأ
 * buffer مباشرة بسهولة)، استخراج إطار واحد من الثانية 0.5 عبر ffmpeg،
 * تصغيره لعرض 320px، ثم تمريره لـImageMetaExtractorService الموجودة
 * أصلاً (إعادة استخدام منطق sharp نفسه بدل تكراره) لإنتاج الأبعاد
 * الحقيقية للإطار + مصغّرة ~32px مضمّنة، بنفس شكل بيانات الصور تماماً.
 */
@Injectable()
export class VideoThumbnailExtractorService {
  private readonly logger = new Logger(VideoThumbnailExtractorService.name);

  constructor(private imageMetaExtractor: ImageMetaExtractorService) {}

  /** يُعيد null عند الفشل (فيديو تالف، ffmpeg غير مثبَّت، إلخ) — لا
   * يرمي أبداً، فشل استخراج المعاينة لا يمنع رفع الفيديو نفسه. */
  async extract(videoBuffer: Buffer): Promise<ImageMeta | null> {
    const tmpDir = os.tmpdir();
    const videoPath = path.join(tmpDir, `video-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    const framePath = path.join(tmpDir, `video-frame-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

    try {
      fs.writeFileSync(videoPath, videoBuffer);
      const proc = spawnSync('ffmpeg', ['-ss', '0.5', '-i', videoPath, '-vframes', '1', '-vf', 'scale=320:-1', framePath, '-y']);
      if (proc.status !== 0 || !fs.existsSync(framePath)) {
        this.logger.warn(`Video frame extraction failed: exit ${proc.status}`);
        return null;
      }
      const frameBuffer = fs.readFileSync(framePath);
      return await this.imageMetaExtractor.extract(frameBuffer);
    } catch (err) {
      this.logger.warn(`Video thumbnail extraction failed: ${(err as Error).message}`);
      return null;
    } finally {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
    }
  }
}
