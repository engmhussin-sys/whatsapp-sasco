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

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  type: 'TEXT' | 'VOICE' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ';
  originalText?: string | null;
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
