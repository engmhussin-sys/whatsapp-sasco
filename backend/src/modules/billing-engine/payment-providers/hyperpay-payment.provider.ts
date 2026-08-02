import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/** Real implementation — HyperPay (MENA gateway, widely used for Mada/Visa/Mastercard/Apple Pay in Saudi) Checkout API. */
@Injectable()
export class HyperPayPaymentProvider implements PaymentProvider {
  readonly gatewayType = 'HYPERPAY';
  private readonly logger = new Logger(HyperPayPaymentProvider.name);

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'HyperPay access token / entity ID not configured' };
    }
    const body = new URLSearchParams({
      entityId: config.merchantId,
      amount: request.amount.toFixed(2),
      currency: request.currency,
      paymentType: 'DB',
      merchantTransactionId: request.invoiceId ?? request.companyId,
    });
    const response = await fetch('https://eu-prod.oppwa.com/v1/checkouts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; result?: { code?: string; description?: string } };
    if (!response.ok) {
      this.logger.error(`HyperPay checkout failed: ${data.result?.description}`);
      return { success: false, gatewayReference: data.id ?? null, rawStatus: 'FAILED', failureReason: data.result?.description };
    }
    // HyperPay's checkout endpoint returns a checkout id to be completed
    // client-side (widget/redirect) — success here means "session
    // created", not "money captured"; final status comes via the
    // Payment Status endpoint / webhook, handled by the Webhook Engine.
    return { success: true, gatewayReference: data.id ?? null, rawStatus: data.result?.code ?? 'pending' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'HyperPay not configured' };
    }
    const body = new URLSearchParams({ entityId: config.merchantId, amount: request.amount.toFixed(2), currency: request.currency, paymentType: 'RF' });
    const response = await fetch(`https://eu-prod.oppwa.com/v1/payments/${request.gatewayReference}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; result?: { code?: string } };
    return { success: response.ok, gatewayReference: data.id ?? request.gatewayReference, rawStatus: data.result?.code ?? 'unknown' };
  }
}
