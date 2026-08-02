import { Module } from '@nestjs/common';
import { FeatureEngineService } from './feature-engine.service';
import { UsageEngineService } from './usage-engine.service';
import { TokenWalletService } from './token-wallet.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { StripePaymentProvider } from './payment-providers/stripe-payment.provider';
import { HyperPayPaymentProvider } from './payment-providers/hyperpay-payment.provider';
import { PayTabsPaymentProvider } from './payment-providers/paytabs-payment.provider';
import { MyFatoorahPaymentProvider } from './payment-providers/myfatoorah-payment.provider';
import { MoyasarPaymentProvider } from './payment-providers/moyasar-payment.provider';
import { StcPayPaymentProvider } from './payment-providers/stcpay-payment.provider';

/**
 * STANDALONE, REUSABLE ENGINE — zero imports from any WorkForce-Connect-
 * specific module. This is Phase 1 of the Billing Engine (Feature
 * Engine, Usage Engine, Token Wallet, Payment Provider Strategy Pattern)
 * — Invoice Engine, Coupons/Promotions, Subscription Manager CRUD, and
 * Webhooks are tracked as remaining work (see the delivery report), not
 * silently omitted.
 */
@Module({
  providers: [
    FeatureEngineService,
    UsageEngineService,
    TokenWalletService,
    StripePaymentProvider,
    HyperPayPaymentProvider,
    PayTabsPaymentProvider,
    MyFatoorahPaymentProvider,
    MoyasarPaymentProvider,
    StcPayPaymentProvider,
    PaymentProviderRegistry,
  ],
  exports: [FeatureEngineService, UsageEngineService, TokenWalletService, PaymentProviderRegistry],
})
export class BillingEngineModule {}
