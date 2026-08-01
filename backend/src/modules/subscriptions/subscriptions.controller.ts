import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { SystemRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatsLimit?: number;
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('companies/:companyId/subscription')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  find(@TenantId() companyId: string) {
    return this.subscriptionsService.findForCompany(companyId);
  }

  @Patch()
  @Roles(SystemRole.SUPER_ADMIN)
  update(@TenantId() companyId: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(companyId, dto);
  }
}
