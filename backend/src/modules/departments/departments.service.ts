import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/departments.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async create(companyId: string, actorId: string, dto: CreateDepartmentDto) {
    if (dto.parentDepartmentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: dto.parentDepartmentId, companyId } });
      if (!parent) throw new NotFoundException('Parent department not found');
    }
    const department = await this.prisma.department.create({
      data: { companyId, name: dto.name, parentDepartmentId: dto.parentDepartmentId },
    });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.CREATE, entityType: 'Department', entityId: department.id });
    return department;
  }

  findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: { _count: { select: { users: true, teams: true, stations: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId },
      include: { childDepartments: true, users: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(companyId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(companyId, id);
    if (dto.parentDepartmentId === id) {
      throw new NotFoundException('A department cannot be its own parent');
    }
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string, actorId: string) {
    await this.findOne(companyId, id);
    await this.prisma.department.delete({ where: { id } });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.DELETE, entityType: 'Department', entityId: id });
  }
}
