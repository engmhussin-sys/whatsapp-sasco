import { Controller, Get } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TokenWalletService } from './token-wallet.service';

/**
 * "استهلاك الذكاء" screen — platform-wide, so it doesn't fit under
 * BillingEngineController's `companies/:companyId/billing` scope. Reuses
 * TokenWalletService rather than duplicating its query logic.
 */
@Roles(SystemRole.SUPER_ADMIN)
@Controller('platform-ai-usage')
export class PlatformAiUsageController {
  constructor(private tokenWallet: TokenWalletService) {}

  @Get()
  getSummary() {
    return this.tokenWallet.getPlatformUsageSummary();
  }
}
