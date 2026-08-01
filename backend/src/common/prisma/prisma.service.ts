import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a Nest injectable, managing connection lifecycle.
 * All tenant-scoped queries MUST filter by companyId at the query-builder
 * level (see BaseTenantRepository pattern used by module services) rather
 * than relying on application logic alone.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
