/**
 * Seed script — creates the minimum data needed to actually USE the
 * product immediately after deployment, matching exactly the MVP
 * screens in scope this Sprint (Login, Dashboard, Companies, Stations,
 * Teams, Users / Login, Home, Conversations, Chat, Tasks, Shift,
 * Fuel Request, Profile). No AI/OCR/translation-cache/dictionary data —
 * those subsystems are frozen this Sprint per the current roadmap.
 *
 * Run with: npm run prisma:seed  (see package.json)
 */
import { PrismaClient, SystemRole, ModuleCode } from '@prisma/client';
import { TaskFieldType } from '../src/modules/task-engine/task-field-type.enum';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@12345'; // same for every seeded account — change immediately in production use

async function hash(plain: string) {
  return bcrypt.hash(plain, 12);
}

/** Every module code that already gates real, shipped functionality —
 * kept as an explicit list here (not "everything non-comingSoon in the
 * catalog") so this backfill's behavior doesn't silently change if the
 * catalog file is edited; a new LIVE module must be added to BOTH
 * places deliberately. */
const LIVE_MODULE_CODES: ModuleCode[] = [
  ModuleCode.CHAT,
  ModuleCode.TASKS,
  ModuleCode.APPROVALS,
  ModuleCode.SHIFTS,
  ModuleCode.FUEL_REQUESTS,
  ModuleCode.SAFETY,
  ModuleCode.BROADCAST,
  ModuleCode.DIRECTORY,
  ModuleCode.REPORTS,
];

async function backfillLiveModulesForAllCompanies() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const { id: companyId } of companies) {
    for (const moduleCode of LIVE_MODULE_CODES) {
      await prisma.companyModule.upsert({
        where: { companyId_moduleCode: { companyId, moduleCode } },
        create: { companyId, moduleCode, isActive: true },
        // Idempotent on re-run: an ALREADY-active row is left untouched
        // (so a company that deliberately deactivated a module doesn't
        // get it silently re-activated every deploy); only a MISSING
        // row gets created.
        update: {},
      });
    }
  }
  console.log(`  Module backfill: ensured ${LIVE_MODULE_CODES.length} live modules across ${companies.length} companies`);
}

