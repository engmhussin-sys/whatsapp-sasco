import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentProviderConfig,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
} from '../interfaces/payment-provider.interface';

/** Real implementation — MyFatoorah (GCC gateway) InitiatePayment / ExecutePayment API. */
@Injectable()
export class MyFatoorahPaymentProvider implements PaymentProvider {
  readonly gatewayType = 'MYFATOORAH';
  private readonly logger = new Logger(MyFatoorahPaymentProvider.name);

  async charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'MyFatoorah API token not configured' };
    }
    const response = await fetch('https://api.myfatoorah.com/v2/SendPayment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        InvoiceValue: request.amount,
        CustomerName: request.companyId,
        DisplayCurrencyIso: request.currency,
        CustomerReference: request.invoiceId ?? request.companyId,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      IsSuccess?: boolean;
      Data?: { InvoiceId?: number };
      Message?: string;
    };
    if (!response.ok || !data.IsSuccess) {
      this.logger.error(`MyFatoorah charge failed: ${data.Message}`);
      return { success: false, gatewayReference: data.Data?.InvoiceId ? String(data.Data.InvoiceId) : null, rawStatus: 'FAILED', failureReason: data.Message };
    }
    return { success: true, gatewayReference: data.Data?.InvoiceId ? String(data.Data.InvoiceId) : null, rawStatus: 'pending' };
  }

  async refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult> {
    if (!config.apiKey) {
      return { success: false, gatewayReference: null, rawStatus: 'NOT_CONFIGURED', failureReason: 'MyFatoorah not configured' };
    }
    const response = await fetch('https://api.myfatoorah.com/v2/MakeRefund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Key: request.gatewayReference, KeyType: 'PaymentId', RefundChargeOnCustomer: false, ServiceChargeOnCustomer: false, Amount: request.amount }),
    });
    const data = (await response.json().catch(() => ({}))) as { IsSuccess?: boolean; Message?: string };
    return { success: !!data.IsSuccess, gatewayReference: request.gatewayReference, rawStatus: data.IsSuccess ? 'refunded' : 'failed', failureReason: data.Message };
  }
}
