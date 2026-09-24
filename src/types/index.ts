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
  activePtpId?: string | null;
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

export type MessageChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'REPLIED';

export interface Message {
  messageId: string;
  tenantId: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  invoiceIds: string[];
  invoiceNumber?: string;
  channel: MessageChannel;
  direction: 'OUTBOUND' | 'INBOUND';
  templateId: string;
  templateVariables?: Record<string, string>;
  content: string;
  provider: string;
  providerMessageId?: string | null;
  status: MessageStatus;
  sentAt?: number | null;
  deliveredAt?: number | null;
  readAt?: number | null;
  repliedAt?: number | null;
  createdAt: number;
}

export type PtpStatus = 'PENDING' | 'KEPT' | 'BROKEN' | 'CANCELLED';

export interface PromiseToPay {
  promiseId: string;
  tenantId: string;
  customerId: string;
  customerName?: string;
  invoiceIds: string[];
  invoiceNumber?: string;
  amount: number;
  promisedDate: string; // 'YYYY-MM-DD'
  status: PtpStatus;
  source: 'WHATSAPP_BOT' | 'PORTAL' | 'MANUAL_EXECUTIVE';
  createdBy: string;
  keptDate?: string | null;
  associatedPaymentId?: string | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type PaymentSource = 'razorpay' | 'cashfree' | 'upi_qr' | 'tally_bank' | 'manual';
export type PaymentProvider = 'razorpay' | 'cashfree' | 'bank' | 'tally';
export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type ReconciliationStatus = 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'FULLY_MATCHED';

export interface Payment {
  paymentId: string;
  tenantId: string;
  customerId?: string | null;
  customerName?: string;
  source: PaymentSource;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  utr?: string | null;
  amount: number;
  currency: string;
  paymentDate: string; // ISO string
  status: PaymentStatus;
  reconciliationStatus: ReconciliationStatus;
  matchedAmount: number;
  unmatchedBalance: number;
  rawReference?: string | null;
  idempotencyKey: string;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type MatchRule =
  | 'EXACT_INVOICE_REF'
  | 'EXACT_AMOUNT_MATCH'
  | 'UTR_MATCH'
  | 'DATE_WINDOW_MATCH'
  | 'FUZZY_NARRATION'
  | 'MANUAL_MATCH';

export type ReconciliationState = 'AUTO_RECONCILED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type TallyWriteBackState = 'NOT_REQUIRED' | 'QUEUED' | 'SYNCED' | 'FAILED';

export interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: number;
  invoiceBalanceBefore: number;
  invoiceBalanceAfter: number;
}

export interface Reconciliation {
  reconciliationId: string;
  tenantId: string;
  paymentId: string;
  customerId: string;
  customerName?: string;
  paymentAmount: number;
  allocations: PaymentAllocation[];
  totalAllocated: number;
  confidenceScore: number; // 0 - 100
  matchRule: MatchRule;
  status: ReconciliationState;
  approvedBy?: string | null;
  approvedAt?: number | null;
  tallyWriteBackStatus: TallyWriteBackState;
  tallyVoucherNumber?: string | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TallyBillAllocation {
  billNumber: string;
  billAmount: number;
}

export type TallyCommandStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface TallyVoucherCommand {
  commandId: string;
  tenantId: string;
  deviceId?: string | null;
  reconciliationId: string;
  voucherType: 'Receipt';
  voucherDate: string; // 'YYYYMMDD' or 'YYYY-MM-DD'
  partyLedger: string;
  bankOrCashLedger: string;
  amount: number;
  narration: string;
  billsAllocated: TallyBillAllocation[];
  status: TallyCommandStatus;
  attemptCount: number;
  lastAttemptAt?: number | null;
  errorMessage?: string | null;
  tallyMasterId?: string | null;
  tallyVoucherNumber?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type CustomerRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CustomerStatementEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  description: string;
  debit: number; // Invoice amount
  credit: number; // Payment amount
  runningBalance: number;
}

export interface Customer360Data {
  customer: Customer;
  invoices: Invoice[];
  payments: Payment[];
  promises: PromiseToPay[];
  messages: Message[];
  reconciliations: Reconciliation[];
  metrics: {
    totalBilled: number;
    totalPaid: number;
    outstandingBalance: number;
    overdueBalance: number;
    creditLimit: number;
    creditUtilizationPct: number;
    averagePaymentDelayDays: number;
    ptpSuccessRate: number;
    riskTier: CustomerRiskTier;
  };
  ledgerEntries: CustomerStatementEntry[];
}

export interface CollectionPriorityItem {
  customerId: string;
  customerName: string;
  mobile: string;
  overdueBalance: number;
  totalReceivable: number;
  maxOverdueDays: number;
  brokenPtpCount: number;
  priorityScore: number; // 0 - 100
  urgency: CustomerRiskTier;
  contributingFactors: string[];
  recommendedAction: string;
}

export interface CollectionIntelligenceMetrics {
  dso: number;
  collectionEfficiencyPct: number;
  overduePercentage: number;
  totalReceivables: number;
  totalOverdue: number;
  atRiskCapital: number;
  riskBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  agingDistribution: AgingBuckets;
  priorityQueue: CollectionPriorityItem[];
}



