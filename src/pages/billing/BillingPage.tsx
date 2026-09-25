import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  Shield,
  Download,
  Check,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Send,
  Building,
  Sliders,
  DollarSign,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { billingService, SUBSCRIPTION_PLANS } from '../../services/billingService';
import {
  TenantSubscription,
  SubscriptionPlanId,
  BillingInterval,
  BillingInvoice,
  SubscriptionPlan,
} from '../../types';

export const BillingPage: React.FC = () => {
  const { activeTenant, refreshTenantData } = useTenant();

  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('MONTHLY');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & Action States
  const [changingPlan, setChangingPlan] = useState<SubscriptionPlanId | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newUpiVpa, setNewUpiVpa] = useState('');

  // Webhook Simulator State
  const [webhookSimulating, setWebhookSimulating] = useState(false);
  const [selectedWebhookEvent, setSelectedWebhookEvent] = useState<
    'subscription.charged' | 'payment.failed' | 'subscription.halted' | 'subscription.cancelled'
  >('subscription.charged');

  useEffect(() => {
    if (!activeTenant) return;
    loadBillingData();
  }, [activeTenant?.tenantId]);

  const loadBillingData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [sub, invoices] = await Promise.all([
        billingService.getSubscription(activeTenant.tenantId),
        billingService.getBillingInvoices(activeTenant.tenantId),
      ]);
      setSubscription(sub);
      setSelectedInterval(sub.billingInterval);
      setBillingInvoices(invoices);
      setNewUpiVpa(sub.paymentMethod?.upiVpa || 'collectflow@hdfcbank');
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handlePlanChange = async (planId: SubscriptionPlanId) => {
    if (!activeTenant) return;
    setChangingPlan(planId);
    try {
      const updated = await billingService.changePlan(
        activeTenant.tenantId,
        planId,
        selectedInterval
      );
      setSubscription(updated);
      showAlert(
        'success',
        `Successfully subscribed to ${SUBSCRIPTION_PLANS[planId].name}! GST Tax Invoice generated.`
      );
      await refreshTenantData();
      await loadBillingData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to change plan');
    } finally {
      setChangingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!activeTenant) return;
    setCancelling(true);
    try {
      const updated = await billingService.cancelSubscription(
        activeTenant.tenantId,
        cancelReason,
        false // Cancel at period end
      );
      setSubscription(updated);
      setShowCancelModal(false);
      showAlert(
        'success',
        'Subscription scheduled for cancellation at the end of the current billing cycle.'
      );
      await loadBillingData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    if (!activeTenant) return;
    try {
      const updated = await billingService.reactivateSubscription(activeTenant.tenantId);
      setSubscription(updated);
      showAlert('success', 'Subscription reactivated successfully!');
      await loadBillingData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to reactivate');
    }
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    try {
      const updated = await billingService.updatePaymentMethod(activeTenant.tenantId, {
        type: 'UPI',
        brandOrBank: 'UPI AutoPay (NPCI)',
        upiVpa: newUpiVpa,
      });
      setSubscription(updated);
      setShowPaymentModal(false);
      showAlert('success', 'Default billing payment method updated successfully.');
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to update payment method');
    }
  };

  const handleSimulateWebhook = async () => {
    if (!activeTenant || !subscription) return;
    setWebhookSimulating(true);
    try {
      const res = await billingService.handleSubscriptionWebhook({
        eventId: `ev_${Date.now().toString(36)}`,
        event: selectedWebhookEvent,
        subscriptionId: subscription.subscriptionId,
        tenantId: activeTenant.tenantId,
        data: {},
        timestamp: Date.now(),
      });
      showAlert('success', `Webhook dispatched: ${res.message}`);
      await refreshTenantData();
      await loadBillingData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to process webhook');
    } finally {
      setWebhookSimulating(false);
    }
  };

  const handleDownloadInvoice = (inv: BillingInvoice) => {
    const text = `========================================================
COLLECTFLOW TECHNOLOGIES INDIA PRIVATE LIMITED
GST TAX INVOICE (SAC CODE: ${inv.sacCode})
========================================================
Invoice Number: ${inv.invoiceNumber}
Date of Issue:  ${inv.paymentDate || inv.periodStart}
Customer Name:  ${activeTenant?.legalName || activeTenant?.name}
GSTIN:          ${activeTenant?.gstin || 'Unregistered'}
Billing Period: ${inv.periodStart} to ${inv.periodEnd}
--------------------------------------------------------
Description:    ${inv.planName}
Base Amount:    INR ${inv.baseAmount.toFixed(2)}
CGST (9.0%):    INR ${(inv.taxAmount / 2).toFixed(2)}
SGST (9.0%):    INR ${(inv.taxAmount / 2).toFixed(2)}
--------------------------------------------------------
TOTAL PAID:     INR ${inv.totalAmount.toFixed(2)}
Status:         ${inv.status} (Payment ref: ${inv.utrOrReference || 'N/A'})
========================================================
Thank you for automating receivables with CollectFlow!`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNumber}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const currentPlan = subscription ? billingService.getPlan(subscription.planId) : SUBSCRIPTION_PLANS.growth;
  const isTrial = subscription?.status === 'TRIALING';
  const isGrace = subscription?.status === 'GRACE_PERIOD';
  const daysLeftInPeriod = subscription
    ? Math.max(0, Math.ceil((subscription.currentPeriodEnd - Date.now()) / 86400000))
    : 14;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Subscription & Monetization</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
              Phase 15
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your MSME SaaS subscription, usage quotas, WhatsApp reminder accounting, and GST tax invoices
          </p>
        </div>

        {/* Monthly vs Annual Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setSelectedInterval('MONTHLY')}
            className={`px-3 py-1.5 rounded-xl transition ${
              selectedInterval === 'MONTHLY'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setSelectedInterval('ANNUAL')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              selectedInterval === 'ANNUAL'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
            alert.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{alert.message}</span>
        </div>
      )}

      {/* Active Subscription Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-bold text-slate-400">Current Plan</span>
              <h2 className="text-lg font-bold">{currentPlan.name}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isTrial
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : isGrace
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {subscription?.status || 'ACTIVE'}
              </span>
              <span className="text-[11px] text-slate-400">
                ({subscription?.billingInterval === 'ANNUAL' ? 'Billed Annually' : 'Billed Monthly'})
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {isTrial
                ? `You are currently on a 14-day full feature trial. ${daysLeftInPeriod} days remaining before billing.`
                : isGrace
                ? `Payment renewal pending. 7-day grace period active until ${new Date(subscription?.gracePeriodEnd || 0).toLocaleDateString('en-IN')}.`
                : `Next automatic renewal scheduled for ${new Date(subscription?.currentPeriodEnd || 0).toLocaleDateString('en-IN')} (${daysLeftInPeriod} days).`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/15 flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {subscription?.paymentMethod?.upiVpa || 'Payment Method'}
            </button>

            {subscription?.cancelAtPeriodEnd ? (
              <button
                onClick={handleReactivate}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition shadow-md shadow-emerald-500/20"
              >
                Reactivate Plan
              </button>
            ) : (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition"
              >
                Cancel Plan
              </button>
            )}
          </div>
        </div>

        {/* Warning if in grace period */}
        {isGrace && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              Your recent subscription payment failed. Your account is in a 7-day grace period. Please update your payment method to avoid suspension of automated WhatsApp reminders and Tally synchronization.
            </span>
          </div>
        )}
      </div>

      {/* Real-time Usage Meters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Current Billing Cycle Usage Meters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Invoices Meter */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-semibold">
              <span>Invoices Processed</span>
              <span className="font-mono text-slate-800">
                {subscription?.usage.invoicesCount || 0} / {currentPlan.limits.maxInvoicesPerMonth >= 100000 ? '∞' : currentPlan.limits.maxInvoicesPerMonth}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((subscription?.usage.invoicesCount || 0) / currentPlan.limits.maxInvoicesPerMonth) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Resets on next billing cycle</div>
          </div>

          {/* Customers Meter */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-semibold">
              <span>Customer 360 Ledgers</span>
              <span className="font-mono text-slate-800">
                {subscription?.usage.customersCount || 0} / {currentPlan.limits.maxCustomers}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((subscription?.usage.customersCount || 0) / currentPlan.limits.maxCustomers) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Synced from Tally / ERP</div>
          </div>

          {/* WhatsApp Messages Meter */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-semibold">
              <span>WhatsApp Reminders</span>
              <span className="font-mono text-slate-800">
                {subscription?.usage.whatsAppMessagesSent || 0} / {currentPlan.limits.maxWhatsAppReminders}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((subscription?.usage.whatsAppMessagesSent || 0) / currentPlan.limits.maxWhatsAppReminders) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              Overage: ₹0.75 / msg (Current: ₹{subscription?.usage.whatsAppOverageCostINR || 0})
            </div>
          </div>

          {/* Team Seats */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-semibold">
              <span>Team & Devices</span>
              <span className="font-mono text-slate-800">
                {subscription?.usage.activeUsersCount || 0} users • {subscription?.usage.activeDevicesCount || 0} agent
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((subscription?.usage.activeUsersCount || 0) / currentPlan.limits.maxTeamUsers) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Allowed: {currentPlan.limits.maxTeamUsers} team seats</div>
          </div>
        </div>
      </div>

      {/* Subscription Plans Matrix */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Available Subscription Plans</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {billingService.getPlans().map((plan) => {
            const isCurrent = subscription?.planId === plan.planId;
            const price = selectedInterval === 'ANNUAL' ? plan.annualPriceINR : plan.monthlyPriceINR;
            const periodLabel = selectedInterval === 'ANNUAL' ? '/year' : '/month';

            return (
              <div
                key={plan.planId}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition relative shadow-sm ${
                  isCurrent
                    ? 'border-brand-500 ring-2 ring-brand-500/20'
                    : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>
                  </div>

                  <div className="pt-1">
                    <span className="text-2xl font-bold text-slate-900">₹{price.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-slate-500 font-medium">{periodLabel}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">+ 18% GST (SAC 998314)</div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Included Quotas & Features
                    </div>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-default"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlanChange(plan.planId)}
                      disabled={changingPlan === plan.planId}
                      className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition disabled:opacity-50"
                    >
                      {changingPlan === plan.planId ? 'Upgrading...' : `Select ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SaaS Tax Invoices History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">SaaS Tax Invoices & Receipts</h3>
            <p className="text-xs text-slate-500">
              Download GST-compliant tax invoices (SAC 998314) with CGST/SGST breakdown for input tax credit (ITC)
            </p>
          </div>
          <button
            onClick={loadBillingData}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {billingInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No tax invoices generated yet.
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3">Invoice Number</th>
                  <th className="py-3 px-3">Billing Period</th>
                  <th className="py-3 px-3">Plan Description</th>
                  <th className="py-3 px-3 text-right">Base Amount</th>
                  <th className="py-3 px-3 text-right">GST (18%)</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingInvoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {inv.periodStart} to {inv.periodEnd}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">
                      {inv.planName}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      ₹{inv.baseAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">
                      ₹{inv.taxAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ₹{inv.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        GST Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Webhook Test Console */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscription Webhook Test Console</h3>
              <p className="text-xs text-slate-400">
                Simulate inbound subscription webhooks from payment gateways (Razorpay / Stripe) to test lifecycle transitions
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">
            /api/v1/webhooks/subscription
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Simulate Event:</label>
              <select
                value={selectedWebhookEvent}
                onChange={(e: any) => setSelectedWebhookEvent(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-brand-500"
              >
                <option value="subscription.charged">subscription.charged (Automatic Monthly Renewal)</option>
                <option value="payment.failed">payment.failed (Failed AutoPay $\rightarrow$ 7-day Grace Period)</option>
                <option value="subscription.halted">subscription.halted (Suspension after Grace Period)</option>
                <option value="subscription.cancelled">subscription.cancelled (User Cancellation)</option>
              </select>
            </div>

            <button
              onClick={handleSimulateWebhook}
              disabled={webhookSimulating}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {webhookSimulating ? 'Processing Webhook...' : 'Dispatch Webhook Event'}
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Simulates gateway signatures, idempotent event deduplication, grace period enforcement, and automatic GST invoice creation in Firebase Realtime Database.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: UPDATE PAYMENT METHOD */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Update Billing Payment Method</h3>
              <p className="text-xs text-slate-500">
                Configure your UPI ID or Mandate for automatic subscription renewals
              </p>
            </div>

            <form onSubmit={handleSavePaymentMethod} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business UPI ID (AutoPay VPA) *
                </label>
                <input
                  type="text"
                  required
                  value={newUpiVpa}
                  onChange={(e) => setNewUpiVpa(e.target.value)}
                  placeholder="e.g. shreeenterprises@hdfcbank"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Supported Recurring Rails:</div>
                <div>• NPCI UPI AutoPay (All major Indian banks)</div>
                <div>• e-NACH Bank Account Mandate</div>
                <div>• Visa / Mastercard Corporate Credit Cards</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700"
                >
                  Save Payment Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCEL SUBSCRIPTION */}
      {/* ========================================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Cancel Subscription?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your subscription will remain active until the end of your billing cycle on{' '}
              <span className="font-bold">
                {new Date(subscription?.currentPeriodEnd || 0).toLocaleDateString('en-IN')}
              </span>
              . After that date, automated WhatsApp reminders and multi-user sync will be paused.
            </p>

            <div className="space-y-1 text-xs">
              <label className="block font-semibold text-slate-700">
                Reason for cancellation (optional):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let us know how we can improve..."
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
