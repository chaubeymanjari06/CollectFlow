import { describe, it, expect, vi, beforeEach } from 'vitest';
import { billingService, SUBSCRIPTION_PLANS } from '../../services/billingService';
import { dbService } from '../../services/dbService';

describe('Phase 15: Billing Service (SaaS Subscriptions, GST Invoices & Usage Meters)', () => {
  const tenantId = 'ten_test_msme';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PLANS CATALOG
  // =========================================================================
  describe('Plan Catalog', () => {
    it('should return all available plans (starter, growth, enterprise)', () => {
      const plans = billingService.getPlans();
      expect(plans).toHaveLength(3);
      const planIds = plans.map((p) => p.planId);
      expect(planIds).toContain('starter');
      expect(planIds).toContain('growth');
      expect(planIds).toContain('enterprise');
    });

    it('should retrieve plan by planId and fallback to growth if not found', () => {
      const starter = billingService.getPlan('starter');
      expect(starter.name).toBe('Starter MSME');
      expect(starter.monthlyPriceINR).toBe(999);
      expect(starter.limits.maxInvoicesPerMonth).toBe(250);

      const growth = billingService.getPlan('growth');
      expect(growth.name).toBe('Growth Automation Pro');
      expect(growth.monthlyPriceINR).toBe(2999);

      const fallback = billingService.getPlan('non_existent' as any);
      expect(fallback.planId).toBe('growth');
    });
  });

  // =========================================================================
  // 2. TENANT SUBSCRIPTION LIFECYCLE
  // =========================================================================
  describe('Tenant Subscription Lifecycle', () => {
    it('should provision a 14-day Growth trial when no subscription exists', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const sub = await billingService.getSubscription(tenantId);

      expect(sub.tenantId).toBe(tenantId);
      expect(sub.planId).toBe('growth');
      expect(sub.status).toBe('TRIALING');
      expect(sub.billingInterval).toBe('MONTHLY');
      expect(sub.trialEnd).toBeGreaterThan(Date.now());
      expect(sub.paymentMethod?.type).toBe('UPI');

      expect(setSpy).toHaveBeenCalledWith(
        `subscriptions/${tenantId}`,
        expect.objectContaining({ planId: 'growth', status: 'TRIALING' })
      );
    });

    it('should return existing subscription with updated usage meters', async () => {
      const mockSub = {
        subscriptionId: 'sub_existing',
        tenantId,
        planId: 'starter',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: Date.now() - 5 * 86400000,
        currentPeriodEnd: Date.now() + 25 * 86400000,
        cancelAtPeriodEnd: false,
        usage: {
          invoicesCount: 10,
          customersCount: 5,
          whatsAppMessagesSent: 20,
          whatsAppLimit: 100,
          whatsAppOverageCostINR: 0,
          activeUsersCount: 1,
          activeDevicesCount: 1,
        },
        paymentMethod: { type: 'UPI', upiVpa: 'test@upi' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `subscriptions/${tenantId}`) return mockSub;
        if (path === `invoices/${tenantId}`) return { inv1: {}, inv2: {} };
        if (path === `customers/${tenantId}`) return { c1: {} };
        return null;
      });

      const sub = await billingService.getSubscription(tenantId);
      expect(sub.subscriptionId).toBe('sub_existing');
      expect(sub.planId).toBe('starter');
      expect(sub.status).toBe('ACTIVE');
      expect(sub.usage.invoicesCount).toBe(2);
      expect(sub.usage.customersCount).toBe(1);
    });

    it('should change plan and generate tax invoice upon upgrade', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        subscriptionId: 'sub_123',
        tenantId,
        planId: 'starter',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 86400000,
        cancelAtPeriodEnd: false,
        usage: {} as any,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      const invoiceSpy = vi.spyOn(billingService, 'generateInvoice').mockResolvedValue({} as any);

      const updated = await billingService.changePlan(tenantId, 'enterprise', 'ANNUAL');

      expect(updated.planId).toBe('enterprise');
      expect(updated.billingInterval).toBe('ANNUAL');
      expect(updated.status).toBe('ACTIVE');

      expect(setSpy).toHaveBeenCalledWith(`subscriptions/${tenantId}`, expect.objectContaining({
        planId: 'enterprise',
        billingInterval: 'ANNUAL',
      }));
      expect(updateSpy).toHaveBeenCalledWith(`tenants/${tenantId}`, expect.objectContaining({
        planId: 'enterprise',
        status: 'ACTIVE',
      }));
      expect(invoiceSpy).toHaveBeenCalledWith(tenantId, {
        planId: 'enterprise',
        interval: 'ANNUAL',
        status: 'PAID',
      });
    });

    it('should handle cancelSubscription at period end vs immediately', async () => {
      const mockSub = {
        subscriptionId: 'sub_cancel',
        tenantId,
        planId: 'growth',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 15 * 86400000,
        cancelAtPeriodEnd: false,
        usage: {} as any,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.spyOn(billingService, 'getSubscription').mockResolvedValue(mockSub as any);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      // Cancel at period end
      const scheduled = await billingService.cancelSubscription(tenantId, 'Too expensive', false);
      expect(scheduled.cancelAtPeriodEnd).toBe(true);
      expect(scheduled.cancellationReason).toBe('Too expensive');
      expect(scheduled.status).toBe('ACTIVE');

      // Cancel immediately
      const immediate = await billingService.cancelSubscription(tenantId, 'No longer needed', true);
      expect(immediate.status).toBe('CANCELLED');
      expect(immediate.cancelAtPeriodEnd).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith(`tenants/${tenantId}`, { status: 'SUSPENDED' });
    });

    it('should reactivate a cancelled subscription', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        subscriptionId: 'sub_reactivate',
        tenantId,
        planId: 'growth',
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
        cancellationReason: 'Testing',
      } as any);

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const reactivated = await billingService.reactivateSubscription(tenantId);
      expect(reactivated.status).toBe('ACTIVE');
      expect(reactivated.cancelAtPeriodEnd).toBe(false);
      expect(reactivated.cancellationReason).toBeUndefined();
      expect(setSpy).toHaveBeenCalledWith(`subscriptions/${tenantId}`, expect.objectContaining({ status: 'ACTIVE' }));
      expect(updateSpy).toHaveBeenCalledWith(`tenants/${tenantId}`, { status: 'ACTIVE' });
    });

    it('should update payment method', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        subscriptionId: 'sub_pm',
        tenantId,
        planId: 'starter',
        status: 'ACTIVE',
      } as any);

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const updated = await billingService.updatePaymentMethod(tenantId, {
        type: 'UPI',
        upiVpa: 'newpayment@icici',
        brandOrBank: 'ICICI Bank',
      });

      expect(updated.paymentMethod?.upiVpa).toBe('newpayment@icici');
      expect(setSpy).toHaveBeenCalledWith(`subscriptions/${tenantId}`, expect.objectContaining({
        paymentMethod: expect.objectContaining({ upiVpa: 'newpayment@icici' }),
      }));
    });
  });

  // =========================================================================
  // 3. USAGE ACCOUNTING & FEATURE ENTITLEMENTS
  // =========================================================================
  describe('Usage Accounting & Entitlements', () => {
    it('should compute real-time usage meters and WhatsApp overage costs', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `invoices/${tenantId}`) {
          return { inv1: {}, inv2: {}, inv3: {} };
        }
        if (path === `customers/${tenantId}`) {
          return { c1: {}, c2: {} };
        }
        if (path === `devices/${tenantId}`) {
          return { dev1: {} };
        }
        if (path === `messages/${tenantId}`) {
          // 1200 messages (200 above 1000 limit)
          const msgs: Record<string, any> = {};
          for (let i = 0; i < 1200; i++) msgs[`msg_${i}`] = {};
          return msgs;
        }
        return null;
      });

      const usage = await billingService.getUsageMeters(tenantId);
      expect(usage.invoicesCount).toBe(3);
      expect(usage.customersCount).toBe(2);
      expect(usage.activeDevicesCount).toBe(1);
      expect(usage.whatsAppMessagesSent).toBe(1200);
      expect(usage.whatsAppLimit).toBe(1000);
      // 200 overage * 0.75 = ₹150
      expect(usage.whatsAppOverageCostINR).toBe(150);
    });

    it('should verify feature entitlements based on active plan', async () => {
      // Starter plan checks
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'starter',
        status: 'ACTIVE',
      } as any);

      const tally = await billingService.checkEntitlement(tenantId, 'tallySync');
      expect(tally.allowed).toBe(true);

      const copilot = await billingService.checkEntitlement(tenantId, 'aiCopilotAssistant');
      expect(copilot.allowed).toBe(false);
      expect(copilot.reason).toContain('requires upgrading to the Growth or Enterprise plan');

      // Expired plan checks
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'growth',
        status: 'EXPIRED',
      } as any);

      const expiredCheck = await billingService.checkEntitlement(tenantId, 'tallySync');
      expect(expiredCheck.allowed).toBe(false);
      expect(expiredCheck.reason).toContain('subscription is currently expired');
    });

    it('should check usage limits and calculate pctUsed accurately', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'starter',
        status: 'ACTIVE',
        usage: {
          invoicesCount: 125, // Limit 250 -> 50%
          customersCount: 50,  // Limit 50 -> 100%
          whatsAppMessagesSent: 10,
          whatsAppLimit: 100,
          whatsAppOverageCostINR: 0,
          activeUsersCount: 1,
          activeDevicesCount: 1,
        },
      } as any);

      const invCheck = await billingService.checkUsageLimit(tenantId, 'invoices');
      expect(invCheck.allowed).toBe(true);
      expect(invCheck.current).toBe(125);
      expect(invCheck.limit).toBe(250);
      expect(invCheck.pctUsed).toBe(50);

      const custCheck = await billingService.checkUsageLimit(tenantId, 'customers');
      expect(custCheck.allowed).toBe(false);
      expect(custCheck.current).toBe(50);
      expect(custCheck.limit).toBe(50);
      expect(custCheck.pctUsed).toBe(100);
    });
  });

  // =========================================================================
  // 4. GST TAX INVOICES (SAC 998314)
  // =========================================================================
  describe('GST Tax Invoice Generation', () => {
    it('should generate a 18% GST tax invoice with SAC 998314 code', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const invoice = await billingService.generateInvoice(tenantId, {
        planId: 'growth',
        interval: 'MONTHLY',
        status: 'PAID',
      });

      expect(invoice.tenantId).toBe(tenantId);
      expect(invoice.baseAmount).toBe(2999);
      expect(invoice.taxRatePct).toBe(18);
      expect(invoice.taxAmount).toBe(540); // Math.round(2999 * 0.18) = 540
      expect(invoice.totalAmount).toBe(3539);
      expect(invoice.sacCode).toBe('998314');
      expect(invoice.currency).toBe('INR');
      expect(invoice.status).toBe('PAID');
      expect(invoice.invoiceNumber).toMatch(/^CF-INV-2026-\d{4}$/);

      expect(setSpy).toHaveBeenCalledWith(
        `billingInvoices/${tenantId}/${invoice.invoiceId}`,
        invoice
      );
    });

    it('should retrieve billing invoices sorted by date descending', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        inv_old: { invoiceId: 'inv_old', createdAt: 1000 },
        inv_new: { invoiceId: 'inv_new', createdAt: 2000 },
      });

      const list = await billingService.getBillingInvoices(tenantId);
      expect(list).toHaveLength(2);
      expect(list[0].invoiceId).toBe('inv_new');
      expect(list[1].invoiceId).toBe('inv_old');
    });
  });

  // =========================================================================
  // 5. SUBSCRIPTION WEBHOOK PROCESSOR
  // =========================================================================
  describe('Subscription Webhook Processor', () => {
    it('should handle subscription.charged and renew active period', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'growth',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
      } as any);

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      const invoiceSpy = vi.spyOn(billingService, 'generateInvoice').mockResolvedValue({} as any);

      const res = await billingService.handleSubscriptionWebhook({
        eventId: 'evt_1',
        event: 'subscription.charged',
        tenantId,
        subscriptionId: 'sub_123',
        amountINR: 3539,
        timestamp: Date.now(),
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('renewed successfully');
      expect(updateSpy).toHaveBeenCalledWith(
        `subscriptions/${tenantId}`,
        expect.objectContaining({ status: 'ACTIVE' })
      );
      expect(invoiceSpy).toHaveBeenCalledWith(tenantId, {
        planId: 'growth',
        interval: 'MONTHLY',
        status: 'PAID',
      });
    });

    it('should handle payment.failed by putting subscription into 7-day grace period', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'growth',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
      } as any);

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const res = await billingService.handleSubscriptionWebhook({
        eventId: 'evt_2',
        event: 'payment.failed',
        tenantId,
        subscriptionId: 'sub_123',
        amountINR: 3539,
        timestamp: Date.now(),
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('7-day grace period');
      expect(updateSpy).toHaveBeenCalledWith(
        `subscriptions/${tenantId}`,
        expect.objectContaining({ status: 'GRACE_PERIOD' })
      );
      expect(updateSpy).toHaveBeenCalledWith(
        `tenants/${tenantId}`,
        { status: 'PAST_DUE' }
      );
    });

    it('should handle subscription.halted by suspending tenant account', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'growth',
      } as any);

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const res = await billingService.handleSubscriptionWebhook({
        eventId: 'evt_3',
        event: 'subscription.halted',
        tenantId,
        subscriptionId: 'sub_123',
        amountINR: 3539,
        timestamp: Date.now(),
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        `subscriptions/${tenantId}`,
        expect.objectContaining({ status: 'EXPIRED' })
      );
      expect(updateSpy).toHaveBeenCalledWith(
        `tenants/${tenantId}`,
        { status: 'SUSPENDED' }
      );
    });

    it('should handle subscription.cancelled event', async () => {
      vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
        tenantId,
        planId: 'growth',
      } as any);

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const res = await billingService.handleSubscriptionWebhook({
        eventId: 'evt_4',
        event: 'subscription.cancelled',
        tenantId,
        subscriptionId: 'sub_123',
        amountINR: 3539,
        timestamp: Date.now(),
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        `subscriptions/${tenantId}`,
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });
  });
});
