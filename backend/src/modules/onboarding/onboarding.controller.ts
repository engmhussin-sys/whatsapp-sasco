import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OnboardingService } from './onboarding.service';
import {
  RequestActivationOtpDto,
  VerifyActivationOtpDto,
  SetActivationCredentialsDto,
} from './dto/onboarding.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private service: OnboardingService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestActivationOtpDto) {
    return this.service.requestOtp(dto.email, dto.channel, dto.companyId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyActivationOtpDto) {
    return this.service.verifyOtp(dto.email, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-credentials')
  @HttpCode(HttpStatus.OK)
  setCredentials(@Body() dto: SetActivationCredentialsDto) {
    return this.service.setCredentials(dto.email, dto.activationToken, dto.credentialType, dto.credential);
  }
}
