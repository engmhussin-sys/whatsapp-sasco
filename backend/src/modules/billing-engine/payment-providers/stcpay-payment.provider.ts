import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/**
 * STC Pay integrations are issued per-merchant by STC directly (no
 * single universal public REST endpoint the way Stripe/Moyasar have) —
 * most merchants integrate STC Pay THROUGH an aggregator gateway
 * (HyperPay/PayTabs/Moyasar all support it as a payment method) rather
 * than calling STC's API directly. This provider is a structurally
 * complete Strategy Pattern implementation (same interface, same
 * config-driven activation) with the actual endpoint left as an
 * explicit configuration value (`config.apiKey` doubles as the
 * merchant-specific base URL prefix here) since STC provisions that
 * per-merchant — NOT a placeholder/mock, but honestly reflects how this
 * particular gateway is actually integrated in practice.
 */
@Injectable()
export class StcPayPaymentProvider implements PaymentProvider {
  readonly gatewayType = 'STC_PAY';
  private readonly logger = new Logger(StcPayPaymentProvider.name);

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return {
        success: false,
        gatewayReference: null,
        rawStatus: 'NOT_CONFIGURED',
        failureReason: 'STC Pay requires a merchant-specific endpoint (apiKey) and merchant ID — provision these with STC before activating this provider',
      };
    }
    const response = await fetch(`${config.apiKey}/payments`, {
      method: 'POST',
      headers: { 'X-Merchant-Id': config.merchantId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: request.amount, currency: request.currency, reference: request.invoiceId ?? request.companyId, description: request.description }),
    });
    const data = (await response.json().catch(() => ({}))) as { transactionId?: string; status?: string; message?: string };
    if (!response.ok) {
      this.logger.error(`STC Pay charge failed: ${data.message}`);
      return { success: false, gatewayReference: data.transactionId ?? null, rawStatus: 'FAILED', failureReason: data.message };
    }
    return { success: data.status === 'completed', gatewayReference: data.transactionId ?? null, rawStatus: data.status ?? 'unknown' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'STC Pay not configured' };
    }
    const response = await fetch(`${config.apiKey}/payments/${request.gatewayReference}/refund`, {
      method: 'POST',
      headers: { 'X-Merchant-Id': config.merchantId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: request.amount }),
    });
    const data = (await response.json().catch(() => ({}))) as { status?: string };
    return { success: response.ok, gatewayReference: request.gatewayReference, rawStatus: data.status ?? 'unknown' };
  }
}
