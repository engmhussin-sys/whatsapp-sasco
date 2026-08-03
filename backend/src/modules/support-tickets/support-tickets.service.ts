import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, SystemRole, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * SUPPORT TICKETS — company-to-platform support channel. A company user
 * opens a ticket, Super Admins see it in a platform-wide queue and
 * reply; every new ticket/reply generates a Notification for the
 * relevant party (Super Admins on new tickets, the ticket creator on
 * new Super Admin replies) via the Notification Center built earlier.
 */
@Injectable()
export class SupportTicketsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(companyId: string | null, userId: string, subject: string, body: string, priority: TicketPriority = TicketPriority.MEDIUM) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId,
        createdById: userId,
        subject,
        priority,
        messages: { create: { authorId: userId, body } },
      },
      include: { messages: true },
    });

    await this.notifySuperAdmins(ticket.id, subject);
    return ticket;
  }

  private async notifySuperAdmins(ticketId: string, subject: string) {
    const superAdmins = await this.prisma.user.findMany({ where: { systemRole: SystemRole.SUPER_ADMIN, isActive: true }, select: { id: true } });
    await Promise.all(
      superAdmins.map((admin: { id: string }) =>
        this.notifications
          .create({
            userId: admin.id,
            type: NotificationType.SYSTEM,
            title: 'تذكرة دعم جديدة',
            body: subject,
            link: `/super-admin/support/${ticketId}`,
          })
          .catch(() => {}),
      ),
    );
  }

  async addMessage(ticketId: string, authorId: string, body: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const message = await this.prisma.ticketMessage.create({ data: { ticketId, authorId, body } });

    await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

    // Notify the "other side" — if a Super Admin replied, notify the
    // ticket creator; if the creator replied again, notify all Super
    // Admins (mirrors notifySuperAdmins above).
    const author = await this.prisma.user.findUnique({ where: { id: authorId } });
    if (author?.systemRole === SystemRole.SUPER_ADMIN) {
      await this.notifications
        .create({
          userId: ticket.createdById,
          type: NotificationType.SYSTEM,
          title: 'ردّ جديد على تذكرتك',
          body: ticket.subject,
          link: `/support/${ticketId}`,
        })
        .catch(() => {});
    } else {
      await this.notifySuperAdmins(ticketId, `ردّ جديد: ${ticket.subject}`);
    }

    return message;
  }

  async updateStatus(ticketId: string, status: TicketStatus) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, resolvedAt: status === TicketStatus.RESOLVED ? new Date() : ticket.resolvedAt },
    });
  }

  async getOne(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { firstName: true, lastName: true, systemRole: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  listForCompany(companyId: string) {
    return this.prisma.supportTicket.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  listAllPlatform(status?: TicketStatus) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: 'desc' },
      include: { company: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
    });
  }
}
