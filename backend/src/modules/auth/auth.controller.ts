import { Body, Controller, Get, Param, Post, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto, RequestPasswordResetDto, ResetPasswordDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }

  // Stricter than the global 120/min: mitigates credential-stuffing / brute-force.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.meta(req));
  }

  // TESTING-PHASE ONLY — both no-op with 401 unless ENABLE_TEST_ACCOUNTS=true
  // on the server. See AuthService for the full safety rationale.
  @Public()
  @Get('test-accounts')
  listTestAccounts() {
    return this.authService.listTestAccounts();
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('test-accounts/:userId/login')
  @HttpCode(HttpStatus.OK)
  testAccountLogin(@Param('userId') userId: string, @Req() req: Request) {
    return this.authService.testAccountLogin(userId, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
