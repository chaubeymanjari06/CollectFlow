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
  source: 'tally' | 'zoho' | 'manual' | 'excel' | 'sheets';
  sourceCustomerId?: string;
  name: string;
  contactPerson?: string | null;
  mobile: string;
  email?: string | null;
  gstin?: string | null;
  creditLimit: number;
  paymentTerms: number;
  optOutWhatsApp: boolean;
  metrics: CustomerMetrics;
  riskTier?: CustomerRiskTier;
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
  source: 'tally' | 'zoho' | 'manual' | 'excel' | 'sheets';
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

export type PaymentSource = 'razorpay' | 'cashfree' | 'upi_qr' | 'tally_bank' | 'zoho' | 'manual';
export type PaymentProvider = 'razorpay' | 'cashfree' | 'bank' | 'tally' | 'zoho';
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

export type MessageTone = 'courteous' | 'firm' | 'urgent' | 'final_notice';

export interface AccountDiagnosis {
  customerId: string;
  customerName: string;
  executiveSummary: string;
  rootCauses: string[];
  riskAssessment: {
    riskTier: CustomerRiskTier;
    defaultProbability: 'LOW' | 'MEDIUM' | 'HIGH';
    creditUtilizationPct: number;
    overdueDays: number;
  };
  recommendedStrategy: string[];
}

export interface SmartDraftResult {
  recipientName: string;
  recipientMobile: string;
  channel: 'WHATSAPP';
  tone: MessageTone;
  subject?: string;
  content: string;
  suggestedUpiLink?: string;
  invoicesReferenced: string[];
  totalAmount: number;
}

export interface ExtractedPtpResult {
  rawText: string;
  extractedDate: string | null; // 'YYYY-MM-DD'
  extractedAmount: number | null;
  confidenceScore: number; // 0 - 100
  customerIntent: string;
}

export interface CashFlowForecast {
  periodDays: number;
  expectedInflow: number;
  conservativeInflow: number;
  optimisticInflow: number;
  ptpBackedInflow: number;
  dueInvoiceInflow: number;
  assumptions: string[];
}

export interface ManagementSummary {
  tenantName: string;
  generatedAt: number;
  totalReceivables: number;
  overduePercentage: number;
  dso: number;
  criticalAccountsCount: number;
  topOverdueAccounts: Array<{
    name: string;
    overdueAmount: number;
    daysOverdue: number;
  }>;
  executiveNarrative: string;
  suggestedActionItems: string[];
}

// ==========================================
// Phase 13: Zoho, Excel/CSV & Google Sheets Types
// ==========================================

export type IntegrationStatus = 'DISCONNECTED' | 'CONNECTED' | 'SYNCING' | 'ERROR';

export interface ZohoIntegrationConfig {
  organizationId: string;
  organizationName?: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  connectedAt?: number;
  status: IntegrationStatus;
  webhookSecret?: string;
  autoSyncEnabled: boolean;
  syncFrequencyMinutes: number;
  lastSyncedAt?: number;
  lastErrorMessage?: string | null;
}

export interface ZohoCustomerPayload {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_person?: string;
  mobile: string;
  email?: string;
  gst_no?: string;
  outstanding_receivable_amount?: number;
  credit_limit?: number;
  payment_terms?: number;
}

export interface ZohoInvoicePayload {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code?: string;
  status: string;
}

export interface ZohoPaymentPayload {
  payment_id: string;
  customer_id: string;
  customer_name: string;
  payment_number: string;
  invoice_numbers?: string[];
  amount: number;
  date: string;
  reference_number?: string;
  payment_mode?: string;
}

export interface ZohoWebhookPayload {
  event: 'invoice.created' | 'invoice.updated' | 'payment.created' | 'customer.created' | 'customer.updated';
  timestamp: number;
  organization_id: string;
  signature: string;
  data: any;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  range?: string;
  status: IntegrationStatus;
  apiKey?: string;
  autoSyncInterval: 'NONE' | 'HOURLY' | 'DAILY' | 'WEEKLY';
  lastSyncedAt?: number;
  nextScheduledSync?: number;
  columnMapping: Partial<ExcelCsvColumnMapping>;
  lastErrorMessage?: string | null;
}

