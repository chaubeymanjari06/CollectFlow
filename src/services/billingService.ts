import { dbService } from './dbService';
import {
  SubscriptionPlanId,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionUsage,
  TenantSubscription,
  BillingInvoice,
  SubscriptionWebhookEvent,
  SubscriptionEntitlements,
  Tenant,
  Invoice,
  Customer,
  Device,
} from '../types';

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  starter: {
    planId: 'starter',
    name: 'Starter MSME',
    badge: 'Basic',
    description: 'Essential automated receivables and Tally synchronization for growing businesses',
    monthlyPriceINR: 999,
    annualPriceINR: 9990, // ~17% annual discount
    trialDays: 14,
    limits: {
      maxInvoicesPerMonth: 250,
      maxCustomers: 50,
      maxWhatsAppReminders: 100,
      maxTeamUsers: 2,
      maxDevices: 1,
    },
    entitlements: {
      tallySync: true,
      zohoAndSheetsIntegrations: false,
      aiCopilotAssistant: false,
      autoReconciliation: true,
      partnerPortalAccess: false,
      prioritySupport: false,
      customSenderId: false,
    },
    features: [
      'TallyPrime / ERP 9 Windows Agent Sync',
      'Up to 250 open invoices/month',
      '50 Customer 360 accounts',
      '100 WhatsApp payment reminders',
      'UPI dynamic QR code generation',
      'Confidence-based auto reconciliation',
      'Email and chat support',
    ],
  },
  growth: {
    planId: 'growth',
    name: 'Growth Automation Pro',
    badge: 'Most Popular',
    description: 'Full receivables intelligence, multi-channel workflows, AI copilot, and integrations',
    monthlyPriceINR: 2999,
    annualPriceINR: 28990, // ~20% annual discount
    trialDays: 14,
    limits: {
      maxInvoicesPerMonth: 2000,
      maxCustomers: 500,
      maxWhatsAppReminders: 1000,
      maxTeamUsers: 5,
      maxDevices: 3,
    },
    entitlements: {
      tallySync: true,
      zohoAndSheetsIntegrations: true,
      aiCopilotAssistant: true,
      autoReconciliation: true,
      partnerPortalAccess: true,
      prioritySupport: true,
      customSenderId: false,
    },
    features: [
      'Everything in Starter MSME',
      'Up to 2,000 invoices/month',
      '500 Customer 360 accounts',
      '1,000 WhatsApp reminders + PTP engine',
      'AI Receivables Copilot & Smart Drafter',
      'Zoho Books & Google Sheets direct sync',
      'Excel/CSV batch ingestion wizard',
      'Tally Receipt Voucher write-back',
      'CA / Tally Partner Portal access',
      'Priority WhatsApp & phone support',
    ],
  },
  enterprise: {
    planId: 'enterprise',
    name: 'Enterprise Automation',
    badge: 'Scale & Corp',
    description: 'Customized receivables infrastructure for mid-market enterprises & high-volume dealers',
    monthlyPriceINR: 5999,
    annualPriceINR: 59990,
    trialDays: 30,
    limits: {
      maxInvoicesPerMonth: 100000, // Unlimited
      maxCustomers: 10000,
      maxWhatsAppReminders: 5000,
      maxTeamUsers: 50,
      maxDevices: 20,
    },
    entitlements: {
      tallySync: true,
      zohoAndSheetsIntegrations: true,
      aiCopilotAssistant: true,
      autoReconciliation: true,
      partnerPortalAccess: true,
      prioritySupport: true,
      customSenderId: true,
    },
    features: [
      'Everything in Growth Automation Pro',
      'Unlimited invoices and customer ledgers',
      '5,000 WhatsApp reminders included',
      'Custom WhatsApp Business verified name',
      'Multi-branch & multi-company consolidation',
      'Dedicated Account Manager & SLA guarantee',
      'Custom webhook triggers & ERP API access',
      'Quarterly CA audit & Section 43B(h) report',
    ],
  },
};

