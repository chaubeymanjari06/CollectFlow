import { dbService } from './dbService';
import { Invoice, Customer, Message, PromiseToPay, DashboardMetrics } from '../types';

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

    // 3. Log confirmation message in WhatsApp communication log
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
      content: `Promise to Pay registered: ₹${params.amount.toLocaleString('en-IN')} promised by ${params.promisedDate}. Automatic reminders paused.`,
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

      // Check balance of associated invoices
      let allPaid = true;
      for (const invId of ptp.invoiceIds) {
        const inv = invoicesMap[invId];
        if (inv && inv.balance > 0) {
          allPaid = false;
        }
      }

      if (allPaid) {
        // Promise was kept!
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
        // Promised date passed without payment -> BROKEN!
        await dbService.update(`promises/${tenantId}/${ptp.promiseId}`, {
          status: 'BROKEN',
          updatedAt: Date.now(),
        });
        // Resume automated reminder rules
        for (const invId of ptp.invoiceIds) {
          await dbService.update(`invoices/${tenantId}/${invId}`, {
            hasActivePtp: false,
            activePtpId: null,
          });
        }
        broken += 1;
      }
    }

    // Update dashboard counters
    const dash = await dbService.get<DashboardMetrics>(`dashboard/${tenantId}`);
    if (dash) {
      const allPromises = (await dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`)) || {};
      const activeCount = Object.values(allPromises).filter((p) => p.status === 'PENDING').length;
      const brokenCount = Object.values(allPromises).filter((p) => p.status === 'BROKEN').length;

      await dbService.update(`dashboard/${tenantId}`, {
        activePtpCount: activeCount,
        brokenPtpCount: brokenCount,
      });
    }

    return { kept, broken };
  },

  // --- WhatsApp Collection Workflow Engine ---

  async evaluateWorkflow(tenantId: string): Promise<WorkflowEvaluationResult> {
    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};

    const eligibleInvoices: WorkflowEvaluationResult['eligibleInvoices'] = [];
    let skippedActivePtp = 0;
    let skippedDeduplication = 0;
    let skippedOptOut = 0;

    const now = Date.now();
    const DEDUPLICATION_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 Hours

    const todayStr = new Date().toISOString().split('T')[0];
    const threeDaysFromNow = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const inv of Object.values(invoicesMap)) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED' || inv.balance <= 0) continue;

      const customer = customersMap[inv.customerId];
      if (!customer) continue;

      // Rule 1: Opt-Out Check
      if (customer.optOutWhatsApp) {
        skippedOptOut += 1;
        continue;
      }

      // Rule 2: Active PTP Pause Check
      if (inv.hasActivePtp) {
        skippedActivePtp += 1;
        continue;
      }

      // Rule 3: Deduplication Window Check (max 1 reminder per 48h)
      if (inv.lastReminderSentAt && now - inv.lastReminderSentAt < DEDUPLICATION_WINDOW_MS) {
        skippedDeduplication += 1;
        continue;
      }

      // Determine appropriate Meta template based on due date
      let templateId = '';
      let messagePreview = '';

      if (inv.dueDate < todayStr) {
        templateId = 'overdue_reminder';
        messagePreview = `Reminder: Invoice ${inv.invoiceNumber} (₹${inv.balance.toLocaleString('en-IN')}) is ${inv.daysPastDue} days overdue. Pay via UPI or reply with Promise to Pay date.`;
      } else if (inv.dueDate === todayStr) {
        templateId = 'due_today_reminder';
        messagePreview = `Urgent: Invoice ${inv.invoiceNumber} for ₹${inv.balance.toLocaleString('en-IN')} is due today. Settle via UPI to avoid overdue fees.`;
      } else if (inv.dueDate <= threeDaysFromNow) {
        templateId = 'pre_due_reminder';
        messagePreview = `Friendly reminder: Invoice ${inv.invoiceNumber} (₹${inv.balance.toLocaleString('en-IN')}) will be due on ${inv.dueDate}. Click to pay via UPI.`;
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
      content:
        params.customNote ||
        `Invoice ${params.invoice.invoiceNumber} of ₹${params.invoice.balance.toLocaleString('en-IN')} is due on ${params.invoice.dueDate}. Pay instantly: ${params.invoice.paymentLink || 'UPI'}`,
      provider: 'meta_cloud_api',
      providerMessageId: `wamid.HBgL_${now}`,
      status: 'DELIVERED',
      sentAt: now,
      deliveredAt: now,
      readAt: null,
      createdAt: now,
    };

    // 1. Store message in RTDB
    await dbService.set(`messages/${tenantId}/${messageId}`, message);

    // 2. Update invoice reminder marker and count
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
};
