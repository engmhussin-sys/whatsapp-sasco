import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
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
              { phone: { contains: params.search, mode: 'insensitive' as const } },
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

  /**
   * SECURITY FIX: this endpoint previously had NO caller check at all —
   * any authenticated user could PATCH any OTHER user's row, including
   * `isActive` (disable/enable someone else's account). Two legitimate
   * callers exist: (1) a COMPANY_ADMIN/SUPER_ADMIN managing any user's
   * full profile, (2) a user updating their OWN preferredLanguage
   * (self-service, added in T5) — everything else must be rejected.
   */
  async update(companyId: string, id: string, dto: UpdateUserDto, requestingUser: AuthenticatedUser) {
    const isAdmin = requestingUser.systemRole === SystemRole.COMPANY_ADMIN || requestingUser.systemRole === SystemRole.SUPER_ADMIN;
    const isSelf = requestingUser.sub === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('You can only update your own profile');
    }

    if (!isAdmin && isSelf) {
      const allowedSelfFields = new Set(['preferredLanguage']);
      const attemptedFields = Object.keys(dto);
      const disallowed = attemptedFields.filter((f) => !allowedSelfFields.has(f));
      if (disallowed.length > 0) {
        throw new ForbiddenException(`You are not allowed to change: ${disallowed.join(', ')}`);
      }
    }

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
    companyId: true,
  };
}