export const billingService = {
  // =========================================================================
  // 1. PLANS CATALOG
  // =========================================================================

  getPlans(): SubscriptionPlan[] {
    return Object.values(SUBSCRIPTION_PLANS);
  },

  getPlan(planId: SubscriptionPlanId): SubscriptionPlan {
    return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.growth;
  },

  // =========================================================================
  // 2. TENANT SUBSCRIPTION MANAGEMENT
  // =========================================================================

  async getSubscription(tenantId: string): Promise<TenantSubscription> {
    let sub = await dbService.get<TenantSubscription>(`subscriptions/${tenantId}`);
    if (sub) {
      // Refresh current live usage meters
      const usage = await this.getUsageMeters(tenantId);
      sub.usage = usage;
      return sub;
    }

    // Provision initial default 14-day trial on Growth plan
    const now = Date.now();
    const trialDays = 14;
    const trialEnd = now + trialDays * 86400000;
    const usage = await this.getUsageMeters(tenantId);

    const initialSub: TenantSubscription = {
      subscriptionId: `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      planId: 'growth',
      billingInterval: 'MONTHLY',
      status: 'TRIALING',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd,
      cancelAtPeriodEnd: false,
      usage,
      paymentMethod: {
        type: 'UPI',
        brandOrBank: 'HDFC Bank',
        upiVpa: 'collectflow@hdfcbank',
      },
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`subscriptions/${tenantId}`, initialSub);

    // Also seed initial sample billing invoices if none exist
    await this.seedInitialBillingInvoices(tenantId, initialSub.subscriptionId);

    return initialSub;
  },

  async changePlan(
    tenantId: string,
    planId: SubscriptionPlanId,
    billingInterval: BillingInterval
  ): Promise<TenantSubscription> {
    const current = await this.getSubscription(tenantId);
    const plan = this.getPlan(planId);
    const now = Date.now();

    const periodDays = billingInterval === 'ANNUAL' ? 365 : 30;
    const currentPeriodEnd = now + periodDays * 86400000;

    const updated: TenantSubscription = {
      ...current,
      planId,
      billingInterval,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: undefined,
      cancellationReason: undefined,
      gracePeriodEnd: undefined,
      updatedAt: now,
    };

    await dbService.set(`subscriptions/${tenantId}`, updated);
    await dbService.update(`tenants/${tenantId}`, {
      planId,
      status: 'ACTIVE',
      updatedAt: now,
    });

    // Generate formal tax invoice for this activation
    await this.generateInvoice(tenantId, {
      planId,
      interval: billingInterval,
      status: 'PAID',
    });

    return updated;
  },

  async cancelSubscription(
    tenantId: string,
    reason?: string,
    immediate = false
  ): Promise<TenantSubscription> {
    const current = await this.getSubscription(tenantId);
    const now = Date.now();

    const updated: TenantSubscription = {
      ...current,
      status: immediate ? 'CANCELLED' : current.status,
      cancelAtPeriodEnd: !immediate,
      cancelledAt: now,
      cancellationReason: reason || 'User requested cancellation',
      updatedAt: now,
    };

    await dbService.set(`subscriptions/${tenantId}`, updated);
    if (immediate) {
      await dbService.update(`tenants/${tenantId}`, { status: 'SUSPENDED' });
    }
    return updated;
  },

  async reactivateSubscription(tenantId: string): Promise<TenantSubscription> {
    const current = await this.getSubscription(tenantId);
    const updated: TenantSubscription = {
      ...current,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      cancelledAt: undefined,
      cancellationReason: undefined,
      updatedAt: Date.now(),
    };
    await dbService.set(`subscriptions/${tenantId}`, updated);
    await dbService.update(`tenants/${tenantId}`, { status: 'ACTIVE' });
    return updated;
  },

  async updatePaymentMethod(
    tenantId: string,
    paymentMethod: TenantSubscription['paymentMethod']
  ): Promise<TenantSubscription> {
    const current = await this.getSubscription(tenantId);
    const updated: TenantSubscription = {
      ...current,
      paymentMethod,
      updatedAt: Date.now(),
    };
    await dbService.set(`subscriptions/${tenantId}`, updated);
    return updated;
  },

  // =========================================================================
  // 3. USAGE ACCOUNTING & FEATURE ENTITLEMENTS
  // =========================================================================

  async getUsageMeters(tenantId: string): Promise<SubscriptionUsage> {
    const [invoices, customers, devices] = await Promise.all([
      dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`),
      dbService.get<Record<string, Customer>>(`customers/${tenantId}`),
      dbService.get<Record<string, Device>>(`devices/${tenantId}`),
    ]);

    const invoicesCount = invoices ? Object.keys(invoices).length : 9;
    const customersCount = customers ? Object.keys(customers).length : 5;
    const activeDevicesCount = devices ? Object.keys(devices).length : 1;

    // Calculate WhatsApp messages sent
    const messages = await dbService.get<Record<string, any>>(`messages/${tenantId}`);
    const whatsAppMessagesSent = messages ? Object.keys(messages).length : 14;

    const whatsAppLimit = 1000;
    const overageCount = Math.max(0, whatsAppMessagesSent - whatsAppLimit);
    const whatsAppOverageCostINR = Math.round(overageCount * 0.75); // ₹0.75 per message over quota

    return {
      invoicesCount,
      customersCount,
      whatsAppMessagesSent,
      whatsAppLimit,
      whatsAppOverageCostINR,
      activeUsersCount: 2,
      activeDevicesCount,
    };
  },

  async checkEntitlement(
    tenantId: string,
    feature: keyof SubscriptionEntitlements
  ): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.getSubscription(tenantId);
    const plan = this.getPlan(sub.planId);

    if (sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
      return {
        allowed: false,
        reason: `Your subscription is currently ${sub.status.toLowerCase()}. Please renew to access this feature.`,
      };
    }

    const isAllowed = plan.entitlements[feature];
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `This feature requires upgrading to the Growth or Enterprise plan.`,
      };
    }

    return { allowed: true };
  },

  async checkUsageLimit(
    tenantId: string,
    metric: 'invoices' | 'customers' | 'whatsapp' | 'users' | 'devices'
  ): Promise<{ allowed: boolean; current: number; limit: number; pctUsed: number }> {
    const sub = await this.getSubscription(tenantId);
    const plan = this.getPlan(sub.planId);
    const usage = sub.usage;

    let current = 0;
    let limit = 0;

    switch (metric) {
      case 'invoices':
        current = usage.invoicesCount;
        limit = plan.limits.maxInvoicesPerMonth;
        break;
      case 'customers':
        current = usage.customersCount;
        limit = plan.limits.maxCustomers;
        break;
      case 'whatsapp':
        current = usage.whatsAppMessagesSent;
        limit = plan.limits.maxWhatsAppReminders;
        break;
      case 'users':
        current = usage.activeUsersCount;
        limit = plan.limits.maxTeamUsers;
        break;
      case 'devices':
        current = usage.activeDevicesCount;
        limit = plan.limits.maxDevices;
        break;
    }

    const pctUsed = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const allowed = current < limit;

    return { allowed, current, limit, pctUsed };
  },

  // =========================================================================
  // 4. SAAS INVOICE GENERATION (GST COMPLIANT)
  // =========================================================================

  async getBillingInvoices(tenantId: string): Promise<BillingInvoice[]> {
    const data = await dbService.get<Record<string, BillingInvoice>>(`billingInvoices/${tenantId}`);
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.createdAt - a.createdAt);
  },

  async generateInvoice(
    tenantId: string,
    params: {
      planId: SubscriptionPlanId;
      interval: BillingInterval;
      status?: 'PAID' | 'PENDING';
    }
  ): Promise<BillingInvoice> {
    const plan = this.getPlan(params.planId);
    const baseAmount = params.interval === 'ANNUAL' ? plan.annualPriceINR : plan.monthlyPriceINR;

    const taxRatePct = 18; // 18% GST (SAC 998314 - Software SaaS)
    const taxAmount = Math.round(baseAmount * 0.18);
    const totalAmount = baseAmount + taxAmount;

    const now = Date.now();
    const invoiceId = `binv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `CF-INV-2026-${randomSeq}`;

    const todayStr = new Date().toISOString().split('T')[0];
    const periodDays = params.interval === 'ANNUAL' ? 365 : 30;
    const periodEndStr = new Date(now + periodDays * 86400000).toISOString().split('T')[0];

    const invoice: BillingInvoice = {
      invoiceId,
      invoiceNumber,
      tenantId,
      subscriptionId: `sub_${tenantId}`,
      planName: `${plan.name} (${params.interval === 'ANNUAL' ? 'Annual Plan' : 'Monthly Plan'})`,
      billingInterval: params.interval,
      periodStart: todayStr,
      periodEnd: periodEndStr,
      baseAmount,
      taxRatePct,
      taxAmount,
      totalAmount,
      currency: 'INR',
      sacCode: '998314', // Services Accounting Code for SaaS
      status: params.status || 'PAID',
      paymentDate: params.status === 'PAID' ? todayStr : undefined,
      paymentMethod: 'UPI AutoPay / NetBanking',
      utrOrReference: `RAZOR-SUB-${Date.now().toString(36).toUpperCase()}`,
      createdAt: now,
    };

    await dbService.set(`billingInvoices/${tenantId}/${invoiceId}`, invoice);
    return invoice;
  },

  async seedInitialBillingInvoices(tenantId: string, subscriptionId: string): Promise<void> {
    const now = Date.now();

    const sampleInvoices: BillingInvoice[] = [
      {
        invoiceId: 'binv_demo_01',
        invoiceNumber: 'CF-INV-2026-1048',
        tenantId,
        subscriptionId,
        planName: 'Growth Automation Pro (Monthly Plan)',
        billingInterval: 'MONTHLY',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
        baseAmount: 2999,
        taxRatePct: 18,
        taxAmount: 540,
        totalAmount: 3539,
        currency: 'INR',
        sacCode: '998314',
        status: 'PAID',
        paymentDate: '2026-08-01',
        paymentMethod: 'UPI (shree@hdfcbank)',
        utrOrReference: 'HDFC-UPI-99221188',
        createdAt: now - 55 * 86400000,
      },
      {
        invoiceId: 'binv_demo_02',
        invoiceNumber: 'CF-INV-2026-1182',
        tenantId,
        subscriptionId,
        planName: 'Growth Automation Pro (Monthly Plan)',
        billingInterval: 'MONTHLY',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        baseAmount: 2999,
        taxRatePct: 18,
        taxAmount: 540,
        totalAmount: 3539,
        currency: 'INR',
        sacCode: '998314',
        status: 'PAID',
        paymentDate: '2026-09-01',
        paymentMethod: 'UPI (shree@hdfcbank)',
        utrOrReference: 'HDFC-UPI-88334411',
        createdAt: now - 24 * 86400000,
      },
    ];

    for (const inv of sampleInvoices) {
      await dbService.set(`billingInvoices/${tenantId}/${inv.invoiceId}`, inv);
    }
  },

  // =========================================================================
  // 5. SUBSCRIPTION WEBHOOK PROCESSOR
  // =========================================================================

  async handleSubscriptionWebhook(
    event: SubscriptionWebhookEvent
  ): Promise<{ success: boolean; message: string }> {
    const { tenantId, event: eventType } = event;
    const currentSub = await this.getSubscription(tenantId);
    const now = Date.now();

    switch (eventType) {
      case 'subscription.charged': {
        const periodDays = currentSub.billingInterval === 'ANNUAL' ? 365 : 30;
        const currentPeriodEnd = now + periodDays * 86400000;

        await dbService.update(`subscriptions/${tenantId}`, {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd,
          gracePeriodEnd: null,
          updatedAt: now,
        });

        await dbService.update(`tenants/${tenantId}`, { status: 'ACTIVE' });
        await this.generateInvoice(tenantId, {
          planId: currentSub.planId,
          interval: currentSub.billingInterval,
          status: 'PAID',
        });

        return { success: true, message: `Subscription renewed successfully through period ${new Date(currentPeriodEnd).toLocaleDateString('en-IN')}` };
      }

      case 'payment.failed': {
        // Grant 7-day grace period
        const gracePeriodEnd = now + 7 * 86400000;
        await dbService.update(`subscriptions/${tenantId}`, {
          status: 'GRACE_PERIOD',
          gracePeriodEnd,
          updatedAt: now,
        });

        await dbService.update(`tenants/${tenantId}`, { status: 'PAST_DUE' });

        return {
          success: true,
          message: `Payment failed. Account entered 7-day grace period ending on ${new Date(gracePeriodEnd).toLocaleDateString('en-IN')}`,
        };
      }

      case 'subscription.halted': {
        await dbService.update(`subscriptions/${tenantId}`, {
          status: 'EXPIRED',
          updatedAt: now,
        });
        await dbService.update(`tenants/${tenantId}`, { status: 'SUSPENDED' });
        return { success: true, message: 'Subscription halted. Tenant account suspended.' };
      }

      case 'subscription.cancelled': {
        await dbService.update(`subscriptions/${tenantId}`, {
          status: 'CANCELLED',
          cancelAtPeriodEnd: false,
          cancelledAt: now,
          updatedAt: now,
        });
        return { success: true, message: 'Subscription cancelled.' };
      }

      default:
        return { success: true, message: `Unhandled event: ${eventType}` };
    }
  },
};
