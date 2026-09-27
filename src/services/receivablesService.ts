import { dbService } from './dbService';
import {
  Invoice,
  Customer,
  DashboardMetrics,
  AgingBucket,
  InvoiceStatus,
  CreditNote,
  DisputeCategory,
  MsmeCategory,
} from '../types';

export function calculateAging(
  dueDateStr: string,
  balance: number,
  paidAmount: number = 0,
  referenceDate: Date = new Date()
): { daysPastDue: number; agingBucket: AgingBucket; status: InvoiceStatus } {
  if (balance <= 0) {
    return {
      daysPastDue: 0,
      agingBucket: 'CURRENT',
      status: 'PAID',
    };
  }

  const [year, month, day] = dueDateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const diffMs = ref.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    // Current / Due Soon / Due Today
    let status: InvoiceStatus = 'OPEN';
    if (paidAmount > 0) {
      status = 'PARTIALLY_PAID';
    } else if (diffDays === 0) {
      status = 'DUE_TODAY';
    } else if (diffDays >= -3) {
      status = 'DUE_SOON';
    }

    return {
      daysPastDue: 0,
      agingBucket: 'CURRENT',
      status,
    };
  }

  // Overdue
  let agingBucket: AgingBucket = '1-30';
  if (diffDays > 90) {
    agingBucket = '90+';
  } else if (diffDays > 60) {
    agingBucket = '61-90';
  } else if (diffDays > 30) {
    agingBucket = '31-60';
  }

  const status: InvoiceStatus = paidAmount > 0 ? 'PARTIALLY_PAID' : 'OVERDUE';

  return {
    daysPastDue: diffDays,
    agingBucket,
    status,
  };
}

