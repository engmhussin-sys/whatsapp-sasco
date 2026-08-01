import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async findForCompany(companyId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!sub) throw new NotFoundException('No subscription found for this company');
    return sub;
  }

  /** Super Admin only. */
  async update(companyId: string, data: { plan?: SubscriptionPlan; status?: SubscriptionStatus; seatsLimit?: number }) {
    await this.findForCompany(companyId);
    return this.prisma.subscription.update({ where: { companyId }, data });
  }

  /** Enforced by UsersService.create in a future iteration; exposed here for that check. */
  async hasAvailableSeats(companyId: string): Promise<boolean> {
    const [sub, activeUserCount] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { companyId } }),
      this.prisma.user.count({ where: { companyId, isActive: true } }),
    ]);
    if (!sub) return false;
    return activeUserCount < sub.seatsLimit;
  }
}
