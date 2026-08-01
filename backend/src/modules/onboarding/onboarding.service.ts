import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CredentialType, OtpChannel, UserStatus, AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const ACTIVATION_TOKEN_PURPOSE = 'activation';

/**
 * ENTERPRISE ONBOARDING — the worker never self-registers. A Company
 * Admin/HR creates the User record (status=INVITED, unusable random
 * password — see UsersService.create) with the worker's real email
 * and/or phone. This service is the ONLY path that turns that INVITED
 * account into an ACTIVE, loginable one, via three steps:
 *
 *   1. requestOtp()   — worker proves they own the registered email/phone
 *   2. verifyOtp()     — exchanges a correct OTP for a short-lived
 *                        "activation token" (a purpose-scoped JWT)
 *   3. setCredentials() — worker sets their own PIN/password using that
 *                        activation token; account flips to ACTIVE
 *
 * Biometric (Face ID/Fingerprint) is intentionally NOT part of this
 * backend flow — it's a device-local unlock gate the mobile app enables
 * AFTER a normal login, layered on top of the session already issued by
 * AuthService. The backend has no biometric data and doesn't need any;
 * see mobile/README.md's onboarding section for the client-side wiring.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditLogs: AuditLogsService,
  ) {}

  private async findInvitedUser(email: string, companyId?: string) {
    return this.prisma.user.findFirst({
      where: { email, status: UserStatus.INVITED, ...(companyId ? { companyId } : {}) },
    });
  }

  async requestOtp(email: string, channel: OtpChannel, companyId?: string) {
    const user = await this.findInvitedUser(email, companyId);

    // SECURITY: never reveal whether the email exists or is already
    // activated — identical response either way (mirrors AuthService's
    // forgot-password behavior).
    const genericResponse = { message: 'إذا كان الحساب موجودًا وبانتظار التفعيل، تم إرسال رمز التحقق.' };
    if (!user) return genericResponse;

    if (channel === OtpChannel.PHONE && !user.phone) {
      throw new BadRequestException('لا يوجد رقم هاتف مسجَّل لهذا الحساب — استخدم البريد الإلكتروني بدلاً من ذلك');
    }

    const code = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const destination = channel === OtpChannel.PHONE ? user.phone! : user.email;

    await this.prisma.otpToken.create({
      data: {
        userId: user.id,
        channel,
        destination,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    // NOTE (Phase 1 limitation, same pattern as password-reset emails and
    // voice-processing providers): no SMS/email delivery provider is wired
    // up yet. The code is logged server-side so the activation flow is
    // fully testable end-to-end. Wiring a real provider (Twilio for SMS,
    // SendGrid/SES for email) replaces this one log line only.
    this.logger.warn(`[DEV ONLY — no ${channel} provider configured] Activation OTP for ${destination}: ${code}`);

    return genericResponse;
  }

  async verifyOtp(email: string, code: string, companyId?: string) {
    const user = await this.findInvitedUser(email, companyId);
    if (!user) throw new UnauthorizedException('رمز التحقق غير صحيح');

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const otp = await this.prisma.otpToken.findFirst({
      where: { userId: user.id, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('رمز التحقق غير صحيح أو منتهي الصلاحية');
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new ForbiddenException('عدد محاولات إدخال الرمز تجاوز الحد المسموح — اطلب رمزًا جديدًا');
    }

    if (otp.codeHash !== codeHash) {
      await this.prisma.otpToken.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }

    await this.prisma.otpToken.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });

    const activationToken = this.jwt.sign(
      { sub: user.id, email: user.email, purpose: ACTIVATION_TOKEN_PURPOSE },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '10m' },
    );

    return { activationToken };
  }

  async setCredentials(
    email: string,
    activationToken: string,
    credentialType: CredentialType,
    credential: string,
  ) {
    let payload: { sub: string; email: string; purpose: string };
    try {
      payload = this.jwt.verify(activationToken, { secret: this.config.get('JWT_ACCESS_SECRET') });
    } catch {
      throw new UnauthorizedException('رمز التفعيل غير صالح أو منتهي الصلاحية — يجب التحقق من رمز OTP مجددًا');
    }

    if (payload.purpose !== ACTIVATION_TOKEN_PURPOSE || payload.email !== email) {
      throw new UnauthorizedException('رمز التفعيل غير صالح لهذا الحساب');
    }

    if (credentialType === CredentialType.PASSWORD && credential.length < 8) {
      throw new BadRequestException('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل');
    }
    if (credentialType === CredentialType.PIN && !/^\d{4,8}$/.test(credential)) {
      throw new BadRequestException('يجب أن يتكون الـ PIN من 4 إلى 8 أرقام فقط');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.INVITED) {
      throw new BadRequestException('هذا الحساب مُفعَّل بالفعل أو غير موجود');
    }

    const passwordHash = await this.authService.hashPassword(credential);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, credentialType, status: UserStatus.ACTIVE },
    });

    await this.auditLogs.record({
      companyId: user.companyId,
      actorId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      metadata: { event: 'account_activated', credentialType },
    });

    return { message: 'تم تفعيل الحساب بنجاح — يمكنك تسجيل الدخول الآن' };
  }
}
