/**
 * BILLING ENGINE — Payment Provider Strategy Pattern.
 * -----------------------------------------------------------------------
 * Same philosophy as translation-engine's TranslationProvider: this
 * module never imports a concrete gateway SDK. Every gateway (Stripe,
 * HyperPay, PayTabs, MyFatoorah, Moyasar, STC Pay, Apple Pay, Visa/
 * Mastercard direct, Mada) implements this one interface and is
 * registered in PaymentProviderRegistry — adding a 10th gateway never
 * touches InvoiceEngineService or anything else that charges a company.
 */

export interface ChargeRequest {
  amount: number;
  currency: string;
  companyId: string;
  invoiceId?: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  gatewayReference: string | null;
  rawStatus: string;
  failureReason?: string;
}

export interface RefundRequest {
  gatewayReference: string;
  amount: number;
  currency: string;
}

export interface PaymentProviderConfig {
  apiKey: string | null;
  secretKey?: string | null;
  merchantId?: string | null;
}

export interface PaymentProvider {
  /** Must match a value the PaymentProviderRegistry's map key uses (e.g. "STRIPE", "HYPERPAY", "PAYTABS", ...). */
  readonly gatewayType: string;

  charge(request: ChargeRequest, config: PaymentProviderConfig): Promise<ChargeResult>;
  refund(request: RefundRequest, config: PaymentProviderConfig): Promise<ChargeResult>;
}
