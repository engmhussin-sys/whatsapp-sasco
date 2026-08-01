import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CredentialType, OtpChannel, UserStatus } from '@prisma/client';
import { OnboardingService } from '../../../src/modules/onboarding/onboarding.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';

describe('OnboardingService — Enterprise OTP Activation Flow', () => {
  let service: OnboardingService;
  let prisma: any;
  let jwt: any;

  const invitedUser = {
    id: 'user-1',
    companyId: 'company-A',
    email: 'worker@company-a.com',
    phone: '+201234567890',
    status: UserStatus.INVITED,
  };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      otpToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.activation.token'), verify: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: { hashPassword: jest.fn().mockResolvedValue('hashed') } },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(OnboardingService);
  });

  describe('requestOtp()', () => {
    it('returns the SAME generic response whether or not the account exists (no enumeration)', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      const r1 = await service.requestOtp('nobody@nowhere.com', OtpChannel.EMAIL);

      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.create.mockResolvedValueOnce({});
      const r2 = await service.requestOtp('worker@company-a.com', OtpChannel.EMAIL);

      expect(r1.message).toBe(r2.message);
    });

    it('rejects PHONE channel when the invited user has no phone on file', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ ...invitedUser, phone: null });
      await expect(service.requestOtp('worker@company-a.com', OtpChannel.PHONE)).rejects.toThrow(BadRequestException);
    });

    it('creates an OtpToken with a hashed (never raw) code', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.create.mockResolvedValueOnce({});
      await service.requestOtp('worker@company-a.com', OtpChannel.EMAIL);

      const createCall = prisma.otpToken.create.mock.calls[0][0];
      expect(createCall.data.codeHash).toBeDefined();
      expect(createCall.data.codeHash.length).toBe(64); // sha256 hex digest
      expect(createCall.data.userId).toBe('user-1');
    });
  });

  describe('verifyOtp()', () => {
    it('REJECTS an incorrect code and increments attempts', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        codeHash: 'a-completely-different-hash',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.verifyOtp('worker@company-a.com', '000000')).rejects.toThrow(UnauthorizedException);
      expect(prisma.otpToken.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('REJECTS after the max attempt count is reached, even with the correct code', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        codeHash: 'anything',
        attempts: 5,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.verifyOtp('worker@company-a.com', '123456')).rejects.toThrow(ForbiddenException);
    });

    it('REJECTS an expired OTP', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        codeHash: 'anything',
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      await expect(service.verifyOtp('worker@company-a.com', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('issues a scoped activation token on success and marks the OTP verified', async () => {
      const correctCode = '654321';
      const correctHash = crypto.createHash('sha256').update(correctCode).digest('hex');

      prisma.user.findFirst.mockResolvedValueOnce(invitedUser);
      prisma.otpToken.findFirst.mockResolvedValueOnce({
        id: 'otp-1',
        codeHash: correctHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.verifyOtp('worker@company-a.com', correctCode);

      expect(result.activationToken).toBe('signed.activation.token');
      expect(prisma.otpToken.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { verifiedAt: expect.any(Date) },
      });
      // The signed payload must be purpose-scoped, not a general-purpose login token.
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'activation', sub: 'user-1' }),
        expect.anything(),
      );
    });
  });

  describe('setCredentials()', () => {
    it('REJECTS a token whose purpose is not "activation" (cannot reuse a normal access token)', async () => {
      jwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'worker@company-a.com', purpose: 'access' });
      await expect(
        service.setCredentials('worker@company-a.com', 'some-token', CredentialType.PASSWORD, 'NewPassw0rd!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('REJECTS a PIN shorter than 4 digits', async () => {
      jwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'worker@company-a.com', purpose: 'activation' });
      prisma.user.findUnique.mockResolvedValueOnce(invitedUser);
      await expect(
        service.setCredentials('worker@company-a.com', 'token', CredentialType.PIN, '12'),
      ).rejects.toThrow(BadRequestException);
    });

    it('REJECTS setting credentials for an already-ACTIVE account (replay protection)', async () => {
      jwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'worker@company-a.com', purpose: 'activation' });
      prisma.user.findUnique.mockResolvedValueOnce({ ...invitedUser, status: UserStatus.ACTIVE });

      await expect(
        service.setCredentials('worker@company-a.com', 'token', CredentialType.PIN, '1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('ACCEPTS a valid PIN and flips the account to ACTIVE', async () => {
      jwt.verify.mockReturnValueOnce({ sub: 'user-1', email: 'worker@company-a.com', purpose: 'activation' });
      prisma.user.findUnique.mockResolvedValueOnce(invitedUser);
      prisma.user.update.mockResolvedValueOnce({});

      await service.setCredentials('worker@company-a.com', 'token', CredentialType.PIN, '4321');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed', credentialType: CredentialType.PIN, status: UserStatus.ACTIVE },
      });
    });
  });
});
