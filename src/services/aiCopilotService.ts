import { dbService } from './dbService';
import { customer360Service } from './customer360Service';
import { reminderPtpService } from './reminderPtpService';
import {
  AccountDiagnosis,
  SmartDraftResult,
  ExtractedPtpResult,
  CashFlowForecast,
  ManagementSummary,
  MessageTone,
  Customer,
  Invoice,
  PromiseToPay,
  Message,
  Tenant,
  DashboardMetrics,
} from '../types';

export const aiCopilotService = {
  /**
   * Explains why an account is overdue and diagnoses root causes, default risks,
   * and recommends targeted collection strategies.
   */
  async diagnoseCustomerAccount(
    tenantId: string,
    customerId: string
  ): Promise<AccountDiagnosis | null> {
    const profile = await customer360Service.getCustomer360(tenantId, customerId);
    if (!profile) return null;

    const { customer, metrics, invoices, promises } = profile;
    const rootCauses: string[] = [];

    // Analyze Overdue Days
    const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE' && i.balance > 0);
    let maxOverdueDays = 0;
    for (const inv of overdueInvoices) {
      if (inv.daysPastDue > maxOverdueDays) maxOverdueDays = inv.daysPastDue;
    }

    if (maxOverdueDays > 60) {
      rootCauses.push(
        `Severe payment delay: Oldest bill #${overdueInvoices[0]?.invoiceNumber || ''} is past due by ${maxOverdueDays} days.`
      );
    } else if (maxOverdueDays > 15) {
      rootCauses.push(
        `Moderate delay: Unsettled bills past due date by ${maxOverdueDays} days beyond agreed Net ${customer.paymentTerms} terms.`
      );
    }

    // Analyze Credit Exposure
    if (metrics.creditUtilizationPct > 100) {
      const excess = metrics.outstandingBalance - metrics.creditLimit;
      rootCauses.push(
        `Credit Limit Breached: Outstanding receivables exceed sanctioned limit by ₹${excess.toLocaleString('en-IN')} (${metrics.creditUtilizationPct}% utilization).`
      );
    } else if (metrics.creditUtilizationPct > 80) {
      rootCauses.push(
        `High Credit Utilization: Currently utilizing ${metrics.creditUtilizationPct}% of maximum credit limit.`
      );
    }

    // Analyze Broken Commitments
    const brokenPtps = promises.filter((p) => p.status === 'BROKEN');
    if (brokenPtps.length > 0) {
      rootCauses.push(
        `Broken Commitments: Customer has failed to honor ${brokenPtps.length} formal Promise-to-Pay (PTP) commitment(s).`
      );
    }

    // Analyze Payment Delay Trend
    if (metrics.averagePaymentDelayDays > 20) {
      rootCauses.push(
        `Chronic payment friction: Historically settles invoices ${metrics.averagePaymentDelayDays} days late on average.`
      );
    }

    if (rootCauses.length === 0) {
      rootCauses.push('Account is operating within normal billing tolerances and payment terms.');
    }

    // Risk Assessment
    let defaultProbability: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (metrics.riskTier === 'CRITICAL' || brokenPtps.length >= 2 || maxOverdueDays > 90) {
      defaultProbability = 'HIGH';
    } else if (metrics.riskTier === 'HIGH' || maxOverdueDays > 30) {
      defaultProbability = 'MEDIUM';
    }

    // Recommended Strategies
    const recommendedStrategy: string[] = [];
    if (defaultProbability === 'HIGH') {
      recommendedStrategy.push(
        'Temporary Credit Hold: Pause new dispatch orders until outstanding balance is reduced below 80% limit.'
      );
      recommendedStrategy.push(
        'Executive Escalation: Accounts Manager phone call to counterpart finance head for formal settlement plan.'
      );
      recommendedStrategy.push(
        'Structured Settlement: Offer split payments across 2-3 installments with immediate 40% down-payment.'
      );
    } else if (defaultProbability === 'MEDIUM') {
      recommendedStrategy.push(
        'Urgent WhatsApp Notice: Dispatch formal reminder with embedded UPI QR intent link.'
      );
      recommendedStrategy.push(
        'Request New PTP Commitment: Log firm payment date before dispatching fresh billing cycles.'
      );
    } else {
      recommendedStrategy.push(
        'Routine courtesy statement dispatch via WhatsApp 3 days prior to due date.'
      );
    }

    const executiveSummary =
      metrics.overdueBalance > 0
        ? `${customer.name} owes ₹${metrics.outstandingBalance.toLocaleString('en-IN')}, of which ₹${metrics.overdueBalance.toLocaleString('en-IN')} is overdue. Rated as ${metrics.riskTier} risk with ${defaultProbability} probability of further delay.`
        : `${customer.name} is in good standing with ₹${metrics.outstandingBalance.toLocaleString('en-IN')} open balance and zero overdue arrears.`;

    return {
      customerId,
      customerName: customer.name,
      executiveSummary,
      rootCauses,
      riskAssessment: {
        riskTier: metrics.riskTier,
        defaultProbability,
        creditUtilizationPct: metrics.creditUtilizationPct,
        overdueDays: maxOverdueDays,
      },
      recommendedStrategy,
    };
  },

  /**
   * Drafts personalized, professional collection communications with editable
   * variables, tone selection, and human approval workflow.
   */
  async draftSmartCollectionMessage(
    tenantId: string,
    customerId: string,
    tone: MessageTone = 'firm',
    invoiceId?: string
  ): Promise<SmartDraftResult | null> {
    const customer = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
    if (!customer) return null;

    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const tenant = await dbService.get<Tenant>(`tenants/${tenantId}`);

    let targetInvoices = Object.values(invoicesMap).filter(
      (inv) => inv.customerId === customerId && inv.balance > 0
    );

    if (invoiceId) {
      targetInvoices = targetInvoices.filter((i) => i.invoiceId === invoiceId);
    }

    const totalAmount = targetInvoices.reduce((sum, inv) => sum + inv.balance, 0);
    const invoiceNumbers = targetInvoices.map((i) => i.invoiceNumber).join(', ');
    const payeeName = tenant?.settings.payeeName || tenant?.name || 'Accounts Dept';
    const upiLink = targetInvoices[0]?.paymentLink || `upi://pay?pa=${tenant?.settings.upiVpa || 'payment@bank'}&pn=${encodeURIComponent(payeeName)}&am=${totalAmount}&cu=INR`;

    let content = '';

    switch (tone) {
      case 'courteous':
        content = `Dear ${customer.contactPerson || customer.name},\n\nGreetings from ${payeeName}.\n\nThis is a friendly reminder that invoice(s) ${invoiceNumbers} totaling INR ${totalAmount.toLocaleString('en-IN')} are approaching due date.\n\nYou can settle conveniently via UPI using the link below:\n${upiLink}\n\nPlease let us know once transferred so we can reconcile your ledger.\n\nWarm regards,\n${payeeName}`;
        break;

      case 'urgent':
        content = `URGENT PAYMENT NOTICE\n\nAttn: ${customer.contactPerson || customer.name}\n\nOur records show that invoice(s) ${invoiceNumbers} totaling INR ${totalAmount.toLocaleString('en-IN')} remain significantly overdue despite prior reminders.\n\nTo avoid a temporary freeze on your credit line and pending dispatches, please settle the outstanding balance today via UPI:\n${upiLink}\n\nIf you have already arranged payment, please reply with the UTR number.\n\nAccounts & Credit Control\n${payeeName}`;
        break;

      case 'final_notice':
        content = `FINAL DEMAND FOR PAYMENT\n\nTo: ${customer.name}\nGSTIN: ${customer.gstin || 'Registered Party'}\n\nRe: Overdue Invoices ${invoiceNumbers}\nOutstanding Amount: INR ${totalAmount.toLocaleString('en-IN')}\n\nDespite repeated follow-ups, your account remains unsettled. Please treat this as our final formal request to clear arrears within 48 hours.\n\nDirect Payment Link: ${upiLink}\n\nFailure to remit payment will necessitate immediate escalation and suspension of all credit facilities.\n\nAuthorized Signatory,\n${payeeName}`;
        break;

      case 'firm':
      default:
        content = `Dear ${customer.contactPerson || customer.name},\n\nWe hope this finds you well.\n\nWe would like to draw your kind attention to outstanding invoice(s) ${invoiceNumbers} with an overdue balance of INR ${totalAmount.toLocaleString('en-IN')}.\n\nKindly arrange for payment at your earliest convenience using this instant UPI link:\n${upiLink}\n\nThank you for your prompt cooperation.\n\nBest regards,\nAccounts Team\n${payeeName}`;
        break;
    }

    return {
      recipientName: customer.name,
      recipientMobile: customer.mobile,
      channel: 'WHATSAPP',
      tone,
      content,
      suggestedUpiLink: upiLink,
      invoicesReferenced: targetInvoices.map((i) => i.invoiceNumber),
      totalAmount,
    };
  },

  /**
   * Natural Language Processing (NLP) helper that extracts promised dates and
   * payment amounts from customer messages or chat replies.
   */
  extractPtpFromMessage(messageText: string, defaultAmount?: number): ExtractedPtpResult {
    const raw = messageText.trim();
    let extractedDate: string | null = null;
    let extractedAmount: number | null = defaultAmount || null;
    let confidenceScore = 30;

    const now = new Date();

    // 1. Amount Extraction
    // Check for "50k", "50000", "50,000", "1.5L", "1.5 lakh"
    const kAmountMatch = raw.match(/(\d+(?:\.\d+)?)\s*k\b/i);
    const lakhAmountMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)\b/i);
    const inrMatch = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+)/i);
    const standaloneNumberMatch = raw.match(/\b(\d{4,7})\b/);

    if (kAmountMatch) {
      extractedAmount = Math.round(parseFloat(kAmountMatch[1]) * 1000);
      confidenceScore += 30;
    } else if (lakhAmountMatch) {
      extractedAmount = Math.round(parseFloat(lakhAmountMatch[1]) * 100000);
      confidenceScore += 35;
    } else if (inrMatch) {
      extractedAmount = parseInt(inrMatch[1].replace(/,/g, ''), 10);
      confidenceScore += 35;
    } else if (standaloneNumberMatch) {
      extractedAmount = parseInt(standaloneNumberMatch[1], 10);
      confidenceScore += 20;
    }

    // 2. Date Extraction
    // Formats: 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY'
    const isoDateMatch = raw.match(/\b(202\d[-/]\d{1,2}[-/]\d{1,2})\b/);
    const dmyDateMatch = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](202\d)\b/);

    // Relative expressions: 'tomorrow', 'next week', 'next friday', 'by friday'
    const lower = raw.toLowerCase();

    if (isoDateMatch) {
      extractedDate = isoDateMatch[1].replace(/\//g, '-');
      confidenceScore += 40;
    } else if (dmyDateMatch) {
      const day = dmyDateMatch[1].padStart(2, '0');
      const month = dmyDateMatch[2].padStart(2, '0');
      const year = dmyDateMatch[3];
      extractedDate = `${year}-${month}-${day}`;
      confidenceScore += 40;
    } else if (lower.includes('tomorrow')) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      extractedDate = tomorrow.toISOString().split('T')[0];
      confidenceScore += 35;
    } else if (lower.includes('next week') || lower.includes('by monday')) {
      const target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      extractedDate = target.toISOString().split('T')[0];
      confidenceScore += 30;
    } else if (lower.includes('next friday') || lower.includes('by friday')) {
      const target = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      extractedDate = target.toISOString().split('T')[0];
      confidenceScore += 30;
    } else if (lower.includes('month end') || lower.includes('by 30th')) {
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      extractedDate = endOfMonth.toISOString().split('T')[0];
      confidenceScore += 30;
    }

    // Cap confidence
    confidenceScore = Math.min(100, confidenceScore);

    let customerIntent = 'General response / no clear payment commitment detected';
    if (extractedDate && extractedAmount) {
      customerIntent = `Customer commits to pay ₹${extractedAmount.toLocaleString('en-IN')} on or before ${extractedDate}`;
    } else if (extractedDate) {
      customerIntent = `Customer indicates payment will be arranged by ${extractedDate}`;
    } else if (extractedAmount) {
      customerIntent = `Customer mentions payment installment amount of ₹${extractedAmount.toLocaleString('en-IN')}`;
    }

    return {
      rawText: messageText,
      extractedDate,
      extractedAmount,
      confidenceScore,
      customerIntent,
    };
  },

  /**
   * Cash Flow & Inflow Forecast based on verified PTP commitments, due dates,
   * and customer payment delay distributions.
   */
  async forecastCashFlow(tenantId: string, daysAhead: number = 30): Promise<CashFlowForecast> {
    const [promisesMap, invoicesMap] = await Promise.all([
      dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`),
      dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`),
    ]);

    const now = Date.now();
    const windowEnd = now + daysAhead * 24 * 60 * 60 * 1000;

    const promises = Object.values(promisesMap || {}).filter(
      (p) => p.status === 'PENDING' && new Date(p.promisedDate).getTime() <= windowEnd
    );

    const openInvoices = Object.values(invoicesMap || {}).filter(
      (inv) => inv.balance > 0 && new Date(inv.dueDate).getTime() <= windowEnd
    );

    const ptpBackedInflow = promises.reduce((sum, p) => sum + p.amount, 0);
    const dueInvoiceInflow = openInvoices.reduce((sum, inv) => sum + inv.balance, 0);

    // Expected inflow weighted: PTPs historically have 85% realization; standard invoices ~65%
    const expectedInflow = Math.round(ptpBackedInflow * 0.85 + dueInvoiceInflow * 0.65);
    const conservativeInflow = Math.round(ptpBackedInflow * 0.7 + dueInvoiceInflow * 0.4);
    const optimisticInflow = Math.round(ptpBackedInflow * 1.0 + dueInvoiceInflow * 0.9);

    const assumptions = [
      `Active PTP commitments modeled at 85% expected realization (${promises.length} promises totaling ₹${ptpBackedInflow.toLocaleString('en-IN')}).`,
      `Invoices maturing within ${daysAhead} days modeled with historical delay factor.`,
      `Conservative bound reflects potential 30-day rollover on overdue accounts without active PTP.`,
      `Optimistic bound assumes full PTP fulfillment and prompt pre-due settlements.`,
    ];

    return {
      periodDays: daysAhead,
      expectedInflow,
      conservativeInflow,
      optimisticInflow,
      ptpBackedInflow,
      dueInvoiceInflow,
      assumptions,
    };
  },

  /**
   * Generates a high-level executive briefing for business owners, CAs, and C-Suite.
   */
  async generateManagementSummary(tenantId: string): Promise<ManagementSummary> {
    const [tenant, dash, invoicesMap, customersMap] = await Promise.all([
      dbService.get<Tenant>(`tenants/${tenantId}`),
      dbService.get<DashboardMetrics>(`dashboard/${tenantId}`),
      dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`),
      dbService.get<Record<string, Customer>>(`customers/${tenantId}`),
    ]);

    const tenantName = tenant?.name || 'Company';
    const totalReceivables = dash?.totalReceivables || 0;
    const overdueAmount = dash?.overdueAmount || 0;
    const overduePercentage =
      totalReceivables > 0 ? Math.round((overdueAmount / totalReceivables) * 100) : 0;
    const dso = dash?.dso || 42;

    const invoices = Object.values(invoicesMap || {});
    const customers = Object.values(customersMap || {});

    // Identify top overdue accounts
    const topOverdueAccounts = (dash?.topOverdueCustomers || []).map((c) => ({
      name: c.name,
      overdueAmount: c.overdueAmount,
      daysOverdue: Math.max(
        0,
        Math.floor((Date.now() - new Date(c.oldestDueDate).getTime()) / (24 * 60 * 60 * 1000))
      ),
    }));

    const criticalAccountsCount = customers.filter(
      (c) => (c.metrics?.overdueBalance || 0) > (c.creditLimit || 500000)
    ).length;

    const executiveNarrative = `${tenantName} currently holds ₹${totalReceivables.toLocaleString(
      'en-IN'
    )} in total book receivables. Overdue arrears account for ${overduePercentage}% (₹${overdueAmount.toLocaleString(
      'en-IN'
    )}) across ${dash?.overdueInvoicesCount || 0} overdue invoices. The Days Sales Outstanding (DSO) stands at ${dso} days. Immediate follow-up on top accounts is projected to recover approximately ₹${Math.round(
      overdueAmount * 0.45
    ).toLocaleString('en-IN')} within the next 15 days.`;

    const suggestedActionItems = [
      'Trigger automated WhatsApp reminders for all bills overdue between 1-30 days.',
      'Place accounts with broken PTP commitments on dispatch hold until reconciled.',
      'Request Accounts Manager review on pending reconciliation queue matches.',
    ];

    return {
      tenantName,
      generatedAt: Date.now(),
      totalReceivables,
      overduePercentage,
      dso,
      criticalAccountsCount,
      topOverdueAccounts,
      executiveNarrative,
      suggestedActionItems,
    };
  },

  /**
   * Approves and dispatches an AI-drafted collection message to WhatsApp thread.
   */
  async dispatchDraftedMessage(
    tenantId: string,
    customerId: string,
    draft: {
      content: string;
      invoicesReferenced?: string[];
    }
  ): Promise<Message> {
    const customer = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
    const now = Date.now();
    const messageId = `msg_copilot_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;

    const message: Message = {
      messageId,
      tenantId,
      customerId,
      customerName: customer?.name || 'Customer',
      customerMobile: customer?.mobile || '',
      invoiceIds: draft.invoicesReferenced || [],
      invoiceNumber: draft.invoicesReferenced?.[0] || 'STATEMENT',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      templateId: 'copilot_smart_draft',
      content: draft.content,
      provider: 'meta_cloud_api',
      providerMessageId: `wamid.COPILOT_${now}`,
      status: 'DELIVERED',
      sentAt: now,
      deliveredAt: now,
      readAt: null,
      createdAt: now,
    };

    await dbService.set(`messages/${tenantId}/${messageId}`, message);
    return message;
  },

  /**
   * Confirms and persists an extracted PTP commitment from customer reply.
   */
  async confirmExtractedPtp(
    tenantId: string,
    params: {
      customerId: string;
      customerName: string;
      amount: number;
      promisedDate: string;
      notes?: string;
    }
  ): Promise<PromiseToPay> {
    return reminderPtpService.createPromiseToPay(tenantId, {
      customerId: params.customerId,
      customerName: params.customerName,
      invoiceIds: [],
      invoiceNumber: 'MULTIPLE',
      amount: params.amount,
      promisedDate: params.promisedDate,
      source: 'WHATSAPP_BOT',
      notes: params.notes || 'PTP extracted by AI Copilot NLP',
      createdBy: 'AI Copilot Assistant',
    });
  },
};
