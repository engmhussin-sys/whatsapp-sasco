import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateComplianceRequirementDto, UpdateComplianceRequirementDto } from './dto/compliance.dto';

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  create(companyId: string, dto: CreateComplianceRequirementDto) {
    return this.prisma.complianceRequirement.create({
      data: { companyId, ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined },
    });
  }

  async list(companyId: string) {
    const items = await this.prisma.complianceRequirement.findMany({
      where: { companyId },
      include: { assignedToUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueAt: 'asc' },
    });
    // Same honest, computed-on-read pattern as Certifications: a stored
    // OVERDUE status could silently go stale the moment the due date
    // passes without anyone touching the row.
    const now = Date.now();
    return items.map((item: { dueAt: Date | null; status: string }) => ({
      ...item,
      isOverdue: item.status !== 'COMPLETED' && item.dueAt != null && item.dueAt.getTime() < now,
    }));
  }

  async update(companyId: string, id: string, dto: UpdateComplianceRequirementDto) {
    const item = await this.prisma.complianceRequirement.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException('Compliance requirement not found');
    return this.prisma.complianceRequirement.update({
      where: { id },
      data: { ...dto, completedAt: dto.status === 'COMPLETED' ? new Date() : undefined },
    });
  }
}
