import { dbService } from './dbService';
import { receivablesService } from './receivablesService';
import { paymentService } from './paymentService';
import {
  Payment,
  Invoice,
  Customer,
  PromiseToPay,
  Reconciliation,
  PaymentAllocation,
  MatchRule,
  TallyVoucherCommand,
} from '../types';

export interface EvaluatedMatchResult {
  confidenceScore: number;
  matchRule: MatchRule;
  suggestedAllocations: PaymentAllocation[];
  customerId: string;
  customerName: string;
}

export const reconciliationService = {
  /**
   * Evaluates an incoming or unmatched payment against open receivables using
   * the hierarchical confidence-based matching engine.
   *
   * Hierarchy:
   * 1. EXACT_INVOICE_REF (100%): Exact invoice number match in payment order/reference/notes
   * 2. EXACT_AMOUNT_MATCH (95%): Customer + exact open invoice balance match (or single tenant invoice match)
   * 3. UTR_MATCH (85%): Customer match with active PTP commitment or UTR reference
   * 4. DATE_WINDOW_MATCH (80%): Customer match with FIFO allocation across oldest overdue invoices
   * 5. Partial / manual (<80%): Manual matching required
   */
  async evaluatePaymentMatch(
    tenantId: string,
    payment: Payment
  ): Promise<EvaluatedMatchResult | null> {
    if (payment.unmatchedBalance <= 0) return null;

    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const customersMap = (await dbService.get<Record<string, Customer>>(`customers/${tenantId}`)) || {};

    const openInvoices = Object.values(invoicesMap).filter((inv) => inv.balance > 0);
    if (openInvoices.length === 0) return null;

    const referenceText = `${payment.providerOrderId || ''} ${payment.rawReference || ''} ${
      payment.notes || ''
    }`.toUpperCase();

    // 1. Check for EXACT_INVOICE_REF (100% confidence)
    for (const inv of openInvoices) {
      const normalizedInvNum = inv.invoiceNumber.toUpperCase().trim();
      if (normalizedInvNum.length > 2 && referenceText.includes(normalizedInvNum)) {
        const allocatedAmount = Math.min(payment.unmatchedBalance, inv.balance);
        return {
          confidenceScore: 100,
          matchRule: 'EXACT_INVOICE_REF',
          customerId: inv.customerId,
          customerName: inv.customerName,
          suggestedAllocations: [
            {
              invoiceId: inv.invoiceId,
              invoiceNumber: inv.invoiceNumber,
              allocatedAmount,
              invoiceBalanceBefore: inv.balance,
              invoiceBalanceAfter: Math.max(0, inv.balance - allocatedAmount),
            },
          ],
        };
      }
    }

    // 2. Check for EXACT_AMOUNT_MATCH (95% confidence)
    // 2a. If customer is known on payment
    if (payment.customerId) {
      const customerInvoices = openInvoices.filter((inv) => inv.customerId === payment.customerId);
      const exactAmountInvoice = customerInvoices.find(
        (inv) => Math.abs(inv.balance - payment.unmatchedBalance) < 0.01
      );

      if (exactAmountInvoice) {
        return {
          confidenceScore: 95,
          matchRule: 'EXACT_AMOUNT_MATCH',
          customerId: exactAmountInvoice.customerId,
          customerName: exactAmountInvoice.customerName,
          suggestedAllocations: [
            {
              invoiceId: exactAmountInvoice.invoiceId,
              invoiceNumber: exactAmountInvoice.invoiceNumber,
              allocatedAmount: exactAmountInvoice.balance,
              invoiceBalanceBefore: exactAmountInvoice.balance,
              invoiceBalanceAfter: 0,
            },
          ],
        };
      }
    } else {
      // 2b. If customer not given, check if there is uniquely ONE open invoice with exact balance
      const exactInvoices = openInvoices.filter(
        (inv) => Math.abs(inv.balance - payment.unmatchedBalance) < 0.01
      );
      if (exactInvoices.length === 1) {
        const exactInvoice = exactInvoices[0];
        return {
          confidenceScore: 95,
          matchRule: 'EXACT_AMOUNT_MATCH',
          customerId: exactInvoice.customerId,
          customerName: exactInvoice.customerName,
          suggestedAllocations: [
            {
              invoiceId: exactInvoice.invoiceId,
              invoiceNumber: exactInvoice.invoiceNumber,
              allocatedAmount: exactInvoice.balance,
              invoiceBalanceBefore: exactInvoice.balance,
              invoiceBalanceAfter: 0,
            },
          ],
        };
      }
    }

    // 3. Check for UTR_MATCH / PTP match (85% confidence)
    const promisesMap = (await dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`)) || {};
    const pendingPromises = Object.values(promisesMap).filter((p) => p.status === 'PENDING');

    for (const promise of pendingPromises) {
      const isCustomerMatch = payment.customerId && promise.customerId === payment.customerId;
      const isAmountMatch = Math.abs(promise.amount - payment.amount) < 0.01;

      if ((isCustomerMatch && isAmountMatch) || (isCustomerMatch && payment.utr)) {
        // Allocate across the promise's invoices
        const targetInvoices = openInvoices.filter((inv) => promise.invoiceIds.includes(inv.invoiceId));
        if (targetInvoices.length > 0) {
          let remainingPayment = payment.unmatchedBalance;
          const allocations: PaymentAllocation[] = [];

          for (const inv of targetInvoices) {
            if (remainingPayment <= 0) break;
            const alloc = Math.min(remainingPayment, inv.balance);
            allocations.push({
              invoiceId: inv.invoiceId,
              invoiceNumber: inv.invoiceNumber,
              allocatedAmount: alloc,
              invoiceBalanceBefore: inv.balance,
              invoiceBalanceAfter: Math.max(0, inv.balance - alloc),
            });
            remainingPayment -= alloc;
          }

          if (allocations.length > 0) {
            const customer = customersMap[promise.customerId];
            return {
              confidenceScore: 85,
              matchRule: 'UTR_MATCH',
              customerId: promise.customerId,
              customerName: customer ? customer.name : 'Matched Customer',
              suggestedAllocations: allocations,
            };
          }
        }
      }
    }

    // 4. Check for DATE_WINDOW_MATCH / FIFO allocation for known customer (80% confidence)
    if (payment.customerId) {
      const customerInvoices = openInvoices
        .filter((inv) => inv.customerId === payment.customerId)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); // oldest first

      if (customerInvoices.length > 0) {
        let remainingPayment = payment.unmatchedBalance;
        const allocations: PaymentAllocation[] = [];

        for (const inv of customerInvoices) {
          if (remainingPayment <= 0) break;
          const alloc = Math.min(remainingPayment, inv.balance);
          allocations.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocatedAmount: alloc,
            invoiceBalanceBefore: inv.balance,
            invoiceBalanceAfter: Math.max(0, inv.balance - alloc),
          });
          remainingPayment -= alloc;
        }

        if (allocations.length > 0) {
          return {
            confidenceScore: 80,
            matchRule: 'DATE_WINDOW_MATCH',
            customerId: payment.customerId,
            customerName: payment.customerName || 'Customer',
            suggestedAllocations: allocations,
          };
        }
      }
    }

    // No confident match found
    return null;
  },

  /**
   * Runs the automated reconciliation engine on an ingested payment.
   * If confidence is >= 95%, commits the match automatically, applies balance
   * reductions, and queues a Tally write-back receipt voucher.
   * If confidence is 80-94%, places the reconciliation into PENDING_APPROVAL.
   */
  async runAutoReconciliation(
    tenantId: string,
    payment: Payment
  ): Promise<Reconciliation | null> {
    const match = await this.evaluatePaymentMatch(tenantId, payment);
    if (!match) return null;

    const now = Date.now();
    const reconciliationId = `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const totalAllocated = match.suggestedAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

    const isAutoApproved = match.confidenceScore >= 95;
    const status = isAutoApproved ? 'AUTO_RECONCILED' : 'PENDING_APPROVAL';

    const reconciliation: Reconciliation = {
      reconciliationId,
      tenantId,
      paymentId: payment.paymentId,
      customerId: match.customerId,
      customerName: match.customerName,
      paymentAmount: payment.amount,
      allocations: match.suggestedAllocations,
      totalAllocated,
      confidenceScore: match.confidenceScore,
      matchRule: match.matchRule,
      status,
      approvedBy: isAutoApproved ? 'SYSTEM_AUTO' : null,
      approvedAt: isAutoApproved ? now : null,
      tallyWriteBackStatus: isAutoApproved ? 'QUEUED' : 'NOT_REQUIRED',
      tallyVoucherNumber: null,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`reconciliations/${tenantId}/${reconciliationId}`, reconciliation);

    if (isAutoApproved) {
      // Commit balances to invoices
      for (const alloc of match.suggestedAllocations) {
        await receivablesService.recordPaymentOnInvoice(tenantId, alloc.invoiceId, alloc.allocatedAmount);
      }

      // Update payment matched balance
      await paymentService.updatePaymentReconciliation(tenantId, payment.paymentId, totalAllocated);

      // Check and resolve any matching PTPs
      await this.resolveMatchingPtps(tenantId, match.customerId, match.suggestedAllocations, payment.paymentId);

      // Queue write-back command for Tally Windows Agent
      await this.queueTallyVoucherCommand(tenantId, reconciliation);

      // Refresh tenant dashboard analytics
      await receivablesService.recalculateTenantReceivables(tenantId);
    }

    return reconciliation;
  },

  /**
   * Retrieves all reconciliations for a tenant, newest first.
   */
  async getReconciliations(tenantId: string): Promise<Reconciliation[]> {
    const recMap = await dbService.get<Record<string, Reconciliation>>(`reconciliations/${tenantId}`);
    if (!recMap) return [];
    return Object.values(recMap).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Approves a reconciliation pending accountant sign-off (80% - 94% queue).
   */
  async approveReconciliation(
    tenantId: string,
    reconciliationId: string,
    approvedByUserId: string
  ): Promise<Reconciliation> {
    const rec = await dbService.get<Reconciliation>(`reconciliations/${tenantId}/${reconciliationId}`);
    if (!rec) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    const now = Date.now();

    // Commit allocations to invoices
    for (const alloc of rec.allocations) {
      await receivablesService.recordPaymentOnInvoice(tenantId, alloc.invoiceId, alloc.allocatedAmount);
    }

    // Update payment record
    await paymentService.updatePaymentReconciliation(tenantId, rec.paymentId, rec.totalAllocated);

    // Resolve any corresponding PTPs
    await this.resolveMatchingPtps(tenantId, rec.customerId, rec.allocations, rec.paymentId);

    // Update reconciliation record
    const updates: Partial<Reconciliation> = {
      status: 'APPROVED',
      approvedBy: approvedByUserId,
      approvedAt: now,
      tallyWriteBackStatus: 'QUEUED',
      updatedAt: now,
    };
    await dbService.update(`reconciliations/${tenantId}/${reconciliationId}`, updates);

    const updatedRec: Reconciliation = { ...rec, ...updates };

    // Queue Tally write-back voucher command
    await this.queueTallyVoucherCommand(tenantId, updatedRec);

    // Recalculate dashboard
    await receivablesService.recalculateTenantReceivables(tenantId);

    return updatedRec;
  },

  /**
   * Rejects an unverified match in the approval queue.
   */
  async rejectReconciliation(
    tenantId: string,
    reconciliationId: string,
    reason?: string
  ): Promise<Reconciliation> {
    const rec = await dbService.get<Reconciliation>(`reconciliations/${tenantId}/${reconciliationId}`);
    if (!rec) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    const updates: Partial<Reconciliation> = {
      status: 'REJECTED',
      notes: reason || 'Rejected by Accounts Manager',
      updatedAt: Date.now(),
    };

    await dbService.update(`reconciliations/${tenantId}/${reconciliationId}`, updates);
    return { ...rec, ...updates };
  },

  /**
   * Manually creates an approved reconciliation by allocating a payment across
   * user-selected open bills.
   */
  async createManualReconciliation(
    tenantId: string,
    paymentId: string,
    customerId: string,
    customerName: string,
    allocations: Array<{ invoiceId: string; invoiceNumber: string; amount: number }>,
    approvedByUserId: string
  ): Promise<Reconciliation> {
    const payment = await paymentService.getPaymentById(tenantId, paymentId);
    if (!payment) throw new Error('Payment not found');

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated <= 0) throw new Error('Allocated amount must be greater than zero');
    if (totalAllocated > payment.unmatchedBalance + 0.01) {
      throw new Error('Total allocation exceeds unmatched payment balance');
    }

    const invoicesMap = (await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`)) || {};
    const formattedAllocations: PaymentAllocation[] = [];

    for (const alloc of allocations) {
      const inv = invoicesMap[alloc.invoiceId];
      if (!inv) throw new Error(`Invoice ${alloc.invoiceId} not found`);

      formattedAllocations.push({
        invoiceId: alloc.invoiceId,
        invoiceNumber: alloc.invoiceNumber,
        allocatedAmount: alloc.amount,
        invoiceBalanceBefore: inv.balance,
        invoiceBalanceAfter: Math.max(0, inv.balance - alloc.amount),
      });

      // Commit to invoice balance
      await receivablesService.recordPaymentOnInvoice(tenantId, alloc.invoiceId, alloc.amount);
    }

    // Update payment record
    await paymentService.updatePaymentReconciliation(tenantId, paymentId, totalAllocated);

    // Resolve matching PTPs
    await this.resolveMatchingPtps(tenantId, customerId, formattedAllocations, paymentId);

    const now = Date.now();
    const reconciliationId = `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const reconciliation: Reconciliation = {
      reconciliationId,
      tenantId,
      paymentId,
      customerId,
      customerName,
      paymentAmount: payment.amount,
      allocations: formattedAllocations,
      totalAllocated,
      confidenceScore: 100,
      matchRule: 'MANUAL_MATCH',
      status: 'APPROVED',
      approvedBy: approvedByUserId,
      approvedAt: now,
      tallyWriteBackStatus: 'QUEUED',
      tallyVoucherNumber: null,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`reconciliations/${tenantId}/${reconciliationId}`, reconciliation);

    // Queue Tally voucher command
    await this.queueTallyVoucherCommand(tenantId, reconciliation);

    // Recalculate dashboard
    await receivablesService.recalculateTenantReceivables(tenantId);

    return reconciliation;
  },

  /**
   * Helper to resolve active Promise to Pay (PTP) records when associated invoices are paid.
   */
  async resolveMatchingPtps(
    tenantId: string,
    customerId: string,
    allocations: PaymentAllocation[],
    paymentId: string
  ): Promise<number> {
    const promisesMap = (await dbService.get<Record<string, PromiseToPay>>(`promises/${tenantId}`)) || {};
    const allocatedInvoiceIds = new Set(allocations.map((a) => a.invoiceId));
    let resolved = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const promise of Object.values(promisesMap)) {
      if (
        promise.status === 'PENDING' &&
        promise.customerId === customerId &&
        promise.invoiceIds.some((id) => allocatedInvoiceIds.has(id))
      ) {
        await dbService.update(`promises/${tenantId}/${promise.promiseId}`, {
          status: 'KEPT',
          keptDate: todayStr,
          associatedPaymentId: paymentId,
          updatedAt: Date.now(),
        });

        // Clear active PTP flags on invoices
        for (const invId of promise.invoiceIds) {
          await dbService.update(`invoices/${tenantId}/${invId}`, {
            hasActivePtp: false,
            activePtpId: null,
          });
        }
        resolved += 1;
      }
    }

    return resolved;
  },

  /**
   * Queues a receipt voucher command for the Tally Windows Agent in /tallyVoucherCommands/{tenantId}.
   */
  async queueTallyVoucherCommand(
    tenantId: string,
    reconciliation: Reconciliation
  ): Promise<TallyVoucherCommand> {
    const now = Date.now();
    const commandId = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const voucherDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 'YYYYMMDD'

    const billsAllocated = reconciliation.allocations.map((a) => ({
      billNumber: a.invoiceNumber,
      billAmount: a.allocatedAmount,
    }));

    const command: TallyVoucherCommand = {
      commandId,
      tenantId,
      deviceId: null,
      reconciliationId: reconciliation.reconciliationId,
      voucherType: 'Receipt',
      voucherDate,
      partyLedger: reconciliation.customerName || 'Sundry Debtors',
      bankOrCashLedger: 'HDFC Bank - Collections',
      amount: reconciliation.totalAllocated,
      narration: `CollectFlow Auto-Reconciled: ${reconciliation.matchRule} [Rec: ${reconciliation.reconciliationId}]`,
      billsAllocated,
      status: 'QUEUED',
      attemptCount: 0,
      lastAttemptAt: null,
      errorMessage: null,
      tallyMasterId: null,
      tallyVoucherNumber: null,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`tallyVoucherCommands/${tenantId}/${commandId}`, command);
    return command;
  },

  /**
   * Fetches all queued Tally voucher write-back commands.
   */
  async getTallyVoucherCommands(tenantId: string): Promise<TallyVoucherCommand[]> {
    const cmdMap =
      (await dbService.get<Record<string, TallyVoucherCommand>>(`tallyVoucherCommands/${tenantId}`)) || {};
    return Object.values(cmdMap).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Simulates the Tally Windows Agent pulling queued commands, creating
   * Receipt Vouchers in TallyPrime, and returning generated voucher numbers.
   */
  async simulateProcessTallyVouchers(
    tenantId: string
  ): Promise<{ processedCount: number; vouchers: TallyVoucherCommand[] }> {
    const cmdMap =
      (await dbService.get<Record<string, TallyVoucherCommand>>(`tallyVoucherCommands/${tenantId}`)) || {};
    const queuedCommands = Object.values(cmdMap).filter((cmd) => cmd.status === 'QUEUED');

    const year = new Date().getFullYear();
    const updatedCommands: TallyVoucherCommand[] = [];

    for (const cmd of queuedCommands) {
      const voucherNum = `RC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();

      const updates: Partial<TallyVoucherCommand> = {
        status: 'COMPLETED',
        tallyVoucherNumber: voucherNum,
        tallyMasterId: `mst_${Math.random().toString(36).substring(2, 9)}`,
        attemptCount: (cmd.attemptCount || 0) + 1,
        lastAttemptAt: now,
        updatedAt: now,
      };

      await dbService.update(`tallyVoucherCommands/${tenantId}/${cmd.commandId}`, updates);

      // Update reconciliation tallyWriteBackStatus & tallyVoucherNumber
      if (cmd.reconciliationId) {
        await dbService.update(`reconciliations/${tenantId}/${cmd.reconciliationId}`, {
          tallyWriteBackStatus: 'SYNCED',
          tallyVoucherNumber: voucherNum,
          updatedAt: now,
        });
      }

      updatedCommands.push({ ...cmd, ...updates });
    }

    return {
      processedCount: updatedCommands.length,
      vouchers: updatedCommands,
    };
  },
};
