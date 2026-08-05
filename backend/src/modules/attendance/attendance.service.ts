import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CheckInDto, CheckOutDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /** One open (no checkOutAt) record per user at a time — checking in
   * again while already checked in is rejected rather than silently
   * creating a second overlapping record. */
  async checkIn(companyId: string, userId: string, dto: CheckInDto) {
    const openRecord = await this.prisma.attendanceRecord.findFirst({
      where: { companyId, userId, checkOutAt: null },
    });
    if (openRecord) {
      throw new BadRequestException('You are already checked in — check out first');
    }

    return this.prisma.attendanceRecord.create({
      data: {
        companyId,
        userId,
        checkInLat: dto.latitude,
        checkInLng: dto.longitude,
        stationId: dto.stationId,
      },
    });
  }

  async checkOut(companyId: string, userId: string, dto: CheckOutDto) {
    const openRecord = await this.prisma.attendanceRecord.findFirst({
      where: { companyId, userId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!openRecord) {
      throw new NotFoundException('No open check-in found to check out of');
    }

    return this.prisma.attendanceRecord.update({
      where: { id: openRecord.id },
      data: { checkOutAt: new Date(), checkOutLat: dto.latitude, checkOutLng: dto.longitude },
    });
  }

  /** This user's own current status — powers a simple "أنا في الموقع
   * الآن" indicator on mobile without needing a separate endpoint. */
  async getMyStatus(companyId: string, userId: string) {
    const openRecord = await this.prisma.attendanceRecord.findFirst({
      where: { companyId, userId, checkOutAt: null },
    });
    return { checkedIn: !!openRecord, record: openRecord };
  }

  /** Today's attendance across the whole company — the Company Admin
   * view. "Today" is computed server-side in UTC-midnight terms
   * (matches how every other "today" boundary in this codebase — task
   * due dates, shift logs — is computed, for consistency). */
  async listToday(companyId: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    return this.prisma.attendanceRecord.findMany({
      where: { companyId, checkInAt: { gte: startOfDay } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async listForUser(companyId: string, userId: string, take = 30) {
    return this.prisma.attendanceRecord.findMany({
      where: { companyId, userId },
      orderBy: { checkInAt: 'desc' },
      take,
    });
  }
}
