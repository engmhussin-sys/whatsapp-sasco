import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { SubscriptionManagerService } from './subscription-manager.service';
import { UsageEngineService } from './usage-engine.service';
import { FeatureEngineService } from './feature-engine.service';
import { TokenWalletService } from './token-wallet.service';
import { InvoiceEngineService } from './invoice-engine.service';
import { CouponService } from './coupon.service';
import {
  SubscribeDto,
  RecordUsageDto,
  GenerateInvoiceDto,
  ValidateCouponDto,
  CreateWebhookEndpointDto,
  TokenWalletTxDto,
} from './dto/billing-engine.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('billing-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/billing')
export class BillingEngineController {
  constructor(
    private subscriptionManager: SubscriptionManagerService,
    private usageEngine: UsageEngineService,
    private featureEngine: FeatureEngineService,
    private tokenWallet: TokenWalletService,
    private invoiceEngine: InvoiceEngineService,
    private coupons: CouponService,
    private prisma: PrismaService,
  ) {}

  // ---- Subscription -----------------------------------------------------
  @Get('subscription')
  getSubscription(@TenantId() companyId: string) {
    return this.subscriptionManager.getSubscription(companyId);
  }

  @Post('subscription')
  @Roles(SystemRole.SUPER_ADMIN)
  subscribe(@TenantId() companyId: string, @Body() dto: SubscribeDto) {
    return this.subscriptionManager.subscribe(companyId, dto.planCode, dto.periodMonths);
  }

  @Post('subscription/renew')
  @Roles(SystemRole.SUPER_ADMIN)
  renew(@TenantId() companyId: string) {
    return this.subscriptionManager.renew(companyId);
  }

  @Post('subscription/cancel')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  cancel(@TenantId() companyId: string) {
    return this.subscriptionManager.cancel(companyId);
  }

  // ---- Feature access / Usage --------------------------------------------
  @Get('features/:code/access')
  checkFeatureAccess(@TenantId() companyId: string, @Param('code') code: string) {
    return this.featureEngine.checkAccess(companyId, code);
  }

  @Post('usage')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  recordUsage(@TenantId() companyId: string, @Body() dto: RecordUsageDto) {
    return this.usageEngine.recordUsage(companyId, dto.featureCode, dto.amount);
  }

  @Get('usage')
  getUsageSummary(@TenantId() companyId: string) {
    return this.usageEngine.getUsageSummary(companyId);
  }

  // ---- Token Wallet -------------------------------------------------------
  @Get('wallet')
  getWallet(@TenantId() companyId: string) {
    return this.tokenWallet.getOrCreateWallet(companyId);
  }

  @Get('wallet/transactions')
  getWalletTransactions(@TenantId() companyId: string) {
    return this.tokenWallet.listTransactions(companyId);
  }

  @Post('wallet/credit')
  @Roles(SystemRole.SUPER_ADMIN)
  creditWallet(@TenantId() companyId: string, @Body() dto: TokenWalletTxDto) {
    return this.tokenWallet.credit(companyId, dto.amount, dto.reason);
  }

  // ---- Invoices ------------------------------------------------------------
  @Post('invoices/generate')
  @Roles(SystemRole.SUPER_ADMIN)
  generateInvoice(@TenantId() companyId: string, @Body() dto: GenerateInvoiceDto) {
    return this.invoiceEngine.generateInvoice(companyId, dto);
  }

  @Get('invoices')
  listInvoices(@TenantId() companyId: string) {
    return this.invoiceEngine.listForCompany(companyId);
  }

  @Post('invoices/:id/issue')
  @Roles(SystemRole.SUPER_ADMIN)
  issueInvoice(@Param('id') id: string) {
    return this.invoiceEngine.issue(id);
  }

  // ---- Coupons --------------------------------------------------------------
  @Post('coupons/validate')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.coupons.validate(dto.code, dto.subtotal);
  }

  // ---- Webhooks --------------------------------------------------------------
  @Get('webhooks')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  listWebhooks(@TenantId() companyId: string) {
    return this.prisma.webhookEndpoint.findMany({ where: { companyId } });
  }

  @Post('webhooks')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  createWebhook(@TenantId() companyId: string, @Body() dto: CreateWebhookEndpointDto) {
    return this.prisma.webhookEndpoint.create({
      data: { companyId, url: dto.url, events: dto.events, secret: randomBytes(24).toString('hex') },
    });
  }
}
