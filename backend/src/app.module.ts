import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { VoiceProcessingModule } from './modules/voice-processing/voice-processing.module';
import { ChatGatewayModule } from './modules/websocket/chat-gateway.module';
import { ApprovalEngineModule } from './modules/approval-engine/approval-engine.module';
import { TaskEngineModule } from './modules/task-engine/task-engine.module';
import { ShiftManagementModule } from './modules/shift-management/shift-management.module';
import { StationsModule } from './modules/stations/stations.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { FuelRequestsModule } from './modules/fuel-requests/fuel-requests.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { ChatPolicyModule } from './modules/chat-policy/chat-policy.module';
import { CompanyDictionaryModule } from './modules/company-dictionary/company-dictionary.module';
import { TranslationEngineModule } from './modules/translation-engine/translation-engine.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    RolesPermissionsModule,
    TeamsModule,
    ConversationsModule,
    MessagesModule,
    LanguagesModule,
    SubscriptionsModule,
    AuditLogsModule,
    VoiceProcessingModule,
    ChatGatewayModule,
    ApprovalEngineModule,
    TaskEngineModule,
    ShiftManagementModule,
    StationsModule,
    InspectionsModule,
    FuelRequestsModule,
    OnboardingModule,
    DepartmentsModule,
    DirectoryModule,
    ChatPolicyModule,
    CompanyDictionaryModule,
    TranslationEngineModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guard order matters: authenticate -> resolve tenant -> check role/permission
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
