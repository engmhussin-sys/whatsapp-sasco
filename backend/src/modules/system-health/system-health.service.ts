import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Sprint 15 (`health` screen) — deliberately a REAL-TIME snapshot, not
 * the design mockup's 90-day historical uptime bar / incidents table.
 * This platform has never collected uptime/incident history (no
 * monitoring infrastructure exists to backfill from), so faking 90 days
 * of green bars would be dishonest data on a screen whose whole point
 * is trustworthy operational visibility. Everything returned here is
 * measured live, right now, when the request is made.
 */
@Injectable()
export class SystemHealthService {
  constructor(private prisma: PrismaService) {}

  async getSnapshot() {
    const dbStart = Date.now();
    let dbHealthy = true;
    let dbLatencyMs: number | null = null;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbHealthy = false;
    }

    const memory = process.memoryUsage();

    // Real activity signal — audit log writes in the last 24h. Not an
    // "incident" indicator, just an honest measure of platform activity.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAuditCount = await this.prisma.auditLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } });

    return {
      measuredAt: new Date().toISOString(),
      apiUptimeSeconds: Math.floor(process.uptime()),
      database: { healthy: dbHealthy, latencyMs: dbLatencyMs },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
      recentActivity24h: recentAuditCount,
    };
  }
}
