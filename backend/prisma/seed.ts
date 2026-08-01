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
import { PrismaClient, SystemRole, TaskFieldType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@12345'; // same for every seeded account — change immediately in production use

async function hash(plain: string) {
  return bcrypt.hash(plain, 12);
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

  // ---- Super Admin (platform-level, companyId = null) -----------------------
  const superAdminEmail = 'superadmin@workforceconnect.ai';
  const superAdmin = await prisma.user.upsert({
    where: { id: 'seed-super-admin' }, // stable id so re-running the seed is idempotent
    create: {
      id: 'seed-super-admin',
      email: superAdminEmail,
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
      supportedLanguages: { create: [{ langCode: 'ar' }, { langCode: 'en' }] },
    },
    update: {},
  });

  const companyAdminEmail = 'admin@demo-fuel-co.com';
  const companyAdmin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: companyAdminEmail } },
    create: {
      companyId: company.id,
      email: companyAdminEmail,
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
  if (!existingTemplate) {
    await prisma.taskTemplate.create({
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
    });
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

  console.log('\nSeed complete. Demo accounts (all use the same password):');
  console.log(`  Password for every account below: ${DEMO_PASSWORD}\n`);
  console.log(`  Super Admin:    ${superAdminEmail}`);
  console.log(`  Company Admin:  ${companyAdminEmail}  (companyId: ${company.id})`);
  console.log(`  Team Lead:      ${teamLeadEmail}`);
  console.log(`  Worker:         ${workerEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
