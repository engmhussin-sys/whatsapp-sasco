import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * "التخزين" screen — built on sizeBytes data the storage provider
 * ALREADY computes on every upload (see LocalStorageProvider.save()).
 * MessageAttachment was already persisting it; TaskAttachment was
 * silently discarding it until this same change added the column and
 * threaded it through (see task-engine.service.ts).
 *
 * Honest scope: this covers message attachments and task attachments —
 * the two upload paths that exist in this codebase. It does NOT cover
 * user avatars or certification documents (those URLs are stored, but
 * no size was ever captured at upload time for them) — labeled clearly
 * in the API response rather than silently omitted.
 */
@Injectable()
export class StorageStatsService {
  constructor(private prisma: PrismaService) {}

  async getPlatformSummary() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });

    const breakdown = await Promise.all(
      companies.map(async (company: { id: string; name: string }) => {
        const [messageAgg, taskAgg] = await Promise.all([
          this.prisma.messageAttachment.aggregate({
            where: { message: { conversation: { companyId: company.id } } },
            _sum: { sizeBytes: true },
            _count: true,
          }),
          this.prisma.taskAttachment.aggregate({
            where: { taskResponse: { task: { companyId: company.id } } },
            _sum: { sizeBytes: true },
            _count: true,
          }),
        ]);

        const messageBytes = Number(messageAgg._sum.sizeBytes ?? 0);
        const taskBytes = Number(taskAgg._sum.sizeBytes ?? 0);

        return {
          companyId: company.id,
          companyName: company.name,
          totalBytes: messageBytes + taskBytes,
          messageAttachmentBytes: messageBytes,
          taskAttachmentBytes: taskBytes,
          fileCount: messageAgg._count + taskAgg._count,
        };
      }),
    );

    breakdown.sort((a, b) => b.totalBytes - a.totalBytes);
    const platformTotalBytes = breakdown.reduce((sum, c) => sum + c.totalBytes, 0);

    return {
      platformTotalBytes,
      scopeNote: 'يشمل مرفقات المحادثات والمهام فقط — الصور الشخصية ووثائق الشهادات لا تُتتبَّع حجمًا حاليًا',
      companyBreakdown: breakdown,
    };
  }
}