export interface ExcelCsvColumnMapping {
  customerName: string;
  mobile: string;
  email?: string;
  gstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  paidAmount?: string;
  currency?: string;
}

export interface CsvValidationRow {
  rowIndex: number;
  raw: Record<string, string>;
  isValid: boolean;
  errors: string[];
  parsedRecord?: {
    customerName: string;
    mobile: string;
    email: string | null;
    gstin: string | null;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    paidAmount: number;
    balance: number;
    currency: string;
  };
}

export interface IngestionReport {
  jobId: string;
  tenantId: string;
  source: 'zoho' | 'excel' | 'sheets';
  sourceTitle: string;
  startedAt: number;
  completedAt: number;
  totalProcessed: number;
  customersUpserted: number;
  invoicesUpserted: number;
  paymentsUpserted?: number;
  failedCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errors: Array<{
    row?: number;
    recordId?: string;
    message: string;
  }>;
}

// ==========================================
// Phase 14: CA / Tally Partner Portal Types
// ==========================================

export type PartnerType = 'CA' | 'TALLY_PARTNER' | 'TAX_CONSULTANT' | 'FINANCIAL_ADVISOR';
export type PartnerTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type OnboardingStage = 'INVITE_SENT' | 'AGENT_INSTALLED' | 'TALLY_CONNECTED' | 'SYNC_COMPLETE' | 'LIVE';
export type HealthTier = 'EXCELLENT' | 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'TALLY_SYNC' | 'INTEGRATIONS' | 'PAYMENTS' | 'BILLING' | 'GENERAL';

export interface PartnerProfile {
  partnerId: string;
  userId: string;
  firmName: string;
  partnerType: PartnerType;
  membershipNumber?: string;
  contactPerson: string;
  email: string;
  mobile: string;
  city: string;
  referralCode: string;
  commissionRatePct: number;
  tier: PartnerTier;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  payoutUpiOrBank?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClientHealthIndex {
  score: number; // 0 - 100
  tier: HealthTier;
  reasons: string[];
  recommendedAction: string;
}

export interface PartnerClientSummary {
  tenantId: string;
  clientName: string;
  legalName?: string;
  gstin?: string | null;
  city: string;
  tallyConnected: boolean;
  agentStatus: 'ONLINE' | 'OFFLINE' | 'NOT_PAIRED';
  lastSyncTime?: number | null;
  totalReceivables: number;
  overdueAmount: number;
  overdueRatioPct: number;
  dso: number;
  activeInvoicesCount: number;
  health: ClientHealthIndex;
  monthlyBillingPlan: string;
  partnerMonthlyCommission: number;
}

export interface PartnerClientOnboarding {
  invitationId: string;
  partnerId: string;
  clientName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  gstin?: string;
  city: string;
  expectedMonthlyVolume: number;
  stage: OnboardingStage;
  tenantId?: string;
  token: string;
  invitedAt: number;
  connectedAt?: number;
  notes?: string;
}

export interface PartnerSupportTicket {
  ticketId: string;
  partnerId: string;
  partnerName: string;
  clientTenantId?: string;
  clientName?: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  resolution?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PartnerPayout {
  payoutId: string;
  partnerId: string;
  month: string;
  amount: number;
  clientCount: number;
  status: 'PAID' | 'PROCESSING' | 'UPCOMING';
  utr?: string;
  payoutDate?: string;
  destination: string;
}

export interface PartnerPortfolioOverview {
  totalClients: number;
  activeClients: number;
  onboardingClients: number;
  totalReceivablesUnderManagement: number;
  totalOverdueUnderManagement: number;
  averagePortfolioDso: number;
  totalCommissionEarned: number;
  pendingPayoutAmount: number;
  clients: PartnerClientSummary[];
}

