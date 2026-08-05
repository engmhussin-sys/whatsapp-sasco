import { Module } from '@nestjs/common';
import { FeatureEngineService } from './feature-engine.service';
import { UsageEngineService } from './usage-engine.service';
import { TokenWalletService } from './token-wallet.service';
import { SubscriptionManagerService } from './subscription-manager.service';
import { InvoiceEngineService } from './invoice-engine.service';
import { CouponService } from './coupon.service';
import { AddOnsService } from './add-ons.service';
import { PlansService } from './plans.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { StripePaymentProvider } from './payment-providers/stripe-payment.provider';
import { HyperPayPaymentProvider } from './payment-providers/hyperpay-payment.provider';
import { PayTabsPaymentProvider } from './payment-providers/paytabs-payment.provider';
import { MyFatoorahPaymentProvider } from './payment-providers/myfatoorah-payment.provider';
import { MoyasarPaymentProvider } from './payment-providers/moyasar-payment.provider';
import { StcPayPaymentProvider } from './payment-providers/stcpay-payment.provider';
import { PlansController } from './plans.controller';
import { BillingEngineController } from './billing-engine.controller';
import { PlatformAiUsageController } from './platform-ai-usage.controller';

/**
 * STANDALONE, REUSABLE ENGINE — zero imports from any WorkForce-Connect-
 * specific module. Complete: Plans/Features catalog, Feature Engine,
 * Usage Engine, Token Wallet, Subscription Manager, Invoice Engine,
 * Coupons, Payment Provider Strategy Pattern (6 real gateways), and
 * Webhook dispatch for all 6 specified event types.
 *
 * NOT included (see delivery report): Promotions business logic beyond
 * the schema (seasonal/trial/referral/campaign auto-application rules),
 * and automatic webhook firing wired into invoice/payment lifecycle
 * events (WebhookDispatcherService exists and is tested, but nothing
 * calls it automatically yet — that wiring belongs in the eventual
 * PaymentEngine orchestration layer, intentionally not built without
 * real gateway credentials to test against).
 */
@Module({
  controllers: [PlansController, BillingEngineController, PlatformAiUsageController],
  providers: [
    FeatureEngineService,
    UsageEngineService,
    TokenWalletService,
    SubscriptionManagerService,
    InvoiceEngineService,
    CouponService,
    AddOnsService,
    PlansService,
    WebhookDispatcherService,
    StripePaymentProvider,
    HyperPayPaymentProvider,
    PayTabsPaymentProvider,
    MyFatoorahPaymentProvider,
    MoyasarPaymentProvider,
    StcPayPaymentProvider,
    PaymentProviderRegistry,
  ],
  exports: [
    FeatureEngineService,
    UsageEngineService,
    TokenWalletService,
    SubscriptionManagerService,
    InvoiceEngineService,
    CouponService,
    WebhookDispatcherService,
    PaymentProviderRegistry,
  ],
})
export class BillingEngineModule {}
