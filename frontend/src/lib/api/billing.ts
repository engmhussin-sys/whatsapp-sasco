import { api } from '../api-client';
import type { CompanySubscriptionInfo, Invoice, BillingPlan, TokenWallet, FeatureAccessResult } from '../types';

export interface BillingFeature {
  id: string;
  code: string;
  name: string;
  unit: 'COUNT' | 'TOKENS' | 'GB' | 'MINUTES';
  description?: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface AddOn {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  extraLimitAmount: number | null;
  feature?: { code: string; name: string } | null;
}

export interface CompanyAddOn {
  id: string;
  addOnId: string;
  addOn: AddOn;
  activatedAt: string;
  isActive: boolean;
}

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
  createPlan: (data: { code: string; name: string; description?: string; billingModel: string; basePrice: number; currency?: string }) =>
    api.post<BillingPlan>('/billing/plans', data),

  listFeatures: () => api.get<BillingFeature[]>('/billing/plans/features/all'),
  createFeature: (data: { code: string; name: string; unit: string; description?: string }) =>
    api.post<BillingFeature>('/billing/plans/features', data),

  setPlanFeatureLimit: (planCode: string, data: { featureCode: string; includedLimit?: number; overageUnitPrice?: number }) =>
    api.post(`/billing/plans/${planCode}/feature-limits`, data),

  listCoupons: () => api.get<Coupon[]>('/billing/plans/coupons/all'),
  createCoupon: (data: {
    code: string;
    discountType: string;
    discountValue: number;
    maxRedemptions?: number;
    validFrom?: string;
    validUntil?: string;
  }) => api.post<Coupon>('/billing/plans/coupons', data),

  validateCoupon: (companyId: string, code: string, subtotal: number) =>
    api.post<{ valid: boolean; reason?: string; discountAmount?: number }>(`/companies/${companyId}/billing/coupons/validate`, {
      code,
      subtotal,
    }),

  listAddOnCatalog: () => api.get<AddOn[]>('/billing/plans/add-ons/all'),
  createAddOn: (data: { code: string; name: string; description?: string; price: number; featureCode?: string; extraLimitAmount?: number }) =>
    api.post<AddOn>('/billing/plans/add-ons', data),

  listCompanyAddOns: (companyId: string) => api.get<CompanyAddOn[]>(`/companies/${companyId}/billing/add-ons`),
  activateAddOn: (companyId: string, addOnCode: string) => api.post<CompanyAddOn>(`/companies/${companyId}/billing/add-ons`, { addOnCode }),
  deactivateAddOn: (companyId: string, companyAddOnId: string) =>
    api.post<CompanyAddOn>(`/companies/${companyId}/billing/add-ons/${companyAddOnId}/deactivate`, {}),
};
