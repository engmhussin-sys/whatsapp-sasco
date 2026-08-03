import { Injectable, NotFoundException } from '@nestjs/common';
import { HazardStatus, NotificationType, SystemRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from '../websocket/chat.gateway';

/**
 * SAFETY LAYER (T8) — hazard reporting + SOS. Mirrors the `approvals`
 * module's shape/guard pattern per the design handoff. SOS alerts reuse
 * the SAME per-user Socket.io room (`user:{id}`) as chat/notifications
 * rather than inventing a "supervisors room" concept — every
 * COMPANY_ADMIN/TEAM_LEAD in the company gets both a real-time
 * `sos:new` socket emit (if connected) AND a persisted Notification
 * (so it's still there if they weren't connected at the moment).
 */
@Injectable()
export class SafetyService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private chatGateway: ChatGateway,
  ) {}

  // ---- Hazard reports ---------------------------------------------------

  reportHazard(companyId: string, reportedById: string, kind: string, stationId?: string, note?: string, photoUrl?: string, audioUrl?: string) {
    return this.prisma.hazardReport.create({
      data: { companyId, reportedById, kind: kind as never, stationId, note, photoUrl, audioUrl },
    });
  }

  listHazards(companyId: string, status?: HazardStatus) {
    return this.prisma.hazardReport.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { reportedBy: { select: { firstName: true, lastName: true } }, station: { select: { name: true } } },
    });
  }

  async updateHazardStatus(companyId: string, hazardId: string, status: HazardStatus) {
    const hazard = await this.prisma.hazardReport.findFirst({ where: { id: hazardId, companyId } });
    if (!hazard) throw new NotFoundException('Hazard report not found');
    return this.prisma.hazardReport.update({ where: { id: hazardId }, data: { status } });
  }

  // ---- SOS ----------------------------------------------------------------

  async raiseSos(companyId: string, raisedById: string, stationId?: string, latitude?: number, longitude?: number) {
    const alert = await this.prisma.sosAlert.create({
      data: { companyId, raisedById, stationId, latitude, longitude },
      include: { raisedBy: { select: { firstName: true, lastName: true } } },
    });

    await this.notifySupervisors(companyId, alert);
    return alert;
  }

  private async notifySupervisors(companyId: string, alert: { id: string; raisedBy: { firstName: string; lastName: string } }) {
    const supervisors = await this.prisma.user.findMany({
      where: { companyId, isActive: true, systemRole: { in: [SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD] } },
      select: { id: true },
    });

    const payload = { alertId: alert.id, raisedByName: `${alert.raisedBy.firstName} ${alert.raisedBy.lastName}`, companyId };

    await Promise.all(
      supervisors.map(async (s: { id: string }) => {
        try {
          this.chatGateway.server?.to(`user:${s.id}`).emit('sos:new', payload);
        } catch {
          // real-time push is best-effort — the Notification row below is the durable record
        }
        await this.notifications
          .create({
            userId: s.id,
            companyId,
            type: NotificationType.SYSTEM,
            title: `🆘 استغاثة من ${payload.raisedByName}`,
            body: 'اضغط لعرض الموقع والتفاصيل',
            link: `/safety/sos/${alert.id}`,
          })
          .catch(() => {});
      }),
    );
  }

  async resolveSos(companyId: string, alertId: string) {
    const alert = await this.prisma.sosAlert.findFirst({ where: { id: alertId, companyId } });
    if (!alert) throw new NotFoundException('SOS alert not found');
    return this.prisma.sosAlert.update({ where: { id: alertId }, data: { resolvedAt: new Date() } });
  }

  listActiveSos(companyId: string) {
    return this.prisma.sosAlert.findMany({
      where: { companyId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { raisedBy: { select: { firstName: true, lastName: true } }, station: { select: { name: true } } },
    });
  }
}
