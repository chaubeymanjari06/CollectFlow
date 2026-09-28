export interface PromotionClient {
  clientId: string;
  tenantId: string;
  ledgerId?: string | null;
  companyName: string;
  contactPerson: string;
  designation?: string;
  mobile: string;
  email?: string;
  gstin?: string;
  city?: string;
  state?: string;
  cluster?: string;
  tags: string[];
  financialSnapshot?: {
    currentOutstanding: number;
    overdueAmount: number;
    oldestBillAgeDays: number;
    creditLimit: number;
    isCreditFrozen: boolean;
  };
  preferences?: {
    preferredChannel?: 'WHATSAPP' | 'EMAIL' | 'SMS';
    preferredLanguage?: 'en' | 'hi' | 'gu';
    promotionsOptOut?: boolean;
    optOutTimestamp?: number | null;
    optOutReason?: string | null;
    whatsappDeliverable?: boolean;
  };
  source: 'MANUAL' | 'CSV_IMPORT' | 'TALLY_SYNC';
  totalCampaignsSent?: number;
  lastCampaignId?: string | null;
  lastCampaignSentAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PromotionTemplate {
  templateId: string;
  tenantId: string;
  title: string;
  category:
    | 'FESTIVE_SCHEME'
    | 'EARLY_PAYMENT_DISCOUNT'
    | 'NEW_STOCK_ARRIVAL'
    | 'CLEARANCE_SALE'
    | 'VIP_DEALER_SPECIAL'
    | 'GENERAL_ANNOUNCEMENT';
  channel: 'WHATSAPP' | 'EMAIL' | 'OMNICHANNEL';
  language: 'en' | 'hi' | 'gu';
  whatsapp: {
    metaTemplateName: string;
    metaTemplateStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
    metaCategory?: string;
    headerType: 'NONE' | 'IMAGE' | 'DOCUMENT' | 'TEXT';
    headerMediaUrl?: string;
    headerFileName?: string;
    bodyText: string;
    sampleVariables?: Record<string, string>;
    footerText: string;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      urlOrPayload?: string;
    }>;
  };
  email?: {
    subject: string;
    preheaderText?: string;
    htmlBody: string;
    bannerImageUrl?: string;
    catalogAttachmentUrl?: string;
    senderName?: string;
  };
  sms?: {
    dltPrincipalEntityId?: string;
    dltContentTemplateId?: string;
    smsText: string;
  };
  isSystemPreset: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PromotionCampaign {
  campaignId: string;
  tenantId: string;
  name: string;
  templateId: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'OMNICHANNEL';
  targeting: {
    mode: 'ALL_CLIENTS' | 'SEGMENT' | 'CUSTOM_CSV';
    filterTags?: string[];
    excludeFrozenCredit?: boolean;
    maxOldestBillAgeDays?: number;
    cityFilter?: string[];
  };
  dispatchConfig: {
    totalTargetAudience: number;
    estimatedMetaCostInr: number;
    batchSizePerMinute: number;
    sendTestToOwnerNumber?: string;
    isScheduled: boolean;
    scheduledTimestamp?: number | null;
  };
  status:
    | 'DRAFT'
    | 'SCHEDULED'
    | 'DISPATCHING'
    | 'COMPLETED'
    | 'PAUSED_QUALITY_WARNING'
    | 'FAILED';
  startedAt?: number | null;
  completedAt?: number | null;
  metrics: {
    totalQueued: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    bouncedCount: number;
    inquiriesReceived: number;
    optOutsReceived: number;
  };
  attribution?: {
    linkedInquiriesCount: number;
    totalOrdersGenerated: number;
    totalRevenueGeneratedInr: number;
    totalOverdueRecoveredInr: number;
  };
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromotionInquiry {
  inquiryId: string;
  tenantId: string;
  campaignId: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  messagePreview: string;
  inboundChannel: 'WHATSAPP' | 'EMAIL';
  receivedAt: number;
  status: 'NEW_LEAD' | 'FOLLOWING_UP' | 'QUOTATION_SENT' | 'ORDER_PLACED' | 'LOST';
  assignedToUserId?: string | null;
  linkedOrderId?: string | null;
  orderValueInr?: number | null;
  notes?: string;
}

export interface CampaignRecipientLog {
  campaignId: string;
  clientId: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
  recipientMobile: string;
  recipientEmail?: string;
  messageId?: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'OPT_OUT';
  sentAt?: number | null;
  deliveredAt?: number | null;
  readAt?: number | null;
  repliedAt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}
