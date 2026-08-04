import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { SystemRole } from '@prisma/client';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: any;
    refreshToken: any;
    passwordResetToken: any;
  };

  const mockUser = {
    id: 'user-1',
    companyId: 'company-a',
    email: 'worker@company-a.com',
    phone: '+966500000000',
    systemRole: SystemRole.WORKER,
    isActive: true,
    passwordHash: '',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('CorrectPassw0rd!', 4); // low rounds for test speed

    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(mockUser),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('issues access + refresh tokens for valid credentials', async () => {
      const result = await authService.login(
        { email: mockUser.email, password: 'CorrectPassw0rd!' },
        { userAgent: 'jest', ipAddress: '127.0.0.1' },
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(20);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an incorrect password without revealing which field was wrong', async () => {
      await expect(
        authService.login(
          { email: mockUser.email, password: 'wrong-password' },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login for a deactivated user', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ ...mockUser, isActive: false });
      await expect(
        authService.login({ email: mockUser.email, password: 'CorrectPassw0rd!' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login for a non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        authService.login({ email: 'nobody@nowhere.com', password: 'x' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('logs in via PHONE instead of email when phone is provided (no email at all needed)', async () => {
      const result = await authService.login(
        { phone: mockUser.phone, password: 'CorrectPassw0rd!' } as any,
        {},
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ phone: mockUser.phone }) }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects when NEITHER email nor phone is provided', async () => {
      await expect(authService.login({ password: 'CorrectPassw0rd!' } as any, {})).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('test accounts (testing-phase convenience, hard-gated)', () => {
    const originalEnv = process.env.ENABLE_TEST_ACCOUNTS;

    afterEach(() => {
      process.env.ENABLE_TEST_ACCOUNTS = originalEnv;
    });

    it('listTestAccounts() REJECTS when ENABLE_TEST_ACCOUNTS is unset (the default/production state)', async () => {
      delete process.env.ENABLE_TEST_ACCOUNTS;
      await expect(authService.listTestAccounts()).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('listTestAccounts() REJECTS when the flag is any value other than the exact string "true"', async () => {
      process.env.ENABLE_TEST_ACCOUNTS = 'yes';
      await expect(authService.listTestAccounts()).rejects.toThrow(UnauthorizedException);
    });

    it('listTestAccounts() never exposes passwordHash — only safe display fields', async () => {
      process.env.ENABLE_TEST_ACCOUNTS = 'true';
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@b.com', phone: '+966500000000', firstName: 'A', lastName: 'B', systemRole: 'WORKER', company: { id: 'c1', name: 'Co' } },
      ]);

      const result = await authService.listTestAccounts();

      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0].label).toContain('Co');
    });

    it('testAccountLogin() REJECTS when the flag is off, even for a real user id', async () => {
      delete process.env.ENABLE_TEST_ACCOUNTS;
      await expect(authService.testAccountLogin('user-1', {})).rejects.toThrow(UnauthorizedException);
    });

    it('testAccountLogin() issues real tokens WITHOUT any password check when the flag is on', async () => {
      process.env.ENABLE_TEST_ACCOUNTS = 'true';
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.testAccountLogin('user-1', {});

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('testAccountLogin() rejects a deactivated user even with the flag on', async () => {
      process.env.ENABLE_TEST_ACCOUNTS = 'true';
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(authService.testAccountLogin('user-1', {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh (token rotation)', () => {
    it('rejects a refresh token that was already revoked (prevents replay)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: new Date(), // already revoked
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      });

      await expect(authService.refresh('some-raw-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expired
        user: mockUser,
      });

      await expect(authService.refresh('some-raw-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the old token and issues a new one on successful refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      });

      const result = await authService.refresh('valid-raw-token', {});

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1); // the rotated replacement
    });
  });

  describe('changePassword', () => {
    it('invalidates all existing sessions after a password change', async () => {
      prisma.user.findFirst = undefined; // not used here
      (prisma as any).user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (prisma as any).user.update = jest.fn().mockResolvedValue(mockUser);

      await authService.changePassword(mockUser.id, 'CorrectPassw0rd!', 'NewPassw0rd!');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('requestPasswordReset — phone-inclusive lookup', () => {
    it('finds the account by EITHER email or phone in a single OR query, not email exclusively', async () => {
      await authService.requestPasswordReset('+966501234567');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: '+966501234567' }, { phone: '+966501234567' }], isActive: true },
      });
    });

    it('creates a reset token when the identifier matches (regardless of whether it was an email or a phone)', async () => {
      await authService.requestPasswordReset('+966501234567');

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: mockUser.id }) }),
      );
    });

    it('returns the identical generic message whether or not an account was found — never leaks existence', async () => {
      const foundResult = await authService.requestPasswordReset('+966501234567');

      prisma.user.findFirst = jest.fn().mockResolvedValue(null);
      const notFoundResult = await authService.requestPasswordReset('nobody@nowhere.com');

      expect(foundResult.message).toBe(notFoundResult.message);
    });
  });
});
