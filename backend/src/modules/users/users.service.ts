import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

/**
 * NOTE ON TENANT ISOLATION:
 * Every query in this service is explicitly scoped with `companyId`,
 * even though TenantGuard already validates the caller's right to act
 * within that company. This "belt and suspenders" pattern (defense in
 * depth) is mandatory across all modules — never trust the guard alone.
 */
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
    });
    if (existing) throw new ConflictException('A user with this email already exists in this company');

    // Enterprise onboarding: the worker never sets their own initial
    // password — if the admin didn't supply one, generate a random,
    // never-communicated placeholder hash. It is cryptographically
    // unguessable and login is impossible until OnboardingService
    // overwrites it with the worker's own PIN/password during activation.
    const passwordHash = await this.authService.hashPassword(dto.password ?? randomBytes(24).toString('hex'));

    const role = dto.systemRole ?? SystemRole.WORKER;
    // Only the worker-facing roles go through OTP activation; a
    // Company Admin created via this endpoint (rare — normally done via
    // CompaniesService.create) is assumed to set their own credentials
    // immediately and is active right away.
    const status = role === SystemRole.COMPANY_ADMIN ? UserStatus.ACTIVE : UserStatus.INVITED;

    return this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        systemRole: role,
        status,
        preferredLanguage: dto.preferredLanguage ?? 'en',
        preferences: { create: {} },
      },
      select: this.publicSelect,
    });
  }

  async findAll(companyId: string, params: { skip?: number; take?: number; search?: string }) {
    const where = {
      companyId,
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' as const } },
              { lastName: { contains: params.search, mode: 'insensitive' as const } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 25,
        select: this.publicSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: this.publicSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(companyId, id); // ensures tenant ownership
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.publicSelect,
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-disable rather than hard delete, preserving message history integrity.
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: this.publicSelect,
    });
  }

  private readonly publicSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    avatarUrl: true,
    systemRole: true,
    isActive: true,
    status: true,
    preferredLanguage: true,
    createdAt: true,
    lastLoginAt: true,
  };
}
