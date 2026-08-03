export type SystemRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'TEAM_LEAD' | 'WORKER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: SystemRole;
  companyId: string | null;
  preferredLanguage: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  defaultLanguage: string;
  isActive: boolean;
  createdAt: string;
  subscription?: Subscription | null;
}

export interface Subscription {
  id: string;
  plan: 'TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  seatsLimit: number;
}

export interface PlatformStats {
  companyCount: number;
  userCount: number;
  activeSubscriptions: number;
  messageCount: number;
}

export interface CompanyDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTeams: number;
  totalConversations: number;
  supportedLanguages: { code: string; name: string; nativeName: string; isRtl: boolean }[];
}

export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  preferredLanguage: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  _count?: { members: number };
}

export interface RoleDef {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { permission: { code: string; description?: string | null } }[];
}

export interface PermissionDef {
  id: string;
  code: string;
  description?: string | null;
}

export interface ConversationMember {
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'TEAM';
  title?: string | null;
  members: ConversationMember[];
  messages?: Message[];
  updatedAt: string;
}

export interface MessageTranslation {
  langCode: string;
  translatedText: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  type: 'TEXT' | 'VOICE' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ';
  originalText?: string | null;
  originalLang?: string | null;
  translations?: MessageTranslation[];
  audioUrl?: string | null;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string | null;
  domainTag?: string | null;
  fields: TaskFieldDefinition[];
  approvalFlowId?: string | null;
}

export interface TaskFieldDefinition {
  id: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'TIME' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'SIGNATURE' | 'GPS' | 'CHECKBOX' | 'DROPDOWN';
  label: string;
  required?: boolean;
  options?: string[];
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'COMPLETED' | 'CANCELED';
  template?: TaskTemplate | null;
  dueAt?: string | null;
  createdAt: string;
}

export interface ApprovalActionItem {
  id: string;
  stepOrder: number;
  actorId: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN' | 'COMMENT';
  comment?: string | null;
  createdAt: string;
}

export interface ApprovalItem {
  id: string;
  currentStep: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELED' | 'COMPLETED';
  actions: ApprovalActionItem[];
  flow: { steps: { stepOrder: number; name: string; approverRole: { name: string } }[] };
}

export interface ShiftItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface ShiftLogItem {
  id: string;
  shiftId: string;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  endedAt?: string | null;
  shift?: ShiftItem;
}

// ---- Reports Engine -------------------------------------------------------

export interface CompanyOverviewReport {
  users: { total: number; active: number };
  teams: number;
  stations: number;
  approvals: { pending: number };
  fuelRequests: { pending: number };
  tasksByStatus: Record<string, number>;
  messagesLast30Days: number;
}

export interface BillingOverviewReport {
  subscription: {
    planName: string;
    planCode: string;
    billingModel: string;
    isActive: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt: string | null;
  } | null;
  invoiceTotalsByStatus: Record<string, { count: number; total: number }>;
  recentInvoices: Invoice[];
  tokenWalletBalance: number;
}

export interface TranslationOverviewReport {
  periodDays: number;
  totalCalls: number;
  cacheHitRate: number;
  byResolutionSource: Record<string, number>;
  byProvider: Record<string, number>;
  totalTokensUsed: number;
  totalCostEstimate: number;
}

export interface PlatformOverviewReport {
  companies: number;
  activeSubscriptions: number;
  totalUsers: number;
  totalPaidRevenue: number;
  companiesByPlan: { planId: string; planName: string; companyCount: number }[];
}

// ---- Billing Engine ---------------------------------------------------------

export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  billingModel: 'PER_USER' | 'MONTHLY_TIER' | 'PAY_AS_YOU_GO' | 'AI_TOKEN_PACKAGE' | 'HYBRID';
  basePrice: number;
  currency: string;
  isActive: boolean;
  featureLimits?: { includedLimit: number | null; overageUnitPrice: number | null; feature: { code: string; name: string; unit: string } }[];
}

export interface CompanySubscriptionInfo {
  id: string;
  companyId: string;
  planId: string;
  plan: BillingPlan;
  isActive: boolean;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  featureCode: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: InvoiceLineItem[];
}

export interface TokenWallet {
  id: string;
  companyId: string;
  balanceTokens: number;
}

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: 'NOT_INCLUDED_IN_PLAN' | 'LIMIT_EXCEEDED' | 'NO_ACTIVE_SUBSCRIPTION';
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface ExecutiveOverviewReport {
  revenue: { mrr: number; arr: number };
  companies: { total: number; active: number; trial: number; inactive: number };
  expiringSoon: number;
  failedPayments: { count: number; recent: { id: string; companyId: string; amount: number; currency: string; createdAt: string }[] };
  growth: { thisMonth: number; lastMonth: number; changePercent: number | null };
  latestCompanies: { id: string; name: string; createdAt: string }[];
  latestPayments: { id: string; companyId: string; amount: number; currency: string; createdAt: string }[];
  activityTimeline: { id: string; action: string; entityType: string; actorName: string; companyName: string | null; createdAt: string }[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
  company?: { id: string; name: string } | null;
}
