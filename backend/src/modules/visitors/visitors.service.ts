import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CheckInVisitorDto } from './dto/visitors.dto';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  checkIn(companyId: string, dto: CheckInVisitorDto) {
    return this.prisma.visitor.create({ data: { companyId, ...dto } });
  }

  async checkOut(companyId: string, visitorId: string) {
    const visitor = await this.prisma.visitor.findFirst({ where: { id: visitorId, companyId } });
    if (!visitor) throw new NotFoundException('Visitor record not found');
    return this.prisma.visitor.update({ where: { id: visitorId }, data: { checkOutAt: new Date() } });
  }

  listOnSite(companyId: string) {
    return this.prisma.visitor.findMany({
      where: { companyId, checkOutAt: null },
      include: { hostUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }

  listToday(companyId: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    return this.prisma.visitor.findMany({
      where: { companyId, checkInAt: { gte: startOfDay } },
      include: { hostUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }
}
