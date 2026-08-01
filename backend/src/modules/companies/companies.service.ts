import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /** Super Admin only: provisions a new tenant + its first Company Admin + trial subscription. */
  async create(dto: CreateCompanyDto) {
    const existingSlug = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException('Company slug already in use');

    const adminPasswordHash = await this.authService.hashPassword(dto.adminPassword);

    return this.prisma.$transaction(async (tx: any) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          industry: dto.industry,
          defaultLanguage: dto.defaultLanguage ?? 'en',
          subscription: { create: { plan: SubscriptionPlan.TRIAL, seatsLimit: 10 } },
        },
      });

      await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.adminEmail,
          passwordHash: adminPasswordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          systemRole: SystemRole.COMPANY_ADMIN,
          preferences: { create: {} },
        },
      });

      return company;
    });
  }

  /** Super Admin: list all tenants on the platform. */
  async findAll(params: { skip?: number; take?: number }) {
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 25,
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count(),
    ]);
    return { items, total };
  }

  async findOne(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true, supportedLanguages: { include: { language: true } } },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.findOne(companyId);
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }

  /** Company Admin dashboard: users / teams / conversations / languages summary. */
  async getDashboardStats(companyId: string) {
    const [userCount, teamCount, conversationCount, languages, activeUserCount] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.team.count({ where: { companyId } }),
        this.prisma.conversation.count({ where: { companyId } }),
        this.prisma.companyLanguage.findMany({
          where: { companyId },
          include: { language: true },
        }),
        this.prisma.user.count({ where: { companyId, isActive: true } }),
      ]);

    return {
      totalUsers: userCount,
      activeUsers: activeUserCount,
      totalTeams: teamCount,
      totalConversations: conversationCount,
      supportedLanguages: languages.map((l: { language: unknown }) => l.language),
    };
  }

  /** Super Admin platform-wide statistics. */
  async getPlatformStats() {
    const [companyCount, userCount, activeSubscriptions, messageCount] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.message.count(),
    ]);
    return { companyCount, userCount, activeSubscriptions, messageCount };
  }
}
