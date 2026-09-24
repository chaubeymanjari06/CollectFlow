import { dbService } from './dbService';
import {
  Payment,
  PaymentSource,
  PaymentProvider,
  PaymentStatus,
  ReconciliationStatus,
} from '../types';

export interface IngestPaymentInput {
  customerId?: string | null;
  customerName?: string;
  source: PaymentSource;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  utr?: string | null;
  amount: number;
  currency?: string;
  paymentDate?: string;
  status?: PaymentStatus;
  rawReference?: string | null;
  idempotencyKey?: string;
  notes?: string | null;
}

export const paymentService = {
  /**
   * Ingests a payment record idempotently into /payments/{tenantId}/{paymentId}.
   * If an idempotencyKey or providerPaymentId already exists, skips duplicate insertion.
   */
  async ingestPayment(
    tenantId: string,
    input: IngestPaymentInput
  ): Promise<{ payment: Payment; isDuplicate: boolean }> {
    const idempotencyKey =
      input.idempotencyKey ||
      input.providerPaymentId ||
      `idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check if idempotency key has already been processed
    const existingKey = await dbService.get<{ paymentId: string }>(
      `idempotencyKeys/${tenantId}/${idempotencyKey}`
    );
    if (existingKey) {
      const existingPayment = await dbService.get<Payment>(
        `payments/${tenantId}/${existingKey.paymentId}`
      );
      if (existingPayment) {
        return { payment: existingPayment, isDuplicate: true };
      }
    }

    const now = Date.now();
    const paymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentDate = input.paymentDate || new Date(now).toISOString();

    const payment: Payment = {
      paymentId,
      tenantId,
      customerId: input.customerId || null,
      customerName: input.customerName || (input.customerId ? 'Customer' : 'Direct Payer'),
      source: input.source,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId || null,
      providerOrderId: input.providerOrderId || null,
      utr: input.utr || null,
      amount: input.amount,
      currency: input.currency || 'INR',
      paymentDate,
      status: input.status || 'SUCCESS',
      reconciliationStatus: 'UNMATCHED',
      matchedAmount: 0,
      unmatchedBalance: input.amount,
      rawReference: input.rawReference || null,
      idempotencyKey,
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    // Save payment in database
    await dbService.set(`payments/${tenantId}/${paymentId}`, payment);

    // Record idempotency reference
    await dbService.set(`idempotencyKeys/${tenantId}/${idempotencyKey}`, {
      paymentId,
      createdAt: now,
    });

    return { payment, isDuplicate: false };
  },

  /**
   * Retrieves all payments for a tenant, sorted newest first.
   */
  async getPayments(tenantId: string): Promise<Payment[]> {
    const paymentsMap = await dbService.get<Record<string, Payment>>(`payments/${tenantId}`);
    if (!paymentsMap) return [];
    return Object.values(paymentsMap).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Retrieves a single payment by ID.
   */
  async getPaymentById(tenantId: string, paymentId: string): Promise<Payment | null> {
    return await dbService.get<Payment>(`payments/${tenantId}/${paymentId}`);
  },

  /**
   * Updates the matched amount and balance of a payment after reconciliation.
   */
  async updatePaymentReconciliation(
    tenantId: string,
    paymentId: string,
    allocatedAmountDelta: number
  ): Promise<Payment | null> {
    const payment = await dbService.get<Payment>(`payments/${tenantId}/${paymentId}`);
    if (!payment) return null;

    const newMatchedAmount = Math.min(payment.amount, payment.matchedAmount + allocatedAmountDelta);
    const newUnmatchedBalance = Math.max(0, payment.amount - newMatchedAmount);

    let reconciliationStatus: ReconciliationStatus = 'UNMATCHED';
    if (newUnmatchedBalance === 0 && newMatchedAmount > 0) {
      reconciliationStatus = 'FULLY_MATCHED';
    } else if (newMatchedAmount > 0) {
      reconciliationStatus = 'PARTIALLY_MATCHED';
    }

    const updates: Partial<Payment> = {
      matchedAmount: newMatchedAmount,
      unmatchedBalance: newUnmatchedBalance,
      reconciliationStatus,
      updatedAt: Date.now(),
    };

    await dbService.update(`payments/${tenantId}/${paymentId}`, updates);
    return { ...payment, ...updates };
  },

  /**
   * Simulates an incoming payment webhook from Razorpay, Cashfree, or Bank UPI.
   */
  async simulateGatewayWebhook(
    tenantId: string,
    payload: {
      customerId?: string;
      customerName?: string;
      invoiceReference?: string;
      utr?: string;
      amount: number;
      provider: 'razorpay' | 'cashfree' | 'bank';
    }
  ): Promise<{ payment: Payment; isDuplicate: boolean }> {
    const providerId = `txn_${payload.provider.substring(0, 3)}_${Date.now().toString(36)}`;
    const utr =
      payload.utr ||
      `UTR${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;

    const rawRef = payload.invoiceReference
      ? `Payment received for ${payload.invoiceReference} via ${payload.provider.toUpperCase()} Ref:${utr}`
      : `Bank transfer via ${payload.provider.toUpperCase()} Ref:${utr}`;

    return this.ingestPayment(tenantId, {
      customerId: payload.customerId,
      customerName: payload.customerName,
      source: payload.provider === 'bank' ? 'tally_bank' : (payload.provider as PaymentSource),
      provider: payload.provider as PaymentProvider,
      providerPaymentId: providerId,
      providerOrderId: payload.invoiceReference ? `order_${payload.invoiceReference}` : undefined,
      utr,
      amount: payload.amount,
      rawReference: rawRef,
      notes: payload.invoiceReference
        ? `Bill ref: ${payload.invoiceReference}`
        : 'Automated webhook ingestion',
    });
  },

  /**
   * Records a manual bank or cash receipt created by an Accounts Executive.
   */
  async recordManualReceipt(
    tenantId: string,
    data: {
      customerId: string;
      customerName: string;
      amount: number;
      paymentDate: string;
      utr?: string;
      rawReference?: string;
      notes?: string;
    }
  ): Promise<{ payment: Payment; isDuplicate: boolean }> {
    return this.ingestPayment(tenantId, {
      customerId: data.customerId,
      customerName: data.customerName,
      source: 'manual',
      provider: 'bank',
      utr: data.utr || `MAN-${Date.now().toString().slice(-6)}`,
      amount: data.amount,
      paymentDate: data.paymentDate ? new Date(data.paymentDate).toISOString() : undefined,
      rawReference: data.rawReference || `Manual receipt recorded for ${data.customerName}`,
      notes: data.notes,
    });
  },
};
