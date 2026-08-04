import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';
import { ModulesCatalogService } from '../modules-catalog/modules-catalog.service';
import { TAXONOMY_PRESETS, getPresetByCode } from './taxonomy-presets.data';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private modulesCatalog: ModulesCatalogService,
  ) {}

  /** Super Admin only: provisions a new tenant + its first Company Admin + trial subscription. */
  async create(dto: CreateCompanyDto) {
    const existingSlug = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException('Company slug already in use');

    const adminPasswordHash = await this.authService.hashPassword(dto.adminPassword);

    const company = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.company.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          industry: dto.industry,
          defaultLanguage: dto.defaultLanguage ?? 'en',
          subscription: { create: { plan: dto.plan ?? SubscriptionPlan.TRIAL, seatsLimit: dto.seats ?? 10 } },
        },
      });

      await tx.user.create({
        data: {
          companyId: created.id,
          email: dto.adminEmail,
          passwordHash: adminPasswordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          systemRole: SystemRole.COMPANY_ADMIN,
          preferences: { create: {} },
        },
      });

      return created;
    });

    // Sprint 4 (co_new wizard, step 4 — "الوحدات والصلاحيات"): activate
    // whichever modules the wizard selected, on top of whatever Sprint
    // 1's seed-time backfill would otherwise apply. Runs AFTER the
    // transaction (not inside it) since ModulesCatalogService does its
    // own separate upserts — keeping the core company+admin creation
    // transaction focused and fast, matching the same reasoning already
    // used for fire-and-forget side effects elsewhere in this project
    // (voice transcription, message broadcasts).
    if (dto.moduleCodes?.length) {
      for (const moduleCode of dto.moduleCodes) {
        await this.modulesCatalog.activate(company.id, moduleCode, company.id).catch(() => {
          // A module the wizard sent that somehow isn't in the catalog
          // shouldn't fail company creation itself — the company and
          // its admin already exist at this point.
        });
      }
    }

    return company;
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

  /**
   * Sprint 3 (Super Admin dashboard redesign) — REAL analytics, not
   * placeholder numbers. MRR is computed from actual PAID Invoice rows
   * (Invoice.total, grouped by paidAt's month) — the only trustworthy
   * source of "money actually collected" in this schema. This
   * deliberately does NOT attempt to compute a churn-risk SCORE or any
   * AI-generated "anomaly" insight (the design mockup's dark AI-insights
   * card) — that would require either a real ML model or fabricated
   * numbers, neither of which belongs in a production dashboard. The
   * "needs your decision" list below is honest rule-based flagging
   * (renewing soon / trial ending / cancelled recently), not a
   * prediction.
   */
  async getPlatformAnalytics() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const paidInvoices = await this.prisma.invoice.findMany({
      where: { status: 'PAID', paidAt: { gte: twelveMonthsAgo } },
      select: { total: true, paidAt: true },
    });

    // Group paid invoice totals by calendar month — this IS Monthly
    // Recurring Revenue in the only sense we can honestly claim: money
    // that was actually collected that month, not a forecast.
    const monthlyTotals = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      monthlyTotals.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const inv of paidInvoices as { total: any; paidAt: Date | null }[]) {
      if (!inv.paidAt) continue;
      const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyTotals.has(key)) {
        monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(inv.total));
      }
    }
    const mrrByMonth = Array.from(monthlyTotals.entries()).map(([month, total]) => ({ month, total }));
    const currentMonthMrr = mrrByMonth[mrrByMonth.length - 1]?.total ?? 0;
    const previousMonthMrr = mrrByMonth[mrrByMonth.length - 2]?.total ?? 0;

    const [activeSubCount, cancelledLast30Days, trialsEndingSoon, renewingSoon] = await Promise.all([
      this.prisma.companySubscription.count({ where: { isActive: true } }),
      this.prisma.companySubscription.count({
        where: { cancelledAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.companySubscription.findMany({
        where: { isTrial: true, currentPeriodEnd: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), gte: now } },
        select: { companyId: true, currentPeriodEnd: true },
        take: 10,
      }),
      this.prisma.companySubscription.findMany({
        where: {
          isTrial: false,
          isActive: true,
          currentPeriodEnd: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), gte: now },
        },
        select: { companyId: true, currentPeriodEnd: true },
        take: 10,
      }),
    ]);

    // BUG FIX (confirmed via real Railway build error): CompanySubscription
    // has a plain `companyId` COLUMN, not a `@relation` to Company — so it
    // can't be `select`-ed through directly. Company names for the
    // "needs your decision" list are fetched via one separate, cheap
    // lookup instead.
    const attentionCompanyIds = [...trialsEndingSoon, ...renewingSoon].map(
      (s: { companyId: string }) => s.companyId,
    );
    const attentionCompanies = await this.prisma.company.findMany({
      where: { id: { in: attentionCompanyIds } },
      select: { id: true, name: true },
    });
    const companyNameById = new Map(attentionCompanies.map((c: { id: string; name: string }) => [c.id, c.name]));

    // "Needs your decision" — every item here is a real, honest fact
    // about real data (a real date within 7 days), not a prediction.
    const needsAttention = [
      ...trialsEndingSoon.map((t: { companyId: string; currentPeriodEnd: Date }) => ({
        type: 'trial_ending' as const,
        companyId: t.companyId,
        companyName: companyNameById.get(t.companyId) ?? '—',
        date: t.currentPeriodEnd,
      })),
      ...renewingSoon.map((r: { companyId: string; currentPeriodEnd: Date }) => ({
        type: 'renewing_soon' as const,
        companyId: r.companyId,
        companyName: companyNameById.get(r.companyId) ?? '—',
        date: r.currentPeriodEnd,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      mrrByMonth,
      currentMonthMrr,
      // Month-over-month change — simple, honest arithmetic, not a
      // forecast or trend model.
      mrrChangePercent: previousMonthMrr > 0 ? ((currentMonthMrr - previousMonthMrr) / previousMonthMrr) * 100 : null,
      activeSubscriptionCount: activeSubCount,
      cancelledLast30Days,
      needsAttention,
    };
  }

  /** Sprint 6 (`taxonomy` screen) — this company's current org-level
   * label chain, falling back to the platform-default 7-level chain
   * (the `fuel` preset — matches the pre-Sprint-6 Station/محطة labels
   * exactly) when the company has never customized it. */
  async getTaxonomy(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { orgTaxonomy: true } });
    if (!company) throw new NotFoundException('Company not found');

    if (company.orgTaxonomy) return company.orgTaxonomy;

    const defaultPreset = getPresetByCode('fuel')!;
    return { presetCode: defaultPreset.code, levels: defaultPreset.levels };
  }

  /** Applies a preset wholesale, or a fully custom label chain — either
   * way this ONLY ever writes to the JSON display-layer column; no
   * other table, query, or join is touched (see Company.orgTaxonomy's
   * own doc comment in schema.prisma for why that matters). */
  async updateTaxonomy(companyId: string, data: { presetCode?: string; levels?: any[] }) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    let orgTaxonomy: { presetCode: string; levels: any[] };
    if (data.presetCode) {
      const preset = getPresetByCode(data.presetCode);
      if (!preset) throw new NotFoundException('Unknown industry preset');
      orgTaxonomy = { presetCode: preset.code, levels: data.levels ?? preset.levels };
    } else {
      orgTaxonomy = { presetCode: 'custom', levels: data.levels ?? [] };
    }

    await this.prisma.company.update({ where: { id: companyId }, data: { orgTaxonomy: orgTaxonomy as any } });
    return orgTaxonomy;
  }

  getIndustryPresets() {
    return TAXONOMY_PRESETS;
  }
}
