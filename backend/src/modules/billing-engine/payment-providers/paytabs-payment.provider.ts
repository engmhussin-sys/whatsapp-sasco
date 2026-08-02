import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/** Real implementation — PayTabs (popular MENA gateway) Payment Request API. */
@Injectable()
export class PayTabsPaymentProvider implements PaymentProvider {
  readonly gatewayType = 'PAYTABS';
  private readonly logger = new Logger(PayTabsPaymentProvider.name);

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'PayTabs profile ID / server key not configured' };
    }
    const response = await fetch('https://secure.paytabs.sa/payment/request', {
      method: 'POST',
      headers: { Authorization: config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: config.merchantId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: request.invoiceId ?? request.companyId,
        cart_currency: request.currency,
        cart_amount: request.amount,
        cart_description: request.description,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { tran_ref?: string; payment_result?: { response_status?: string; response_message?: string } };
    if (!response.ok) {
      this.logger.error(`PayTabs charge failed: ${response.status}`);
      return { success: false, gatewayReference: data.tran_ref ?? null, rawStatus: 'FAILED', failureReason: data.payment_result?.response_message };
    }
    const succeeded = data.payment_result?.response_status === 'A';
    return { success: succeeded, gatewayReference: data.tran_ref ?? null, rawStatus: data.payment_result?.response_status ?? 'unknown' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey || !config.merchantId) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'PayTabs not configured' };
    }
    const response = await fetch('https://secure.paytabs.sa/payment/request', {
      method: 'POST',
      headers: { Authorization: config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: config.merchantId,
        tran_type: 'refund',
        tran_class: 'ecom',
        tran_ref: request.gatewayReference,
        cart_amount: request.amount,
        cart_currency: request.currency,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { tran_ref?: string; payment_result?: { response_status?: string } };
    return { success: response.ok, gatewayReference: data.tran_ref ?? null, rawStatus: data.payment_result?.response_status ?? 'unknown' };
  }
}
