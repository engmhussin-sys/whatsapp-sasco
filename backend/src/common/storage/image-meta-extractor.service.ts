import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

export interface ImageMeta {
  width: number;
  height: number;
  thumbnailBase64: string;
}

/**
 * CHAT_SPEC.md §4/§9: "الخادم يجب أن يُرجع width وheight
 * وthumbnailBase64 (صورة مصغّرة جداً ~32px مضمّنة) لكل صورة — واتساب
 * يعرض المصغّرة الضبابية فوراً ثم يستبدلها. بدونها تقفز الشاشة."
 *
 * منهجية مُختبَرة يدوياً قبل الكتابة: sharp().metadata() للأبعاد
 * الحقيقية، sharp().resize(32,32).jpeg({quality:40}) لمصغّرة بضع مئات
 * من البايتات فقط — صالحة للتضمين المباشر في استجابة JSON.
 */
@Injectable()
export class ImageMetaExtractorService {
  private readonly logger = new Logger(ImageMetaExtractorService.name);

  /** يُعيد null عند الفشل (ملف تالف، ليس صورة فعلياً رغم mimetype) —
   * لا يرمي أبداً، فشل استخراج المعاينة لا يجب أن يمنع رفع الصورة نفسها. */
  async extract(buffer: Buffer): Promise<ImageMeta | null> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) return null;

      const thumbnailBuffer = await sharp(buffer).resize(32, 32, { fit: 'inside' }).jpeg({ quality: 40 }).toBuffer();

      return {
        width: metadata.width,
        height: metadata.height,
        thumbnailBase64: `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`,
      };
    } catch (err) {
      this.logger.warn(`Image metadata extraction failed: ${(err as Error).message}`);
      return null;
    }
  }
}
