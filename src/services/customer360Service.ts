import { dbService } from './dbService';
import {
  Customer,
  Invoice,
  Payment,
  PromiseToPay,
  Message,
  Reconciliation,
  Customer360Data,
  CustomerRiskTier,
  CustomerStatementEntry,
} from '../types';

export const customer360Service = {
  /**
   * Aggregates a comprehensive 360-degree financial profile for a customer,
   * compiling invoices, payments, PTPs, WhatsApp communications, and ledger entries.
   */
  async getCustomer360(
    tenantId: string,
    customerId: string
  ): Promise<Customer360Data | null> {
    const customer = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
    if (!customer) return null;

    const [invoicesMap, paymentsMap, promisesMap, messagesMap, recsMap] = await Promise.all([
      dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`),
      dbService.get<Record<string, Payment>>(`payments/${tenantId}`),
      dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`),
      dbService.get<Record<string, Message>>(`messages/${tenantId}`),
      dbService.get<Record<string, Reconciliation>>(`reconciliations/${tenantId}`),
    ]);

    const invoices = Object.values(invoicesMap || {})
      .filter((inv) => inv.customerId === customerId)
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    const payments = Object.values(paymentsMap || {})
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const promises = Object.values(promisesMap || {})
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.promisedDate).getTime() - new Date(a.promisedDate).getTime());

    const messages = Object.values(messagesMap || {})
      .filter((m) => m.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt);

    const reconciliations = Object.values(recsMap || {})
      .filter((r) => r.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt);

    // Financial Metrics Calculation
    const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingBalance = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    const now = Date.now();
    const overdueBalance = invoices
      .filter((inv) => inv.balance > 0 && new Date(inv.dueDate).getTime() < now)
      .reduce((sum, inv) => sum + inv.balance, 0);

    const creditLimit = customer.creditLimit || 500000;
    const creditUtilizationPct = Math.round((outstandingBalance / (creditLimit || 1)) * 100);

    // Calculate Average Payment Delay Days
    let averagePaymentDelayDays = 0;
    const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
    if (paidInvoices.length > 0) {
      const totalDelay = paidInvoices.reduce((sum, inv) => sum + (inv.daysPastDue || 0), 0);
      averagePaymentDelayDays = Math.round(totalDelay / paidInvoices.length);
    } else if (customer.metrics?.averagePaymentDelayDays) {
      averagePaymentDelayDays = customer.metrics.averagePaymentDelayDays;
    }

    // Calculate PTP Success Rate
    const resolvedPromises = promises.filter((p) => p.status === 'KEPT' || p.status === 'BROKEN');
    const keptPromisesCount = promises.filter((p) => p.status === 'KEPT').length;
    const brokenPromisesCount = promises.filter((p) => p.status === 'BROKEN').length;
    const ptpSuccessRate =
      resolvedPromises.length > 0
        ? Math.round((keptPromisesCount / resolvedPromises.length) * 100)
        : 100;

    // Determine Risk Tier
    let riskTier: CustomerRiskTier = 'LOW';
    if (
      overdueBalance > creditLimit ||
      creditUtilizationPct > 100 ||
      brokenPromisesCount >= 2
    ) {
      riskTier = 'CRITICAL';
    } else if (overdueBalance > 0.5 * creditLimit || brokenPromisesCount === 1) {
      riskTier = 'HIGH';
    } else if (overdueBalance > 0) {
      riskTier = 'MEDIUM';
    }

    // Build Chronological Ledger Statement
    const rawEvents: Array<{
      date: string;
      timestamp: number;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    for (const inv of invoices) {
      rawEvents.push({
        date: inv.invoiceDate,
        timestamp: new Date(inv.invoiceDate).getTime(),
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Tax Invoice #${inv.invoiceNumber} (Due: ${inv.dueDate})`,
        debit: inv.amount,
        credit: 0,
      });
    }

    for (const p of payments) {
      const pDate = p.paymentDate.split('T')[0];
      rawEvents.push({
        date: pDate,
        timestamp: new Date(p.paymentDate).getTime(),
        type: 'PAYMENT',
        reference: p.utr || p.paymentId,
        description: `Payment received via ${p.provider.toUpperCase()} (${p.utr || 'Direct'})`,
        debit: 0,
        credit: p.amount,
      });
    }

    // Sort chronologically ascending for running balance
    rawEvents.sort((a, b) => a.timestamp - b.timestamp);

    let runningBalance = 0;
    const ledgerEntries: CustomerStatementEntry[] = rawEvents.map((ev, index) => {
      runningBalance = runningBalance + ev.debit - ev.credit;
      return {
        id: `stmt_${index}_${ev.reference}`,
        date: ev.date,
        type: ev.type,
        reference: ev.reference,
        description: ev.description,
        debit: ev.debit,
        credit: ev.credit,
        runningBalance,
      };
    });

    return {
      customer,
      invoices,
      payments,
      promises,
      messages,
      reconciliations,
      metrics: {
        totalBilled,
        totalPaid,
        outstandingBalance,
        overdueBalance,
        creditLimit,
        creditUtilizationPct,
        averagePaymentDelayDays,
        ptpSuccessRate,
        riskTier,
      },
      ledgerEntries,
    };
  },

  /**
   * Updates customer credit terms, limits, and communication preferences.
   */
  async updateCustomerCreditTerms(
    tenantId: string,
    customerId: string,
    terms: {
      creditLimit: number;
      paymentTerms: number;
      optOutWhatsApp?: boolean;
    }
  ): Promise<Customer | null> {
    const customer = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
    if (!customer) return null;

    const updates: Partial<Customer> = {
      creditLimit: terms.creditLimit,
      paymentTerms: terms.paymentTerms,
      optOutWhatsApp: terms.optOutWhatsApp ?? customer.optOutWhatsApp,
      updatedAt: Date.now(),
    };

    await dbService.update(`customers/${tenantId}/${customerId}`, updates);
    return { ...customer, ...updates };
  },
};
