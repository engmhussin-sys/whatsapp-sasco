import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { LoginDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  private async issueTokens(user: {
    id: string;
    companyId: string | null;
    systemRole: any;
    email: string;
  }, meta: { userAgent?: string; ipAddress?: string }) {
    const payload: AuthenticatedUser = {
      sub: user.id,
      companyId: user.companyId,
      systemRole: user.systemRole,
      email: user.email,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    // Refresh tokens are opaque random strings, stored server-side as a
    // hash only (never store the raw token). This allows revocation and
    // limits blast radius if the DB leaks.
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiresInDays = 30;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }) {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException('Either email or phone is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        ...(dto.email ? { email: dto.email } : { phone: dto.phone }),
        ...(dto.companyId ? { companyId: dto.companyId } : {}),
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'INVITED') {
      throw new UnauthorizedException(
        'Account not yet activated — complete OTP activation first (see /onboarding/activate)',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user, meta);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
        companyId: user.companyId,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  /**
   * TESTING-PHASE CONVENIENCE ONLY — hard-gated behind ENABLE_TEST_ACCOUNTS.
   * Both methods below no-op (throw) unless that env var is explicitly set
   * to "true", so there is zero risk of this ever being reachable in a real
   * deployment unless someone deliberately flips it on. Never exposes
   * password hashes or any secret — only id/label/email/phone/role, and the
   * login path issues real tokens WITHOUT checking a password at all (that's
   * the whole point — one click, no credential to remember during testing).
   */
  private assertTestAccountsEnabled() {
    if (process.env.ENABLE_TEST_ACCOUNTS !== 'true') {
      throw new UnauthorizedException('Test accounts are not enabled on this environment');
    }
  }

  async listTestAccounts() {
    this.assertTestAccountsEnabled();
    const users = await this.prisma.user.findMany({
      where: { isActive: true, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        systemRole: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ company: { name: 'asc' } }, { systemRole: 'asc' }],
    });
    return users.map((u: (typeof users)[number]) => ({
      id: u.id,
      label: `${u.firstName} ${u.lastName} — ${u.systemRole}${u.company ? ` @ ${u.company.name}` : ' (platform)'}`,
      email: u.email,
      phone: u.phone,
      role: u.systemRole,
      companyName: u.company?.name ?? null,
    }));
  }

  async testAccountLogin(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
    this.assertTestAccountsEnabled();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Test account not found or inactive');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user, meta);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
        companyId: user.companyId,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  async refresh(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotate: revoke old, issue new (mitigates replay attacks).
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, meta);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate all existing sessions on password change.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }], isActive: true },
    });

    // SECURITY: never reveal whether the account exists — always return
    // the same generic result regardless of whether a user was found.
    if (!user) {
      return { message: 'إن كان الحساب موجودًا، فقد أُرسِل رابط إعادة التعيين.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // NOTE (Phase 1 limitation): no transactional email/SMS provider is
    // wired up yet — this mirrors the same "interface ready, provider
    // stubbed" pattern used for Voice Processing in Phase 2 planning.
    // For now the raw token is logged server-side so the flow is fully
    // testable end-to-end; wiring a real provider (SendGrid/SES for
    // email, Twilio/similar for SMS) is a drop-in replacement of this
    // one log line, nothing else changes — and now it correctly covers
    // BOTH delivery paths, not just email.
    this.logger.warn(`[DEV ONLY — no email/SMS provider configured] Password reset token for ${identifier}: ${rawToken}`);

    return { message: 'إن كان الحساب موجودًا، فقد أُرسِل رابط إعادة التعيين.' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset link is invalid or has expired');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