async function main() {
  console.log('Seeding WorkForce Connect AI demo data...');

  // ---- Languages (needed for Company.defaultLanguage + dashboard display) --
  await prisma.language.upsert({
    where: { code: 'en' },
    create: { code: 'en', name: 'English', nativeName: 'English', isRtl: false },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'ar' },
    create: { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRtl: true },
    update: {},
  });
  // ---- Languages most commonly spoken by fuel-station / labor workers in
  // Saudi Arabia (Pakistani, Indian, Bangladeshi, Filipino, Nepali, and
  // Indonesian workforces are all very common in this sector) — matches
  // exactly the language set mobile/lib/.../language_detector.service.ts
  // was already built anticipating (ar, en, ur, hi, bn, ne, tl).
  await prisma.language.upsert({
    where: { code: 'ur' },
    create: { code: 'ur', name: 'Urdu', nativeName: 'اردو', isRtl: true },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'hi' },
    create: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isRtl: false },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'bn' },
    create: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', isRtl: false },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'tl' },
    create: { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', isRtl: false },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'ne' },
    create: { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', isRtl: false },
    update: {},
  });
  await prisma.language.upsert({
    where: { code: 'id' },
    create: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', isRtl: false },
    update: {},
  });

  // ---- Permission catalog (platform-wide, powers the Permission Matrix
  // UI — every code below maps to a real capability the app already
  // enforces or could enforce; grouped by domain for readability) ----------
  const permissionCatalog: { code: string; description: string }[] = [
    { code: 'users.view', description: 'عرض المستخدمين' },
    { code: 'users.create', description: 'إنشاء مستخدمين' },
    { code: 'users.edit', description: 'تعديل بيانات المستخدمين' },
    { code: 'users.deactivate', description: 'تعطيل/تفعيل المستخدمين' },
    { code: 'teams.view', description: 'عرض الفرق' },
    { code: 'teams.manage', description: 'إدارة الفرق وأعضائها' },
    { code: 'stations.view', description: 'عرض المحطات' },
    { code: 'stations.manage', description: 'إدارة المحطات والخزانات' },
    { code: 'tasks.view', description: 'عرض المهام' },
    { code: 'tasks.create', description: 'إنشاء مهام وقوالب مهام' },
    { code: 'tasks.assign', description: 'إسناد المهام للموظفين' },
    { code: 'approvals.view', description: 'عرض طلبات الموافقة' },
    { code: 'approvals.decide', description: 'الموافقة/الرفض على الطلبات' },
    { code: 'shifts.view', description: 'عرض الورديات' },
    { code: 'shifts.manage', description: 'فتح/إغلاق الورديات' },
    { code: 'fuel_requests.view', description: 'عرض طلبات الوقود' },
    { code: 'fuel_requests.decide', description: 'الموافقة على طلبات الوقود' },
    { code: 'conversations.moderate', description: 'إدارة قنوات الدردشة والبث' },
    { code: 'roles.manage', description: 'إدارة الأدوار والصلاحيات' },
    { code: 'billing.view', description: 'عرض الفوترة والاشتراك' },
    { code: 'billing.manage', description: 'إدارة الاشتراك والفواتير' },
    { code: 'reports.view', description: 'عرض التقارير' },
    { code: 'audit_logs.view', description: 'عرض سجلّ الأحداث' },
  ];
  for (const perm of permissionCatalog) {
    await prisma.permission.upsert({ where: { code: perm.code }, create: perm, update: { description: perm.description } });
  }

  // ---- Platform-default Translation Provider config --------------------------
  // WITHOUT this row, TranslationProviderRegistry.resolveForCompany() finds
  // no active config for ANY company and silently falls back to
  // OFFLINE_STUB (which just returns "[targetLang] originalText" — exactly
  // the "[ar]"/"[en]" tags seen in the app when this was missing). This
  // row makes OpenAI the platform-wide default; `apiKeyEnvVar` only names
  // WHICH Railway environment variable holds the key — the actual secret
  // must still be set there separately (never stored in this seed file).
  // NOTE: Prisma's compound-unique `where` clause does NOT accept `null`
  // for a nullable field (confirmed via a real production failure:
  // "Argument `companyId` must not be null") — upsert() with
  // companyId_providerType: { companyId: null, ... } always throws.
  // findFirst + conditional create/update is the correct pattern for a
  // nullable-field "unique" lookup.
  const existingTranslationConfig = await prisma.translationProviderConfig.findFirst({
    where: { companyId: null, providerType: 'OPENAI' },
  });
  if (!existingTranslationConfig) {
    await prisma.translationProviderConfig.create({
      data: {
        companyId: null,
        providerType: 'OPENAI',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        isActive: true,
        priority: 0,
      },
    });
  }

  // ---- Super Admin (platform-level, companyId = null) -----------------------
  const superAdminEmail = 'superadmin@workforceconnect.ai';
  const superAdmin = await prisma.user.upsert({
    where: { id: 'seed-super-admin' }, // stable id so re-running the seed is idempotent
    create: {
      id: 'seed-super-admin',
      email: superAdminEmail,
      phone: '+966500000099',
      passwordHash: await hash(DEMO_PASSWORD),
      firstName: 'Platform',
      lastName: 'Admin',
      systemRole: SystemRole.SUPER_ADMIN,
      status: 'ACTIVE',
      companyId: null,
    },
    update: {},
  });

  // ---- Demo Company + its Company Admin ---------------------------------------
  const company = await prisma.company.upsert({
    where: { slug: 'demo-fuel-co' },
    create: {
      name: 'Demo Fuel Company',
      slug: 'demo-fuel-co',
      industry: 'Fuel Stations',
      defaultLanguage: 'ar',
      subscription: { create: { plan: 'PROFESSIONAL', seatsLimit: 50 } },
      supportedLanguages: { create: [{ langCode: 'ar' }, { langCode: 'en' }, { langCode: 'ur' }, { langCode: 'hi' }, { langCode: 'bn' }] },
    },
    update: {},
  });

  const companyAdminEmail = 'admin@demo-fuel-co.com';
  const companyAdmin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: companyAdminEmail } },
    create: {
      companyId: company.id,
      email: companyAdminEmail,
      phone: '+966500000000',
      passwordHash: await hash(DEMO_PASSWORD),
      firstName: 'سارة',
      lastName: 'المدير',
      systemRole: SystemRole.COMPANY_ADMIN,
      status: 'ACTIVE',
      preferredLanguage: 'ar',
      preferences: { create: {} },
    },
    update: {},
  });

  // ---- Custom Roles used by the Approval Flow below --------------------------
  const supervisorRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Supervisor' } },
    create: { companyId: company.id, name: 'Supervisor', description: 'Station supervisor' },
    update: {},
  });
  const managerRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Manager' } },
    create: { companyId: company.id, name: 'Manager', description: 'Regional manager' },
    update: {},
  });

  // ---- Team + Station + Tanks --------------------------------------------------
  const team = await prisma.team.upsert({
    where: { id: 'seed-team-1' },
    create: { id: 'seed-team-1', companyId: company.id, name: 'فريق المحطة الرئيسية' },
    update: {},
  });

  const station = await prisma.station.upsert({
    where: { companyId_code: { companyId: company.id, code: 'STN-001' } },
    create: {
      companyId: company.id,
      code: 'STN-001',
      name: 'محطة الرياض الرئيسية',
      latitude: 24.7136,
      longitude: 46.6753,
    },
    update: {},
  });

  const station2 = await prisma.station.upsert({
    where: { companyId_code: { companyId: company.id, code: 'STN-002' } },
    create: {
      companyId: company.id,
      code: 'STN-002',
      name: 'محطة جدة الفرعية',
      latitude: 21.4858,
      longitude: 39.1925,
    },
    update: {},
  });

  await prisma.tank.upsert({
    where: { stationId_code: { stationId: station2.id, code: 'TANK-A' } },
    create: { stationId: station2.id, code: 'TANK-A', fuelType: 'Diesel', capacityLiters: 18000, lastKnownLevel: 9000 },
    update: {},
  });

  await prisma.tank.upsert({
    where: { stationId_code: { stationId: station.id, code: 'TANK-A' } },
    create: { stationId: station.id, code: 'TANK-A', fuelType: 'Diesel', capacityLiters: 20000, lastKnownLevel: 14500 },
    update: {},
  });
  await prisma.tank.upsert({
    where: { stationId_code: { stationId: station.id, code: 'TANK-B' } },
    create: { stationId: station.id, code: 'TANK-B', fuelType: 'Petrol95', capacityLiters: 15000, lastKnownLevel: 6200 },
    update: {},
  });

  // ---- Team Lead + Worker (activated directly for demo convenience — in
  // real use these would go through OTP activation, see OnboardingService) --
  const teamLeadEmail = 'supervisor@demo-fuel-co.com';
  const teamLead = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: teamLeadEmail } },
    create: {
      companyId: company.id,
      email: teamLeadEmail,
      phone: '+966500000001',
      passwordHash: await hash(DEMO_PASSWORD),
      firstName: 'خالد',
      lastName: 'المشرف',
      systemRole: SystemRole.TEAM_LEAD,
      status: 'ACTIVE',
      preferredLanguage: 'ar',
      primaryStationId: station.id,
      preferences: { create: {} },
    },
    update: {},
  });

  const workerEmail = 'worker@demo-fuel-co.com';
  const worker = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: workerEmail } },
    create: {
      companyId: company.id,
      email: workerEmail,
      phone: '+966500000002',
      passwordHash: await hash(DEMO_PASSWORD),
      firstName: 'محمد',
      lastName: 'العامل',
      systemRole: SystemRole.WORKER,
      status: 'ACTIVE',
      preferredLanguage: 'ar',
      primaryStationId: station.id,
      preferences: { create: {} },
    },
    update: {},
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: teamLead.id } },
    create: { teamId: team.id, userId: teamLead.id, isLead: true },
    update: {},
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: worker.id } },
    create: { teamId: team.id, userId: worker.id },
    update: {},
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teamLead.id, roleId: supervisorRole.id } },
    create: { userId: teamLead.id, roleId: supervisorRole.id },
    update: {},
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: companyAdmin.id, roleId: managerRole.id } },
    create: { userId: companyAdmin.id, roleId: managerRole.id },
    update: {},
  });

  // ---- Approval Flow for Fuel Requests (Worker -> Supervisor -> Manager) -----
  const existingFlow = await prisma.approvalFlow.findFirst({
    where: { companyId: company.id, entityType: 'FuelRequest' },
  });
  if (!existingFlow) {
    await prisma.approvalFlow.create({
      data: {
        companyId: company.id,
        name: 'Fuel Request Approval',
        entityType: 'FuelRequest',
        steps: {
          create: [
            { stepOrder: 1, name: 'Supervisor Review', approverRoleId: supervisorRole.id },
            { stepOrder: 2, name: 'Manager Review', approverRoleId: managerRole.id },
          ],
        },
      },
    });
  }

  // ---- A simple Task Template (Open Shift checklist) so the Tasks/Shift
  // screens have something real to show and submit against --------------------
  const existingTemplate = await prisma.taskTemplate.findFirst({
    where: { companyId: company.id, name: 'Open Shift Checklist' },
  });
  const taskTemplate =
    existingTemplate ??
    (await prisma.taskTemplate.create({
      data: {
        companyId: company.id,
        name: 'Open Shift Checklist',
        domainTag: 'fuel_station',
        fields: [
          { id: 'f1', type: TaskFieldType.NUMBER, label: 'Meter reading', required: true },
          { id: 'f2', type: TaskFieldType.PHOTO, label: 'Photo of meter', required: true },
          { id: 'f3', type: TaskFieldType.SIGNATURE, label: 'Worker signature', required: true },
        ],
      },
    }));

  // ---- An actual Task instance (not just the template) assigned to the
  // seeded worker, so the Tasks screen has real, submittable content on
  // first login rather than an empty list --------------------------------------
  const existingTask = await prisma.task.findFirst({ where: { companyId: company.id, title: 'فتح وردية الصباح' } });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        companyId: company.id,
        templateId: taskTemplate.id,
        title: 'فتح وردية الصباح',
        description: 'تسجيل قراءات العدادات وتصويرها عند بدء الوردية',
        status: 'ASSIGNED',
        teamId: team.id,
        createdById: companyAdmin.id,
        assignments: { create: [{ userId: worker.id }] },
      },
    });
  }

  // ---- A demo Fuel Request already routed through the Approval Flow above,
  // sitting at step 1 (Supervisor) so there is something real for the
  // Approvals screen to show immediately -------------------------------------
  const fuelFlow = await prisma.approvalFlow.findFirst({ where: { companyId: company.id, entityType: 'FuelRequest' } });
  const existingFuelRequest = await prisma.fuelRequest.findFirst({ where: { companyId: company.id, stationId: station.id } });
  if (!existingFuelRequest && fuelFlow) {
    const tankA = await prisma.tank.findFirst({ where: { stationId: station.id, code: 'TANK-A' } });
    if (tankA) {
      const approval = await prisma.approval.create({
        data: {
          companyId: company.id,
          flowId: fuelFlow.id,
          entityType: 'FuelRequest',
          entityId: 'pending', // patched below once the FuelRequest id is known
          currentStep: 1,
          status: 'PENDING',
          createdById: worker.id,
        },
      });
      const fuelRequest = await prisma.fuelRequest.create({
        data: {
          companyId: company.id,
          stationId: station.id,
          tankId: tankA.id,
          requestedById: worker.id,
          currentLevel: 14500,
          requestedQuantity: 5000,
          notes: 'المستوى منخفض عن المعتاد لهذا الوقت من الشهر',
          status: 'PENDING_SUPERVISOR',
          approvalId: approval.id,
        },
      });
      await prisma.approval.update({ where: { id: approval.id }, data: { entityId: fuelRequest.id } });
    }
  }

  // ---- A Direct conversation between the seeded Supervisor and Worker,
  // with one message, so Conversations/Chat screens aren't empty on first login --
  const existingConversation = await prisma.conversation.findFirst({
    where: { companyId: company.id, type: 'DIRECT', members: { every: { userId: { in: [teamLead.id, worker.id] } } } },
  });
  if (!existingConversation) {
    const conversation = await prisma.conversation.create({
      data: {
        companyId: company.id,
        type: 'DIRECT',
        members: { create: [{ userId: teamLead.id }, { userId: worker.id }] },
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: teamLead.id,
        type: 'TEXT',
        status: 'SENT',
        originalText: 'صباح الخير، لا تنسَ فتح الوردية وتصوير العدادات',
        originalLang: 'ar',
      },
    });
  }

  // ---- Additional lightweight test companies (multi-company/multi-role
  // testing convenience, per explicit request during the testing phase —
  // each is intentionally shallow: just the 3 core roles + phone numbers,
  // not full operational depth like "Demo Fuel Company" above) ----------------
  interface QuickTestAccount {
    label: string;
    email: string;
    phone: string;
    role: string;
  }
  const quickTestAccounts: QuickTestAccount[] = [];

  const testCompanyDefs = [
    { slug: 'northstar-logistics', name: 'Northstar Logistics', industry: 'Logistics', phonePrefix: '+966501' },
    { slug: 'gulf-retail-group', name: 'Gulf Retail Group', industry: 'Retail', phonePrefix: '+966502' },
  ];

  for (const def of testCompanyDefs) {
    const testCompany = await prisma.company.upsert({
      where: { slug: def.slug },
      create: {
        name: def.name,
        slug: def.slug,
        industry: def.industry,
        defaultLanguage: 'ar',
        subscription: { create: { plan: 'PROFESSIONAL', seatsLimit: 50 } },
        supportedLanguages: { create: [{ langCode: 'ar' }, { langCode: 'en' }] },
      },
      update: {},
    });

    const roles: { role: SystemRole; firstName: string; lastName: string; suffix: string }[] = [
      { role: SystemRole.COMPANY_ADMIN, firstName: 'Admin', lastName: def.name, suffix: '01' },
      { role: SystemRole.TEAM_LEAD, firstName: 'Lead', lastName: def.name, suffix: '02' },
      { role: SystemRole.WORKER, firstName: 'Worker', lastName: def.name, suffix: '03' },
    ];

    for (const r of roles) {
      const email = `${r.role.toLowerCase()}@${def.slug}.com`;
      const phone = `${def.phonePrefix}${r.suffix}`;
      await prisma.user.upsert({
        where: { companyId_email: { companyId: testCompany.id, email } },
        create: {
          companyId: testCompany.id,
          email,
          phone,
          passwordHash: await hash(DEMO_PASSWORD),
          firstName: r.firstName,
          lastName: r.lastName,
          systemRole: r.role,
          status: 'ACTIVE',
          preferredLanguage: 'ar',
          preferences: { create: {} },
        },
        update: {},
      });
      quickTestAccounts.push({ label: `${r.role} — ${def.name}`, email, phone, role: r.role });
    }
  }

  // ---- Sprint 1 of the Enterprise Platform pivot: Module Marketplace ----
  // Backfills an active CompanyModule row for every LIVE module, for
  // EVERY company already in the database — not just ones this seed
  // script itself creates. This is what keeps ModuleGuard from locking
  // the real SASCO production company (and anyone else) out of features
  // they already use the moment this deploys; RUN_SEED=true means this
  // runs on every Railway deploy, so it's the correct place for a
  // backfill that must reach production data, not just demo data.
  await backfillLiveModulesForAllCompanies();

  console.log('\nSeed complete. Demo accounts (all use the same password):');
  console.log(`  Password for every account below: ${DEMO_PASSWORD}\n`);
  console.log(`  Super Admin:    ${superAdminEmail}`);
  console.log(`  Company Admin:  ${companyAdminEmail}  (companyId: ${company.id})`);
  console.log(`  Team Lead:      ${teamLeadEmail}`);
  console.log(`  Worker:         ${workerEmail}`);
  console.log('\n  Additional test companies:');
  for (const acc of quickTestAccounts) {
    console.log(`    ${acc.label}: ${acc.email} / ${acc.phone}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
