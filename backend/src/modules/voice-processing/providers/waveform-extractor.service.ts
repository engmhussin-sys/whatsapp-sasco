import { Injectable, Logger } from '@nestjs/common';
import { spawnSync, execFileSync } from 'child_process';

/**
 * CHAT_SPEC.md §3/§9: "الموجة — 45 عموداً ثابتة العدد... من بيانات
 * الصوت الحقيقية (لا عشوائية)". يستخرج 45 قيمة سعة صوت حقيقية (0-100)
 * من ملف صوتي محلي عبر ffmpeg، مُوزَّعة بالتساوي على مدة الملف.
 *
 * منهجية مُختبَرة يدوياً قبل الكتابة: يُقسَّم الملف إلى 45 مقطعاً
 * متساوي المدة، ولكل مقطع يُستدعى `ffmpeg -af astats` (يطبع "RMS
 * level dB" على stderr)، ثم تُطبَّع قيمة الديسيبل (نطاق -50..0 نموذجي)
 * إلى 0-100. `spawnSync` (لا `execFileSync`) لأن الأخير يُهمل stderr
 * تماماً عند نجاح الأمر — فخّ حقيقي وقع فيه أول تنفيذ لهذا المنطق.
 *
 * أداء: 45 استدعاء ffmpeg منفصل لكل رسالة صوتية — مقبول لأن الرسائل
 * الصوتية عادة ثوانٍ إلى دقائق قليلة، وهذا يعمل بالكامل في الخلفية
 * (fire-and-forget من MessagesService.sendVoice، لا يُبطئ الاستجابة).
 */
@Injectable()
export class WaveformExtractorService {
  private readonly logger = new Logger(WaveformExtractorService.name);
  private static readonly BARS = 45;

  /** يُعيد 45 قيمة 0-100، أو مصفوفة أصفار إن تعذّر التحليل (لا يرمي
   * استثناءً — فشل استخراج الموجة لا يجب أن يمنع إرسال الرسالة نفسها). */
  extract(filePath: string): number[] {
    try {
      const durationSec = this.probeDuration(filePath);
      if (!durationSec || durationSec <= 0) {
        return new Array(WaveformExtractorService.BARS).fill(0);
      }

      const bars = WaveformExtractorService.BARS;
      const windowSec = Math.max(durationSec / bars, 0.05);
      const values: number[] = [];

      for (let i = 0; i < bars; i++) {
        const start = i * (durationSec / bars);
        const proc = spawnSync(
          'ffmpeg',
          ['-ss', start.toFixed(3), '-t', windowSec.toFixed(3), '-i', filePath, '-af', 'astats', '-f', 'null', '-'],
          { encoding: 'utf-8' },
        );
        const stderrText = proc.stderr ?? '';
        const match = stderrText.match(/RMS level dB:\s*(-?[\d.]+|-inf)/);
        const db = match ? (match[1] === '-inf' ? -60 : parseFloat(match[1])) : -60;
        values.push(Math.max(0, Math.min(100, Math.round(((db + 50) / 50) * 100))));
      }
      return values;
    } catch (err) {
      this.logger.warn(`Waveform extraction failed for ${filePath}: ${(err as Error).message}`);
      return new Array(WaveformExtractorService.BARS).fill(0);
    }
  }

  private probeDuration(filePath: string): number {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]).toString().trim();
    return parseFloat(out);
  }
}
