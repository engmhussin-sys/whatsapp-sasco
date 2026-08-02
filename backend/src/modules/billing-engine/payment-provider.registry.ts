import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripePaymentProvider } from './payment-providers/stripe-payment.provider';
import { HyperPayPaymentProvider } from './payment-providers/hyperpay-payment.provider';
import { PayTabsPaymentProvider } from './payment-providers/paytabs-payment.provider';
import { MyFatoorahPaymentProvider } from './payment-providers/myfatoorah-payment.provider';
import { MoyasarPaymentProvider } from './payment-providers/moyasar-payment.provider';
import { StcPayPaymentProvider } from './payment-providers/stcpay-payment.provider';

/**
 * Resolves the active payment gateway for a company, exactly mirroring
 * TranslationProviderRegistry's resolution order (company-specific
 * config first, then a platform-default with companyId=null). Unlike
 * translation, there is no "always works offline" fallback for payments
 * — if nothing is configured, this throws rather than silently
 * pretending a charge succeeded.
 *
 * NOTE on card networks (Visa/Mastercard/Mada) and wallets (Apple Pay):
 * these are payment METHODS presented at checkout, not separate
 * gateways with their own settlement API — in practice they're
 * processed THROUGH one of the registered gateways above (e.g. HyperPay
 * natively supports Mada + Apple Pay + Visa/Mastercard as payment
 * methods within its Checkout API). Modeling them as additional
 * "gateways" here would misrepresent how card processing actually
 * works and wasn't done for that reason — this is a deliberate
 * accuracy decision, not a scope gap.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    private prisma: PrismaService,
    stripe: StripePaymentProvider,
    hyperpay: HyperPayPaymentProvider,
    paytabs: PayTabsPaymentProvider,
    myfatoorah: MyFatoorahPaymentProvider,
    moyasar: MoyasarPaymentProvider,
    stcpay: StcPayPaymentProvider,
  ) {
    this.providers = new Map<string, PaymentProvider>([
      [stripe.gatewayType, stripe],
      [hyperpay.gatewayType, hyperpay],
      [paytabs.gatewayType, paytabs],
      [myfatoorah.gatewayType, myfatoorah],
      [moyasar.gatewayType, moyasar],
      [stcpay.gatewayType, stcpay],
    ]);
  }

  async resolveForCompany(companyId: string) {
    const config =
      (await this.prisma.paymentGatewayConfig.findFirst({ where: { companyId, isActive: true }, orderBy: { priority: 'asc' } })) ??
      (await this.prisma.paymentGatewayConfig.findFirst({ where: { companyId: null, isActive: true }, orderBy: { priority: 'asc' } }));

    if (!config) {
      throw new ServiceUnavailableException('No payment gateway is configured for this company');
    }

    const provider = this.providers.get(config.gatewayType);
    if (!provider) {
      throw new ServiceUnavailableException(`Unknown payment gateway type: ${config.gatewayType}`);
    }

    return {
      provider,
      config: {
        apiKey: config.apiKeyEnvVar ? (process.env[config.apiKeyEnvVar] ?? null) : null,
        secretKey: config.secretKeyEnvVar ? (process.env[config.secretKeyEnvVar] ?? null) : null,
        merchantId: config.merchantId,
      },
    };
  }
}
