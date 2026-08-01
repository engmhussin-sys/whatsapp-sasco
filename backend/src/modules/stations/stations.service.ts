import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateStationDto, CreateTankDto, UpdateTankLevelDto } from './dto/stations.dto';

@Injectable()
export class StationsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async create(companyId: string, actorId: string, dto: CreateStationDto) {
    const existing = await this.prisma.station.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) throw new ConflictException('A station with this code already exists');

    const station = await this.prisma.station.create({
      data: { companyId, name: dto.name, code: dto.code, latitude: dto.latitude, longitude: dto.longitude },
    });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.CREATE, entityType: 'Station', entityId: station.id });
    return station;
  }

  findAll(companyId: string) {
    return this.prisma.station.findMany({
      where: { companyId, isActive: true },
      include: { tanks: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const station = await this.prisma.station.findFirst({ where: { id, companyId }, include: { tanks: true } });
    if (!station) throw new NotFoundException('Station not found');
    return station;
  }

  async addTank(companyId: string, stationId: string, actorId: string, dto: CreateTankDto) {
    await this.findOne(companyId, stationId); // tenant-scoped existence check

    const existing = await this.prisma.tank.findUnique({
      where: { stationId_code: { stationId, code: dto.code } },
    });
    if (existing) throw new ConflictException('A tank with this code already exists at this station');

    const tank = await this.prisma.tank.create({
      data: { stationId, code: dto.code, fuelType: dto.fuelType, capacityLiters: dto.capacityLiters },
    });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.CREATE, entityType: 'Tank', entityId: tank.id });
    return tank;
  }

  async updateTankLevel(companyId: string, tankId: string, actorId: string, dto: UpdateTankLevelDto) {
    const tank = await this.prisma.tank.findFirst({ where: { id: tankId, station: { companyId } } });
    if (!tank) throw new NotFoundException('Tank not found');

    const updated = await this.prisma.tank.update({
      where: { id: tankId },
      data: { lastKnownLevel: dto.level },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Tank',
      entityId: tankId,
      metadata: { newLevel: dto.level },
    });

    return updated;
  }
}
