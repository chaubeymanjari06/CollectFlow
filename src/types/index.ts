export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'PARTNER' | 'VIEWER';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  mobile?: string | null;
  photoUrl?: string | null;
  defaultTenantId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: number;
  updatedAt: number;
}

export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: UserRole;
  permissions: {
    readInvoices: boolean;
    writeInvoices: boolean;
    sendMessages: boolean;
    createPTP: boolean;
    approveReconciliation: boolean;
    manageIntegrations: boolean;
    manageBilling: boolean;
    manageUsers: boolean;
  };
  status: 'ACTIVE' | 'INVITED' | 'REVOKED';
  invitedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TenantSettings {
  defaultPaymentTermsDays: number;
  autoReconcileThreshold: number;
  sendPreDueReminders: boolean;
  sendDueReminders: boolean;
  sendOverdueReminders: boolean;
  reminderChannel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  upiVpa?: string;
  payeeName?: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  legalName?: string;
  gstin?: string | null;
  pan?: string | null;
  email: string;
  mobile: string;
  currency: string;
  timezone: string;
  planId: string;
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED';
  tallyConnected: boolean;
  settings: TenantSettings;
  createdAt: number;
  updatedAt: number;
}

export interface AgingBuckets {
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
}

export interface DashboardMetrics {
  totalReceivables: number;
  overdueAmount: number;
  dueTodayAmount: number;
  dueThisWeekAmount: number;
  collectedThisMonth: number;
  openInvoicesCount: number;
  overdueInvoicesCount: number;
  activePtpCount: number;
  brokenPtpCount: number;
  dso: number;
  agingBuckets: AgingBuckets;
  topOverdueCustomers: Array<{
    customerId: string;
    name: string;
    overdueAmount: number;
    oldestDueDate: string;
  }>;
  lastSyncAt?: number;
  updatedAt: number;
}

export interface CustomerMetrics {
  totalReceivable: number;
  overdueBalance: number;
  openInvoicesCount: number;
  overdueInvoicesCount: number;
  averagePaymentDelayDays: number;
  ptpSuccessRate: number;
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number | null;
}

export interface Customer {
  customerId: string;
  tenantId: string;
  source: 'tally' | 'zoho' | 'manual' | 'excel';
  sourceCustomerId?: string;
  name: string;
  contactPerson?: string | null;
  mobile: string;
  email?: string | null;
  creditLimit: number;
  paymentTerms: number;
  optOutWhatsApp: boolean;
  metrics: CustomerMetrics;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: number;
  updatedAt: number;
}

export type AgingBucket = 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+';
export type InvoiceStatus = 'OPEN' | 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface Invoice {
  invoiceId: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  source: 'tally' | 'zoho' | 'manual';
  sourceCompanyId?: string;
  sourceRecordId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: InvoiceStatus;
  agingBucket: AgingBucket;
  daysPastDue: number;
  hasActivePtp: boolean;
  paymentLink?: string | null;
  upiIntentString?: string | null;
  lastReminderSentAt?: number | null;
  reminderCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Device {
  deviceId: string;
  tenantId: string;
  deviceName: string;
  agentVersion: string;
  osVersion: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';
  tallyHost: string;
  tallyVersion?: string;
  activeCompany?: string;
  lastHeartbeat: number;
  lastSyncTime?: number;
  syncCursor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncJob {
  syncJobId: string;
  tenantId: string;
  deviceId: string;
  syncType: 'INITIAL' | 'INCREMENTAL' | 'MANUAL';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  recordsReceived?: {
    customers: number;
    invoices: number;
    payments?: number;
  };
  recordsUpserted: number;
  recordsRejected?: number;
  errors?: Array<{ recordId: string; error: string }>;
  startedAt: number;
  completedAt?: number | null;
  durationMs?: number | null;
}
