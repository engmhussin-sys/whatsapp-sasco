import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/** Real implementation — Moyasar (Saudi gateway) Payments API. */
@Injectable()
export class MoyasarPaymentProvider implements PaymentProvider {
  readonly gatewayType = 'MOYASAR';
  private readonly logger = new Logger(MoyasarPaymentProvider.name);

  private authHeader(config: PaymentProviderConfig) {
    return `Basic ${Buffer.from(`${config.secretKey}:`).toString('base64')}`;
  }

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.secretKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'Moyasar secret key not configured' };
    }
    const response = await fetch('https://api.moyasar.com/v1/payments', {
      method: 'POST',
      headers: { Authorization: this.authHeader(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100),
        currency: request.currency,
        description: request.description,
        metadata: { companyId: request.companyId, invoiceId: request.invoiceId },
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; status?: string; message?: string };
    if (!response.ok) {
      this.logger.error(`Moyasar charge failed: ${data.message}`);
      return { success: false, gatewayReference: data.id ?? null, rawStatus: 'FAILED', failureReason: data.message };
    }
    return { success: data.status === 'paid', gatewayReference: data.id ?? null, rawStatus: data.status ?? 'unknown' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.secretKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'Moyasar not configured' };
    }
    const response = await fetch(`https://api.moyasar.com/v1/payments/${request.gatewayReference}/refund`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(request.amount * 100) }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; status?: string };
    return { success: response.ok, gatewayReference: data.id ?? request.gatewayReference, rawStatus: data.status ?? 'unknown' };
  }
}