export function generateUpiPaymentLink(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  invoiceNumber: string;
}): { upiIntent: string; upiQrUrl: string } {
  const { vpa, payeeName, amount, invoiceNumber } = params;
  const sanitizedAmount = amount.toFixed(2);
  const note = `Invoice ${invoiceNumber}`;

  const queryParams = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: sanitizedAmount,
    cu: 'INR',
    tn: note,
  });

  const upiIntent = `upi://pay?${queryParams.toString()}`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntent)}`;

  return { upiIntent, upiQrUrl };
}

/**
 * Phase 19: Section 43B(h) MSMED Act Statutory Calculator
 * 45-day deadline if written agreement exists; 15-day deadline if no agreement.
 */
export function calculateSection43Bh(
  invoiceDateStr: string,
  msmeCategory: MsmeCategory = 'MICRO',
  hasWrittenAgreement: boolean = true,
  referenceDate: Date = new Date()
): { deadlineStr: string; daysRemaining: number; isOverdue: boolean } {
  const allowedDays = hasWrittenAgreement ? 45 : 15;
  const [year, month, day] = invoiceDateStr.split('-').map(Number);
  const invDate = new Date(Date.UTC(year, month - 1, day));
  const deadline = new Date(invDate.getTime() + allowedDays * 24 * 60 * 60 * 1000);

  const deadlineStr = deadline.toISOString().split('T')[0];
  const ref = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));

  const diffMs = deadline.getTime() - ref.getTime();
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0 && msmeCategory !== 'NON_MSME';

  return {
    deadlineStr,
    daysRemaining,
    isOverdue,
  };
}

export const receivablesService = {
  calculateAging,
  generateUpiPaymentLink,
  calculateSection43Bh,

  async createInvoice(
    tenantId: string,
    data: {
      customerId: string;
      customerName: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string;
      amount: number;
      upiVpa?: string;
      payeeName?: string;
      msmeCategory?: MsmeCategory;
      tallyBillType?: 'Agst Ref' | 'New Ref' | 'Adv Ref' | 'On Account';
      tallyBillName?: string;
    }
  ): Promise<Invoice> {
    const now = Date.now();
    const invoiceId = `inv_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const { daysPastDue, agingBucket, status } = calculateAging(data.dueDate, data.amount, 0);

    let upiIntentString: string | null = null;
    let paymentLink: string | null = null;

    if (data.upiVpa && data.payeeName) {
      const upi = generateUpiPaymentLink({
        vpa: data.upiVpa,
        payeeName: data.payeeName,
        amount: data.amount,
        invoiceNumber: data.invoiceNumber,
      });
      upiIntentString = upi.upiIntent;
      paymentLink = upi.upiQrUrl;
    }

    const msmeCat = data.msmeCategory || 'MICRO';
    const compliance43B = calculateSection43Bh(data.invoiceDate, msmeCat, true);

    const invoice: Invoice = {
      invoiceId,
      tenantId,
      customerId: data.customerId,
      customerName: data.customerName,
      source: 'manual',
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      amount: data.amount,
      paidAmount: 0,
      balance: data.amount,
      creditNotesAmount: 0,
      netPayableAmount: data.amount,
      currency: 'INR',
      status,
      agingBucket,
      daysPastDue,
      hasActivePtp: false,
      paymentLink,
      upiIntentString,
      lastReminderSentAt: null,
      reminderCount: 0,
      msmeCategory: msmeCat,
      section43BhDeadline: compliance43B.deadlineStr,
      daysTo43BhDeadline: compliance43B.daysRemaining,
      is43BhOverdue: compliance43B.isOverdue,
      tallyBillType: data.tallyBillType || 'Agst Ref',
      tallyBillName: data.tallyBillName || data.invoiceNumber,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoice);
    await dbService.indexActiveInvoice(tenantId, invoiceId, invoice);
    await this.recalculateTenantReceivables(tenantId);
    return invoice;
  },

  async recordPaymentOnInvoice(
    tenantId: string,
    invoiceId: string,
    paymentAmount: number
  ): Promise<Invoice | null> {
    const invoice = await dbService.get<Invoice>(`invoices/${tenantId}/${invoiceId}`);
    if (!invoice) return null;

    const newPaidAmount = invoice.paidAmount + paymentAmount;
    const netTotal = invoice.amount - (invoice.creditNotesAmount || 0);
    const newBalance = Math.max(0, netTotal - newPaidAmount);
    const { daysPastDue, agingBucket, status } = calculateAging(invoice.dueDate, newBalance, newPaidAmount);

    const updates: Partial<Invoice> = {
      paidAmount: newPaidAmount,
      balance: newBalance,
      netPayableAmount: newBalance,
      daysPastDue,
      agingBucket,
      status: invoice.status === 'DISPUTED' ? 'DISPUTED' : status,
      updatedAt: Date.now(),
    };

    await dbService.update(`invoices/${tenantId}/${invoiceId}`, updates);
    const updatedInvoice = { ...invoice, ...updates };
    await dbService.indexActiveInvoice(tenantId, invoiceId, updatedInvoice);
    await this.recalculateTenantReceivables(tenantId);
    return updatedInvoice;
  },

  /**
   * Phase 19: Ingest or create a Credit Note / Return adjustment
   * Automatically deducts from open balance to prevent false overdue reminders
   */
  async createCreditNote(
    tenantId: string,
    params: {
      customerId: string;
      customerName: string;
      invoiceId?: string;
      invoiceNumber?: string;
      noteNumber: string;
      noteDate: string;
      amount: number;
      reason: string;
    }
  ): Promise<CreditNote> {
    const now = Date.now();
    const creditNoteId = `cn_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;

    const note: CreditNote = {
      creditNoteId,
      tenantId,
      customerId: params.customerId,
      customerName: params.customerName,
      invoiceId: params.invoiceId || null,
      invoiceNumber: params.invoiceNumber || null,
      noteNumber: params.noteNumber,
      noteDate: params.noteDate,
      amount: params.amount,
      reason: params.reason,
      status: params.invoiceId ? 'APPLIED' : 'PENDING',
      createdAt: now,
    };

    await dbService.set(`creditNotes/${tenantId}/${creditNoteId}`, note);

    // If linked to an invoice, immediately apply and adjust balance
    if (params.invoiceId) {
      await this.applyCreditNote(tenantId, creditNoteId, params.invoiceId);
    }

    return note;
  },

  async getCreditNotes(tenantId: string, invoiceId?: string): Promise<CreditNote[]> {
    const map = await dbService.get<Record<string, CreditNote>>(`creditNotes/${tenantId}`);
    if (!map) return [];
    const list = Object.values(map);
    if (invoiceId) {
      return list.filter((n) => n.invoiceId === invoiceId);
    }
    return list;
  },

  async applyCreditNote(tenantId: string, creditNoteId: string, invoiceId: string): Promise<Invoice | null> {
    const [note, invoice] = await Promise.all([
      dbService.get<CreditNote>(`creditNotes/${tenantId}/${creditNoteId}`),
      dbService.get<Invoice>(`invoices/${tenantId}/${invoiceId}`),
    ]);

    if (!note || !invoice) return null;

    const newCreditAmount = (invoice.creditNotesAmount || 0) + note.amount;
    const netTotal = invoice.amount - newCreditAmount;
    const newBalance = Math.max(0, netTotal - invoice.paidAmount);
    const { daysPastDue, agingBucket, status } = calculateAging(invoice.dueDate, newBalance, invoice.paidAmount);

    const updates: Partial<Invoice> = {
      creditNotesAmount: newCreditAmount,
      netPayableAmount: netTotal,
      balance: newBalance,
      daysPastDue,
      agingBucket,
      status: newBalance === 0 ? 'PAID' : (invoice.status === 'DISPUTED' ? 'DISPUTED' : status),
      updatedAt: Date.now(),
    };

    await dbService.update(`invoices/${tenantId}/${invoiceId}`, updates);
    await dbService.update(`creditNotes/${tenantId}/${creditNoteId}`, {
      status: 'APPLIED',
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
    });

    const updated = { ...invoice, ...updates };
    await dbService.indexActiveInvoice(tenantId, invoiceId, updated);
    await this.recalculateTenantReceivables(tenantId);
    return updated;
  },

  /**
   * Phase 19: Dispute Management Workflow
   * Freezes automated reminders and assigns follow-up
   */
  async markInvoiceDisputed(
    tenantId: string,
    invoiceId: string,
    reason: DisputeCategory,
    notes?: string,
    assignedTo?: string
  ): Promise<Invoice | null> {
    const invoice = await dbService.get<Invoice>(`invoices/${tenantId}/${invoiceId}`);
    if (!invoice) return null;

    const updates: Partial<Invoice> = {
      status: 'DISPUTED',
      disputeReason: reason,
      disputedAt: Date.now(),
      disputeNotes: notes || 'Invoice flagged as disputed by collection team.',
      disputeAssignedTo: assignedTo || 'Internal Sales Representative',
      updatedAt: Date.now(),
    };

    await dbService.update(`invoices/${tenantId}/${invoiceId}`, updates);
    const updated = { ...invoice, ...updates };
    await dbService.indexActiveInvoice(tenantId, invoiceId, updated);
    await this.recalculateTenantReceivables(tenantId);
    return updated;
  },

  async resolveDispute(
    tenantId: string,
    invoiceId: string,
    resolutionNotes?: string
  ): Promise<Invoice | null> {
    const invoice = await dbService.get<Invoice>(`invoices/${tenantId}/${invoiceId}`);
    if (!invoice) return null;

    const { daysPastDue, agingBucket, status } = calculateAging(
      invoice.dueDate,
      invoice.balance,
      invoice.paidAmount
    );

    const updates: Partial<Invoice> = {
      status,
      disputeReason: null,
      disputeNotes: resolutionNotes ? `Dispute resolved: ${resolutionNotes}` : null,
      updatedAt: Date.now(),
    };

    await dbService.update(`invoices/${tenantId}/${invoiceId}`, updates);
    const updated = { ...invoice, ...updates };
    await dbService.indexActiveInvoice(tenantId, invoiceId, updated);
    await this.recalculateTenantReceivables(tenantId);
    return updated;
  },

  async recalculateTenantReceivables(tenantId: string): Promise<DashboardMetrics> {
    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};

    const invoices = Object.values(invoicesMap);
    const customers = Object.values(customersMap);

    let totalReceivables = 0;
    let overdueAmount = 0;
    let dueTodayAmount = 0;
    let dueThisWeekAmount = 0;
    let openInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    const agingBuckets = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    const customerAggregates: Record<
      string,
      {
        totalReceivable: number;
        overdueBalance: number;
        openCount: number;
        overdueCount: number;
        delaySum: number;
      }
    > = {};

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const inv of invoices) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED') continue;

      totalReceivables += inv.balance;
      openInvoicesCount += 1;

      // Calculate aging dynamically
      const { daysPastDue, agingBucket } = calculateAging(inv.dueDate, inv.balance, inv.paidAmount, today);

      // Bucket totals
      if (agingBucket === 'CURRENT') agingBuckets.current += inv.balance;
      else if (agingBucket === '1-30') agingBuckets.days1_30 += inv.balance;
      else if (agingBucket === '31-60') agingBuckets.days31_60 += inv.balance;
      else if (agingBucket === '61-90') agingBuckets.days61_90 += inv.balance;
      else if (agingBucket === '90+') agingBuckets.days90Plus += inv.balance;

      if (daysPastDue > 0) {
        overdueAmount += inv.balance;
        overdueInvoicesCount += 1;
      }

      if (inv.dueDate === todayStr) {
        dueTodayAmount += inv.balance;
      } else if (inv.dueDate > todayStr && inv.dueDate <= sevenDaysFromNow) {
        dueThisWeekAmount += inv.balance;
      }

      // Customer aggregation
      if (!customerAggregates[inv.customerId]) {
        customerAggregates[inv.customerId] = {
          totalReceivable: 0,
          overdueBalance: 0,
          openCount: 0,
          overdueCount: 0,
          delaySum: 0,
        };
      }

      const custAgg = customerAggregates[inv.customerId];
      custAgg.totalReceivable += inv.balance;
      custAgg.openCount += 1;
      if (daysPastDue > 0) {
        custAgg.overdueBalance += inv.balance;
        custAgg.overdueCount += 1;
        custAgg.delaySum += daysPastDue;
      }
    }

    // Update customer metrics
    for (const cust of customers) {
      const agg = customerAggregates[cust.customerId] || {
        totalReceivable: 0,
        overdueBalance: 0,
        openCount: 0,
        overdueCount: 0,
        delaySum: 0,
      };

      const averageDelay = agg.overdueCount > 0 ? Math.round(agg.delaySum / agg.overdueCount) : 0;

      await dbService.update(`customers/${tenantId}/${cust.customerId}/metrics`, {
        totalReceivable: agg.totalReceivable,
        overdueBalance: agg.overdueBalance,
        openInvoicesCount: agg.openCount,
        overdueInvoicesCount: agg.overdueCount,
        averagePaymentDelayDays: averageDelay,
      });
    }

    // Top overdue customers
    const topOverdueCustomers = Object.entries(customerAggregates)
      .filter(([_, agg]) => agg.overdueBalance > 0)
      .sort((a, b) => b[1].overdueBalance - a[1].overdueBalance)
      .slice(0, 5)
      .map(([customerId, agg]) => {
        const cust = customersMap[customerId];
        return {
          customerId,
          name: cust?.name || 'Customer',
          overdueAmount: agg.overdueBalance,
          oldestDueDate: 'Overdue',
        };
      });

    const totalOverdueDelay = Object.values(customerAggregates).reduce((sum, a) => sum + a.delaySum, 0);
    const dso = overdueInvoicesCount > 0 ? Math.round(30 + totalOverdueDelay / overdueInvoicesCount) : 30;

    const metrics: DashboardMetrics = {
      totalReceivables,
      overdueAmount,
      dueTodayAmount,
      dueThisWeekAmount,
      collectedThisMonth: 0,
      openInvoicesCount,
      overdueInvoicesCount,
      activePtpCount: 0,
      brokenPtpCount: 0,
      dso,
      agingBuckets,
      topOverdueCustomers,
      updatedAt: Date.now(),
    };

    await dbService.set(`dashboard/${tenantId}`, metrics);
    await dbService.updateDashboardSummary(tenantId, {
      totalReceivables,
      overdueAmount,
      dueTodayAmount,
      openInvoicesCount,
      overdueInvoicesCount,
      dso,
    });

    return metrics;
  },
};
