import { dbService } from './dbService';
import {
  Customer,
  Invoice,
  Payment,
  PromiseToPay,
  CollectionIntelligenceMetrics,
  CollectionPriorityItem,
  CustomerRiskTier,
} from '../types';

export const collectionIntelligenceService = {
  /**
   * Computes holistic collection intelligence, Days Sales Outstanding (DSO),
   * collection efficiency, customer risk distribution, and prioritized collection queue.
   */
  async getCollectionIntelligence(tenantId: string): Promise<CollectionIntelligenceMetrics> {
    const [customersMap, invoicesMap, paymentsMap, promisesMap] = await Promise.all([
      dbService.get<Record<string, Customer>>(`customers/${tenantId}`),
      dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`),
      dbService.get<Record<string, Payment>>(`payments/${tenantId}`),
      dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`),
    ]);

    const customers = Object.values(customersMap || {});
    const invoices = Object.values(invoicesMap || {});
    const payments = Object.values(paymentsMap || {});
    const promises = Object.values(promisesMap || {});

    const now = Date.now();

    // 1. Overall Balance Totals
    const totalReceivables = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const totalOverdue = invoices
      .filter((inv) => inv.balance > 0 && new Date(inv.dueDate).getTime() < now)
      .reduce((sum, inv) => sum + inv.balance, 0);

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    // 2. DSO (Days Sales Outstanding) Calculation
    // DSO = (Receivables / Billed Sales) * 90 days (standard quarter window)
    let dso = 0;
    if (totalBilled > 0) {
      dso = Math.round((totalReceivables / totalBilled) * 90);
    }

    // 3. Collection Efficiency Index (%)
    // CEI = Collected / (Total Receivables + Collected) * 100
    const collectionEfficiencyPct =
      totalReceivables + totalCollected > 0
        ? Math.round((totalCollected / (totalReceivables + totalCollected)) * 100)
        : 100;

    // 4. Overdue Percentage
    const overduePercentage =
      totalReceivables > 0 ? Math.round((totalOverdue / totalReceivables) * 100) : 0;

    // 5. Aging Distribution
    const agingDistribution = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    for (const inv of invoices) {
      if (inv.balance <= 0) continue;
      const dueTime = new Date(inv.dueDate).getTime();
      const overdueDays = Math.max(0, Math.floor((now - dueTime) / (24 * 60 * 60 * 1000)));

      if (overdueDays === 0) {
        agingDistribution.current += inv.balance;
      } else if (overdueDays <= 30) {
        agingDistribution.days1_30 += inv.balance;
      } else if (overdueDays <= 60) {
        agingDistribution.days31_60 += inv.balance;
      } else if (overdueDays <= 90) {
        agingDistribution.days61_90 += inv.balance;
      } else {
        agingDistribution.days90Plus += inv.balance;
      }
    }

    // Capital at Risk: Invoices overdue by >60 days
    const atRiskCapital = agingDistribution.days61_90 + agingDistribution.days90Plus;

    // 6. Build Prioritized Collection Queue
    const priorityQueue: CollectionPriorityItem[] = [];
    const riskBreakdown = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const cust of customers) {
      const custInvoices = invoices.filter((inv) => inv.customerId === cust.customerId && inv.balance > 0);
      const custTotalReceivable = custInvoices.reduce((sum, i) => sum + i.balance, 0);

      const custOverdueInvoices = custInvoices.filter((i) => new Date(i.dueDate).getTime() < now);
      const custOverdueBalance = custOverdueInvoices.reduce((sum, i) => sum + i.balance, 0);

      if (custTotalReceivable <= 0 && custOverdueBalance <= 0) {
        riskBreakdown.low += 1;
        continue;
      }

      // Calculate max overdue days
      let maxOverdueDays = 0;
      for (const inv of custOverdueInvoices) {
        const dueTime = new Date(inv.dueDate).getTime();
        const diffDays = Math.floor((now - dueTime) / (24 * 60 * 60 * 1000));
        if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;
      }

      // Check broken PTPs
      const custBrokenPtps = promises.filter(
        (p) => p.customerId === cust.customerId && p.status === 'BROKEN'
      ).length;

      // Transparent scoring factors
      const contributingFactors: string[] = [];

      // Component 1: Overdue Amount (Up to 40 pts)
      let amountScore = 0;
      if (custOverdueBalance > 0) {
        amountScore = Math.min(40, Math.round((custOverdueBalance / 100000) * 20));
        contributingFactors.push(`Overdue balance of ₹${custOverdueBalance.toLocaleString('en-IN')}`);
      }

      // Component 2: Aging Days (Up to 30 pts)
      let daysScore = 0;
      if (maxOverdueDays > 0) {
        daysScore = Math.min(30, Math.round((maxOverdueDays / 30) * 10));
        contributingFactors.push(`Oldest bill past due by ${maxOverdueDays} days`);
      }

      // Component 3: Broken Commitments (Up to 20 pts)
      let brokenPtpScore = 0;
      if (custBrokenPtps > 0) {
        brokenPtpScore = Math.min(20, custBrokenPtps * 10);
        contributingFactors.push(`${custBrokenPtps} unfulfilled Promise-to-Pay (PTP) commitment(s)`);
      }

      // Component 4: Credit Limit Breach (10 pts)
      let creditBreachScore = 0;
      const creditLimit = cust.creditLimit || 500000;
      if (custTotalReceivable > creditLimit) {
        creditBreachScore = 10;
        contributingFactors.push(
          `Receivables exceed agreed credit limit of ₹${creditLimit.toLocaleString('en-IN')}`
        );
      }

      const totalPriorityScore = Math.min(100, amountScore + daysScore + brokenPtpScore + creditBreachScore);

      // Determine Urgency Level & Recommended Action
      let urgency: CustomerRiskTier = 'LOW';
      let recommendedAction = 'Routine statement & payment link dispatch';

      if (
        totalPriorityScore >= 70 ||
        custBrokenPtps >= 2 ||
        (custBrokenPtps >= 1 && maxOverdueDays >= 60)
      ) {
        urgency = 'CRITICAL';
        recommendedAction = 'Immediate phone escalation by Accounts Manager & pause new credit dispatch';
        riskBreakdown.critical += 1;
      } else if (totalPriorityScore >= 50 || maxOverdueDays > 60) {
        urgency = 'HIGH';
        recommendedAction = 'Send WhatsApp formal overdue warning notice with direct UPI link';
        riskBreakdown.high += 1;
      } else if (totalPriorityScore >= 25 || maxOverdueDays > 15) {
        urgency = 'MEDIUM';
        recommendedAction = 'Dispatch WhatsApp pre-due/due payment reminder and request PTP';
        riskBreakdown.medium += 1;
      } else {
        urgency = 'LOW';
        riskBreakdown.low += 1;
      }

      priorityQueue.push({
        customerId: cust.customerId,
        customerName: cust.name,
        mobile: cust.mobile,
        overdueBalance: custOverdueBalance,
        totalReceivable: custTotalReceivable,
        maxOverdueDays,
        brokenPtpCount: custBrokenPtps,
        priorityScore: totalPriorityScore,
        urgency,
        contributingFactors,
        recommendedAction,
      });
    }

    // Sort queue by priority score descending
    priorityQueue.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      dso,
      collectionEfficiencyPct,
      overduePercentage,
      totalReceivables,
      totalOverdue,
      atRiskCapital,
      riskBreakdown,
      agingDistribution,
      priorityQueue,
    };
  },
};
