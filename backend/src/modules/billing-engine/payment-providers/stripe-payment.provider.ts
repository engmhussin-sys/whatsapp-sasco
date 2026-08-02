import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/** Real implementation — Stripe PaymentIntents API (REST, no SDK dependency to keep this module dependency-free). */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly gatewayType = 'STRIPE';
  private readonly logger = new Logger(StripePaymentProvider.name);

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.secretKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'Stripe secret key not configured' };
    }
    const body = new URLSearchParams({
      amount: String(Math.round(request.amount * 100)), // Stripe uses the smallest currency unit
      currency: request.currency.toLowerCase(),
      description: request.description,
      'metadata[companyId]': request.companyId,
      ...(request.invoiceId ? { 'metadata[invoiceId]': request.invoiceId } : {}),
      confirm: 'false',
    });
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string } };
    if (!response.ok) {
      this.logger.error(`Stripe charge failed: ${response.status} ${data.error?.message}`);
      return { success: false, gatewayReference: data.id ?? null, rawStatus: 'FAILED', failureReason: data.error?.message };
    }
    return { success: true, gatewayReference: data.id ?? null, rawStatus: data.status ?? 'unknown' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.secretKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'Stripe secret key not configured' };
    }
    const body = new URLSearchParams({
      payment_intent: request.gatewayReference,
      amount: String(Math.round(request.amount * 100)),
    });
    const response = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string } };
    if (!response.ok) {
      return { success: false, gatewayReference: data.id ?? null, rawStatus: 'FAILED', failureReason: data.error?.message };
    }
    return { success: true, gatewayReference: data.id ?? null, rawStatus: data.status ?? 'unknown' };
  }
}
