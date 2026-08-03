import { api } from '../api-client';
import type { CompanySubscriptionInfo, Invoice, BillingPlan, TokenWallet, FeatureAccessResult } from '../types';

export const billingApi = {
  getSubscription: (companyId: string) => api.get<CompanySubscriptionInfo>(`/companies/${companyId}/billing/subscription`),
  subscribe: (companyId: string, planCode: string, periodMonths = 1) =>
    api.post<CompanySubscriptionInfo>(`/companies/${companyId}/billing/subscription`, { planCode, periodMonths }),
  renewSubscription: (companyId: string) => api.post<CompanySubscriptionInfo>(`/companies/${companyId}/billing/subscription/renew`, {}),
  cancelSubscription: (companyId: string) => api.post<CompanySubscriptionInfo>(`/companies/${companyId}/billing/subscription/cancel`, {}),

  listInvoices: (companyId: string) => api.get<Invoice[]>(`/companies/${companyId}/billing/invoices`),
  generateInvoice: (companyId: string, opts?: { taxRatePercent?: number; couponCode?: string }) =>
    api.post<Invoice>(`/companies/${companyId}/billing/invoices/generate`, opts ?? {}),
  issueInvoice: (companyId: string, invoiceId: string) =>
    api.post<Invoice>(`/companies/${companyId}/billing/invoices/${invoiceId}/issue`, {}),

  getWallet: (companyId: string) => api.get<TokenWallet>(`/companies/${companyId}/billing/wallet`),
  creditWallet: (companyId: string, amount: number, reason: string) =>
    api.post<TokenWallet>(`/companies/${companyId}/billing/wallet/credit`, { amount, reason }),

  checkFeatureAccess: (companyId: string, featureCode: string) =>
    api.get<FeatureAccessResult>(`/companies/${companyId}/billing/features/${featureCode}/access`),

  listPlans: () => api.get<BillingPlan[]>('/billing/plans'),
  validateCoupon: (companyId: string, code: string, subtotal: number) =>
    api.post<{ valid: boolean; reason?: string; discountAmount?: number }>(`/companies/${companyId}/billing/coupons/validate`, {
      code,
      subtotal,
    }),
};
