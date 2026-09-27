import { dbService } from './dbService';
import { Invoice, Customer, Message, PromiseToPay, DashboardMetrics, MorningRoutineState } from '../types';

export interface WorkflowEvaluationResult {
  eligibleInvoices: Array<{
    invoice: Invoice;
    customer: Customer;
    templateId: string;
    messagePreview: string;
  }>;
  skippedActivePtp: number;
  skippedDeduplication: number;
  skippedOptOut: number;
  skippedDisputed: number;
}

export const reminderPtpService = {
  // --- Promise-to-Pay (PTP) Engine ---

  async createPromiseToPay(
    tenantId: string,
    params: {
      customerId: string;
      customerName: string;
      invoiceIds: string[];
      invoiceNumber: string;
      amount: number;
      promisedDate: string; // 'YYYY-MM-DD'
      source?: 'WHATSAPP_BOT' | 'PORTAL' | 'MANUAL_EXECUTIVE';
      notes?: string;
      createdBy?: string;
    }
  ): Promise<PromiseToPay> {
    const now = Date.now();
    const promiseId = `ptp_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;

    const promise: PromiseToPay = {
      promiseId,
      tenantId,
      customerId: params.customerId,
      customerName: params.customerName,
      invoiceIds: params.invoiceIds,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      promisedDate: params.promisedDate,
      status: 'PENDING',
      source: params.source || 'MANUAL_EXECUTIVE',
      createdBy: params.createdBy || 'Accounts Executive',
      notes: params.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Save Promise in Realtime Database
    await dbService.set(`promises/${tenantId}/${promiseId}`, promise);

    // 2. Mark invoices with active PTP to pause reminders
    for (const invId of params.invoiceIds) {
      await dbService.update(`invoices/${tenantId}/${invId}`, {
        hasActivePtp: true,
        activePtpId: promiseId,
      });
    }

    // 3. Log confirmation message in WhatsApp communication log with DPDP footer
    const messageId = `msg_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;
    const confirmMsg: Message = {
      messageId,
      tenantId,
      customerId: params.customerId,
      customerName: params.customerName,
      invoiceIds: params.invoiceIds,
      invoiceNumber: params.invoiceNumber,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      templateId: 'ptp_confirmation',
      content: `Payment commitment registered: ₹${params.amount.toLocaleString(
        'en-IN'
      )} committed by ${params.promisedDate}. Automated reminders paused.\n\nReply STOP to pause messages.`,
      provider: 'meta_cloud_api',
      providerMessageId: `wamid.CONFIRM_${now}`,
      status: 'DELIVERED',
      sentAt: now,
      deliveredAt: now,
      createdAt: now,
    };
    await dbService.set(`messages/${tenantId}/${messageId}`, confirmMsg);

    // 4. Update dashboard active PTP counter
    const dash = await dbService.get<DashboardMetrics>(`dashboard/${tenantId}`);
    if (dash) {
      await dbService.update(`dashboard/${tenantId}`, {
        activePtpCount: (dash.activePtpCount || 0) + 1,
      });
    }

    return promise;
  },

  async evaluateMaturedPtps(tenantId: string): Promise<{ kept: number; broken: number }> {
    const promisesMap = (await dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`)) || {};
    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};

    let kept = 0;
    let broken = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const ptp of Object.values(promisesMap)) {
      if (ptp.status !== 'PENDING') continue;

      let allPaid = true;
      for (const invId of ptp.invoiceIds) {
        const inv = invoicesMap[invId];
        if (inv && inv.balance > 0) {
          allPaid = false;
        }
      }

      if (allPaid) {
        await dbService.update(`promises/${tenantId}/${ptp.promiseId}`, {
          status: 'KEPT',
          keptDate: todayStr,
          updatedAt: Date.now(),
        });
        for (const invId of ptp.invoiceIds) {
          await dbService.update(`invoices/${tenantId}/${invId}`, {
            hasActivePtp: false,
            activePtpId: null,
          });
        }
        kept += 1;
      } else if (ptp.promisedDate < todayStr) {
        await dbService.update(`promises/${tenantId}/${ptp.promiseId}`, {
          status: 'BROKEN',
          updatedAt: Date.now(),
        });
        for (const invId of ptp.invoiceIds) {
          await dbService.update(`invoices/${tenantId}/${invId}`, {
            hasActivePtp: false,
            activePtpId: null,
          });
        }
        broken += 1;
      }
    }

    // Refresh dashboard broken PTP counter
    const dash = await dbService.get<DashboardMetrics>(`dashboard/${tenantId}`);
    if (dash) {
      await dbService.update(`dashboard/${tenantId}`, {
        brokenPtpCount: broken,
        activePtpCount: Math.max(0, (dash.activePtpCount || 0) - kept - broken),
      });
    }

    return { kept, broken };
  },

  async getBrokenPromises(tenantId: string): Promise<PromiseToPay[]> {
    const promisesMap = (await dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`)) || {};
    return Object.values(promisesMap).filter((p) => p.status === 'BROKEN');
  },

  // --- WhatsApp Collection Workflow Engine ---

  async evaluateWorkflow(tenantId: string): Promise<WorkflowEvaluationResult> {
    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};

    const eligibleInvoices: WorkflowEvaluationResult['eligibleInvoices'] = [];
    let skippedActivePtp = 0;
    let skippedDeduplication = 0;
    let skippedOptOut = 0;
    let skippedDisputed = 0;

    const now = Date.now();
    const DEDUPLICATION_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h
    const todayStr = new Date().toISOString().split('T')[0];
    const threeDaysFromNow = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const inv of Object.values(invoicesMap)) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED' || inv.balance <= 0) continue;

      const customer = customersMap[inv.customerId];
      if (!customer) continue;

      // Rule 1: DPDP Act 2023 Opt-Out Check
      if (customer.optOutWhatsApp) {
        skippedOptOut += 1;
        continue;
      }

      // Rule 2: Active Dispute Check
      if (inv.status === 'DISPUTED') {
        skippedDisputed += 1;
        continue;
      }

      // Rule 3: Active PTP Pause Check
      if (inv.hasActivePtp) {
        skippedActivePtp += 1;
        continue;
      }

      // Rule 4: Deduplication Window Check (max 1 reminder per 48h)
      if (inv.lastReminderSentAt && now - inv.lastReminderSentAt < DEDUPLICATION_WINDOW_MS) {
        skippedDeduplication += 1;
        continue;
      }

      // Rule 5: Section 43B(h) Impending Disallowance Priority Check
      let templateId = '';
      let messagePreview = '';

      if (inv.is43BhOverdue || (inv.daysTo43BhDeadline !== undefined && inv.daysTo43BhDeadline <= 7)) {
        templateId = 'section_43bh_statutory_warning';
        messagePreview = `Statutory Notice: Under Income Tax Section 43B(h), Invoice ${inv.invoiceNumber} reaches its statutory 45-day deadline on ${inv.section43BhDeadline}. Please settle immediately to avoid taxable expense disallowance.\n\nReply STOP to pause messages.`;
      } else if (inv.dueDate < todayStr) {
        templateId = 'overdue_reminder';
        messagePreview = `Reminder: Invoice ${inv.invoiceNumber} (₹${inv.balance.toLocaleString('en-IN')}) is ${inv.daysPastDue} days overdue. Pay via UPI or commit a date.\n\nReply STOP to pause messages.`;
      } else if (inv.dueDate === todayStr) {
        templateId = 'due_today_reminder';
        messagePreview = `Urgent: Invoice ${inv.invoiceNumber} for ₹${inv.balance.toLocaleString('en-IN')} is due today. Settle via 1-tap UPI.\n\nReply STOP to pause messages.`;
      } else if (inv.dueDate <= threeDaysFromNow) {
        templateId = 'pre_due_reminder';
        messagePreview = `Friendly reminder: Invoice ${inv.invoiceNumber} (₹${inv.balance.toLocaleString('en-IN')}) will be due on ${inv.dueDate}. Click to pay via UPI.\n\nReply STOP to pause messages.`;
      }

      if (templateId) {
        eligibleInvoices.push({
          invoice: inv,
          customer,
          templateId,
          messagePreview,
        });
      }
    }

    return {
      eligibleInvoices,
      skippedActivePtp,
      skippedDeduplication,
      skippedOptOut,
      skippedDisputed,
    };
  },

  async dispatchReminder(
    tenantId: string,
    params: {
      invoice: Invoice;
      customer: Customer;
      templateId: string;
      customNote?: string;
    }
  ): Promise<Message> {
    const now = Date.now();
    const messageId = `msg_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;

    const content =
      params.customNote ||
      `Invoice ${params.invoice.invoiceNumber} of ₹${params.invoice.balance.toLocaleString('en-IN')} is due on ${params.invoice.dueDate}. Pay instantly: ${params.invoice.paymentLink || 'UPI'}\n\nReply STOP to pause automated messages.`;

    const message: Message = {
      messageId,
      tenantId,
      customerId: params.customer.customerId,
      customerName: params.customer.name,
      customerMobile: params.customer.mobile,
      invoiceIds: [params.invoice.invoiceId],
      invoiceNumber: params.invoice.invoiceNumber,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      templateId: params.templateId,
      content,
      provider: 'meta_cloud_api',
      providerMessageId: `wamid.HBgL_${now}`,
      status: 'DELIVERED',
      sentAt: now,
      deliveredAt: now,
      readAt: null,
      createdAt: now,
    };

    await dbService.set(`messages/${tenantId}/${messageId}`, message);

    await dbService.update(`invoices/${tenantId}/${params.invoice.invoiceId}`, {
      lastReminderSentAt: now,
      reminderCount: (params.invoice.reminderCount || 0) + 1,
    });

    return message;
  },

  async runAutomatedBatchWorkflow(tenantId: string): Promise<{ sent: number; result: WorkflowEvaluationResult }> {
    const result = await this.evaluateWorkflow(tenantId);
    let sent = 0;

    for (const item of result.eligibleInvoices) {
      await this.dispatchReminder(tenantId, {
        invoice: item.invoice,
        customer: item.customer,
        templateId: item.templateId,
      });
      sent += 1;
    }

    return { sent, result };
  },

  /**
   * Phase 19: Render DPDP 2023 Compliant Message Templates
   */
  renderMessageTemplate(
    templateKey: string,
    variables: {
      customerName?: string;
      invoiceNumber?: string;
      amount?: number;
      dueDate?: string;
      paymentLink?: string;
    }
  ): string {
    const formattedAmount = variables.amount ? `₹${variables.amount.toLocaleString('en-IN')}` : '₹0';
    let base = `Dear ${variables.customerName || 'Valued Customer'}, reminder regarding invoice ${variables.invoiceNumber || ''} for ${formattedAmount}`;
    if (variables.dueDate) {
      base += `, due on ${variables.dueDate}.`;
    }
    if (variables.paymentLink) {
      base += ` Pay instantly: ${variables.paymentLink}`;
    }
    return `${base}\n\nReply STOP to pause messages.`;
  },

  /**
   * Phase 19: Inbound Webhook Parser (DPDP Act Opt-Out & Promise Parsing)
   */
  async handleInboundWhatsAppWebhook(
    tenantId: string,
    fromMobile: string,
    text: string
  ): Promise<{
    action: 'OPT_OUT' | 'PTP_CREATED' | 'UNHANDLED';
    optedOut?: boolean;
    ptpCreated?: boolean;
    extractedDate?: string;
    message?: string;
    details?: any;
  }> {
    const normalized = text.trim().toUpperCase();

    // 1. DPDP Act 2023 Opt-Out
    if (
      normalized === 'STOP' ||
      normalized.startsWith('STOP') ||
      normalized.includes('STOP') ||
      normalized.includes('UNSUBSCRIBE') ||
      normalized.includes('DND')
    ) {
      const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};
      const customer = Object.values(customersMap).find(
        (c) => c.mobile.replace(/\D/g, '') === fromMobile.replace(/\D/g, '')
      );

      if (customer) {
        await dbService.update(`customers/${tenantId}/${customer.customerId}`, {
          optOutWhatsApp: true,
          updatedAt: Date.now(),
        });
      }

      // Log inbound message
      const msgId = `msg_in_${Date.now()}`;
      await dbService.set(`messages/${tenantId}/${msgId}`, {
        messageId: msgId,
        tenantId,
        customerId: customer?.customerId || 'unknown',
        customerMobile: fromMobile,
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        content: text,
        status: 'REPLIED',
        createdAt: Date.now(),
      });

      return {
        action: 'OPT_OUT',
        optedOut: true,
        message: 'Opt-out processed under DPDP Act 2023',
        details: { customerId: customer?.customerId },
      };
    }

    // 2. Inbound Promise Date Commitment (e.g. "I will pay on 2026-09-30")
    const dateMatch = text.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (dateMatch) {
      const promisedDate = dateMatch[1];
      const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};
      const customer = Object.values(customersMap).find(
        (c) => c.mobile.replace(/\D/g, '') === fromMobile.replace(/\D/g, '')
      );

      if (customer) {
        const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
        const openInvoices = Object.values(invoicesMap).filter(
          (i) => i.customerId === customer.customerId && i.balance > 0
        );

        if (openInvoices.length > 0) {
          const inv = openInvoices[0];
          const promise = await this.createPromiseToPay(tenantId, {
            customerId: customer.customerId,
            customerName: customer.name,
            invoiceIds: [inv.invoiceId],
            invoiceNumber: inv.invoiceNumber,
            amount: inv.balance,
            promisedDate,
            source: 'WHATSAPP_BOT',
            notes: `Auto-parsed commitment from customer reply: "${text}"`,
          });

          return {
            action: 'PTP_CREATED',
            ptpCreated: true,
            extractedDate: promisedDate,
            details: promise,
          };
        }
      }
    }

    return { action: 'UNHANDLED' };
  },

  /**
   * Phase 19: Scheduled Cloud Function Cron (Runs Daily 09:30 AM IST)
   */
  async runDailyMorningCron(tenantId: string): Promise<{
    status: 'SUCCESS' | 'FAILED';
    tenantId: string;
    date: string;
    messagesSent: number;
    ptpsKept: number;
    ptpsBroken: number;
    routineState: MorningRoutineState;
  }> {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Evaluate matured and broken promises
    const { kept, broken } = await this.evaluateMaturedPtps(tenantId);

    // 2. Evaluate today's reminder dispatch queue & dispatch batch
    const batch = await this.runAutomatedBatchWorkflow(tenantId);

    // 3. Query broken PTPs and today's due bills
    const brokenPtps = await this.getBrokenPromises(tenantId);
    const brokenAmount = brokenPtps.reduce((sum, p) => sum + p.amount, 0);

    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const todayDue = Object.values(invoicesMap).filter((i) => i.dueDate === todayStr && i.balance > 0);
    const todayDueAmount = todayDue.reduce((sum, i) => sum + i.balance, 0);

    const paymentsMap = (await dbService.get<Record<string, any>>(`payments/${tenantId}`)) || {};
    const unmatchedPayments = Object.values(paymentsMap).filter((p) => p.unmatchedBalance > 0);
    const unmatchedAmount = unmatchedPayments.reduce((sum, p) => sum + p.unmatchedBalance, 0);

    const routineState: MorningRoutineState = {
      tenantId,
      date: todayStr,
      pulseChecked: true,
      remindersDispatched: batch.sent > 0,
      paymentsMatched: false,
      brokenPromisesReviewed: false,
      summary: {
        urgentBrokenPtpCount: brokenPtps.length || broken,
        urgentBrokenPtpAmount: brokenAmount,
        todayDueCount: todayDue.length,
        todayDueAmount,
        unmatchedPaymentsCount: unmatchedPayments.length,
        unmatchedPaymentsAmount: unmatchedAmount,
      },
    };

    await dbService.set(`morningRoutines/${tenantId}/${todayStr}`, routineState);
    return {
      status: 'SUCCESS',
      tenantId,
      date: todayStr,
      messagesSent: batch.sent,
      ptpsKept: kept,
      ptpsBroken: broken,
      routineState,
    };
  },

  /**
   * Phase 19: Meta WhatsApp Embedded Signup & Managed Sender Configuration
   */
  async getWhatsAppAccountStatus(tenantId: string) {
    const settings = await dbService.get<any>(`tenants/${tenantId}/settings/whatsapp`);
    return {
      connected: settings?.connected || false,
      mode: settings?.mode || 'MANAGED_SHARED_SENDER', // or 'CUSTOM_WABA'
      phoneNumber: settings?.phoneNumber || '+91 98200 12345 (CollectFlow Verified)',
      wabaId: settings?.wabaId || 'waba_managed_shared_01',
      qualityRating: 'GREEN (High Quality)',
      tier: 'Tier 2 (10,000 conversations/day)',
      optOutDndCompliance: true,
    };
  },

  async toggleManagedSharedSender(tenantId: string, useManaged: boolean) {
    await dbService.update(`tenants/${tenantId}/settings/whatsapp`, {
      connected: true,
      mode: useManaged ? 'MANAGED_SHARED_SENDER' : 'CUSTOM_WABA',
      updatedAt: Date.now(),
    });
  },
};
