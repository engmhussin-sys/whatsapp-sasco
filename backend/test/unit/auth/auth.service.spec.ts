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
  };

  const mockUser = {
    id: 'user-1',
    companyId: 'company-a',
    email: 'worker@company-a.com',
    systemRole: SystemRole.WORKER,
    isActive: true,
    passwordHash: '',
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('CorrectPassw0rd!', 4); // low rounds for test speed

    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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
});
