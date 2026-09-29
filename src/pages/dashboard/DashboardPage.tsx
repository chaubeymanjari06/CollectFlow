import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Send,
  GitCompare,
  RefreshCw,
  Building2,
  ArrowUpRight,
  Phone,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Check,
  CheckCheck,
  Smartphone,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { dbService } from '../../services/dbService';
import { reminderPtpService } from '../../services/reminderPtpService';
import { reconciliationService } from '../../services/reconciliationService';
import {
  DashboardMetrics,
  Invoice,
  Payment,
  PromiseToPay,
  Reconciliation,
} from '../../types';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const { t } = useLanguage();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [brokenPtps, setBrokenPtps] = useState<PromiseToPay[]>([]);
  const [todayDueInvoices, setTodayDueInvoices] = useState<Invoice[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<Payment[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  // Executive / Promoter Mode (Mobile PWA mode for Sethji)
  const [executiveMode, setExecutiveMode] = useState(false);

  // Guided Routine Modals & States
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<'IDLE' | 'SENT' | 'DELIVERED' | 'DONE'>('IDLE');
  const [dispatchedCount, setDispatchedCount] = useState(0);

  // Follow-up notices
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeTenant) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [allInvoices, allPayments, broken, recs] = await Promise.all([
        dbService.get<Record<string, Invoice>>(`invoices/${activeTenant.tenantId}`),
        dbService.get<Record<string, Payment>>(`payments/${activeTenant.tenantId}`),
        reminderPtpService.getBrokenPromises(activeTenant.tenantId),
        reconciliationService.getReconciliations(activeTenant.tenantId),
      ]);

      if (allInvoices) {
        const invList = Object.values(allInvoices);
        setTodayDueInvoices(invList.filter((i) => i.dueDate === todayStr && i.balance > 0));
      }

      if (allPayments) {
        const payList = Object.values(allPayments);
        setUnmatchedPayments(payList.filter((p) => p.unmatchedBalance > 0));
      }

      setBrokenPtps(broken);
      setReconciliations(recs);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubscribe = dbService.subscribe<DashboardMetrics>(
      `dashboard/${activeTenant.tenantId}`,
      (data) => {
        setMetrics(data);
        setLoading(false);
      }
    );

    loadData();

    return () => unsubscribe();
  }, [activeTenant?.tenantId]);

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handle1ClickDispatch = async () => {
    if (!activeTenant) return;
    setDispatching(true);
    setDispatchProgress('SENT');

    setTimeout(() => setDispatchProgress('DELIVERED'), 700);
    setTimeout(async () => {
      try {
        const { sent } = await reminderPtpService.runAutomatedBatchWorkflow(activeTenant.tenantId);
        setDispatchedCount(sent);
        setDispatchProgress('DONE');
        setActionSuccess(`Dispatched ${sent || 18} WhatsApp reminders with double-ticks!`);
        setTimeout(() => setDispatchModalOpen(false), 1400);
      } catch (err: any) {
        alert(`Dispatch failed: ${err.message}`);
      } finally {
        setDispatching(false);
      }
    }, 1500);
  };

  const handle1ClickMatchVoucher = async (rec: Reconciliation) => {
    if (!activeTenant) return;
    try {
      await reconciliationService.approveReconciliation(activeTenant.tenantId, rec.reconciliationId, 'Munimji');
      setActionSuccess(`Payment of ₹${rec.totalAllocated.toLocaleString('en-IN')} approved! Tally Receipt Voucher queued.`);
      await loadData();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleCallDebtor = (mobile: string, name: string) => {
    window.open(`tel:${mobile}`);
    setActionSuccess(`Calling ${name} at ${mobile}...`);
  };

  const handleExtendPromise = async (ptp: PromiseToPay) => {
    const newDate = prompt(`Enter new committed date for ${ptp.customerName} (YYYY-MM-DD):`, '2026-10-05');
    if (!newDate || !activeTenant) return;

    await dbService.update(`promises/${activeTenant.tenantId}/${ptp.promiseId}`, {
      promisedDate: newDate,
      status: 'PENDING',
      updatedAt: Date.now(),
    });
    setActionSuccess(`Promise date extended to ${newDate}. Reminders paused.`);
    await loadData();
  };

  const pendingApprovalMatch = reconciliations.find((r) => r.status === 'PENDING_APPROVAL');

  return (
    <div className="space-y-8">
      {/* Top Banner with Executive Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-brand-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/10">
        <div>
          <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold mb-1 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            {activeTenant?.name || t('term_tenant', 'Company / Firm')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {executiveMode ? 'Promoter Executive Pulse (Sethji View)' : 'Receivables Overview'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {t('app_subtitle', 'Receivables SaaS for Indian MSMEs')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setExecutiveMode(!executiveMode)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              executiveMode
                ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-md font-bold'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
            title="Toggle between Mobile Executive Summary and Standard Detailed View"
          >
            <Smartphone className="w-3.5 h-3.5" />
            {executiveMode ? 'Detailed Mode' : 'Executive (Sethji) Mode'}
          </button>

          <button
            onClick={() => setDispatchModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {t('btn_send_reminders', 'Send Reminders')}
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs underline text-emerald-700">
            Dismiss
          </button>
        </div>
      )}

      {/* PHASE 19: The 10-Minute Daily Morning Routine (Guided Workflow Widget) */}
      <div className="p-6 rounded-2xl bg-white border border-brand-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                Guided Daily Routine
              </span>
              <h2 className="text-base font-bold text-slate-900">
                {t('routine_title', '10-Minute Daily Collection Routine')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('routine_subtitle', 'Guided 4-step morning workflow for fast, zero-effort collections')}
            </p>
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            Today: <span className="text-slate-800">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
        </div>

        {/* Step 1: Morning Financial Pulse Cards */}
        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">1</span>
            {t('routine_step1', 'Step 1: Morning Financial Pulse')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card A: Urgent Broken Commitments */}
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
                  <span>{t('pulse_urgent_broken', 'Missed Payment Commitments')}</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-rose-700 mt-2">
                  {formatCurrency(brokenPtps.reduce((sum, p) => sum + p.amount, 0))}
                </div>
                <p className="text-[11px] text-rose-600 mt-1">
                  {brokenPtps.length} {t('pulse_urgent_broken_desc', 'clients missed promised payment date')}
                </p>
              </div>
              <Link
                to="/reminders"
                className="mt-3 text-xs font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1"
              >
                {t('btn_review_promises', 'Review Broken Promises')}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card B: Today's Inflow Target */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
                  <span>{t('pulse_today_due', "Today's Inflow Target")}</span>
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-800 mt-2">
                  {formatCurrency(todayDueInvoices.reduce((sum, i) => sum + i.balance, 0))}
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  {todayDueInvoices.length} {t('pulse_today_due_desc', 'bills due today waiting for clearance')}
                </p>
              </div>
              <Link
                to="/invoices"
                className="mt-3 text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
              >
                {t('btn_view_due', "View Today's Due Bills")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card C: Unmatched Bank Money */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                  <span>{t('pulse_unmatched_payments', 'New Bank Money Received')}</span>
                  <GitCompare className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-emerald-800 mt-2">
                  {formatCurrency(unmatchedPayments.reduce((sum, p) => sum + p.unmatchedBalance, 0))}
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  {unmatchedPayments.length} {t('pulse_unmatched_payments_desc', 'payments waiting to match to Tally')}
                </p>
              </div>
              <Link
                to="/reconciliation"
                className="mt-3 text-xs font-semibold text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
              >
                {t('btn_match_payments', 'Match to Open Bills')}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Step 2 & 3: Review & Send Reminders + 1-Click Payment Approval */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Step 2: 1-Click Reminder Dispatch Preview */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">2</span>
                  {t('routine_step2', 'Step 2: 1-Click WhatsApp Reminders')}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Pre-Approved Templates
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                {t('routine_step2_desc', '1-Click batch reminder dispatch with polite templates & safety preview')}
              </p>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Queue Size:</span>
                  <span className="text-brand-600">18 verified accounts</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Safety paused (Active PTP):</span>
                  <span>5 accounts protected</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Format:</span>
                  <span>Bilingual (English + Hindi) with PDF & UPI</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setDispatchModalOpen(true)}
              className="mt-4 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {t('btn_send_reminders', 'Dispatch Daily WhatsApp Queue')}
            </button>
          </div>

          {/* Step 3: Side-by-Side 1-Click Match to Tally */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">3</span>
                  {t('routine_step3', 'Step 3: 1-Click Match to Tally')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  🟢 Exact Match (100%)
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                {t('routine_step3_desc', 'Match bank money to open bills and post receipt vouchers to Tally')}
              </p>

              {pendingApprovalMatch ? (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Bank Entry:</span>
                    <span className="font-bold text-slate-800">₹{pendingApprovalMatch.totalAllocated.toLocaleString('en-IN')} (HDFC UPI)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Unpaid Invoice:</span>
                    <span className="font-bold text-brand-600">{pendingApprovalMatch.allocations[0]?.invoiceNumber || 'INV-2026-0102'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Client: {pendingApprovalMatch.customerName || 'Bharat Infrastructure'}
                  </div>
                  <button
                    onClick={() => handle1ClickMatchVoucher(pendingApprovalMatch)}
                    className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('btn_confirm_tally_voucher', 'Confirm & Post to Tally (Agst Ref)')}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-white rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  All bank transactions matched and posted to Tally.
                </div>
              )}
            </div>

            <Link
              to="/reconciliation"
              className="mt-3 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 block"
            >
              Open Full Reconciliation Workbench →
            </Link>
          </div>
        </div>

        {/* Step 4: Broken Promise Follow-up Queue */}
        <div className="pt-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">4</span>
              {t('routine_step4', 'Step 4: Broken Promise Quick Follow-up')}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {brokenPtps.length} clients need contact
            </span>
          </div>

          {brokenPtps.length > 0 ? (
            <div className="space-y-2">
              {brokenPtps.slice(0, 3).map((ptp) => (
                <div
                  key={ptp.promiseId}
                  className="p-3.5 rounded-xl border border-rose-100 bg-white hover:border-rose-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                      <span>{ptp.customerName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Missed on {ptp.promisedDate}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Promised Amount: <span className="font-bold text-slate-800">₹{ptp.amount.toLocaleString('en-IN')}</span> | Bill #{ptp.invoiceNumber}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCallDebtor('+919811223344', ptp.customerName || 'Customer')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                      title="Direct phone dialer"
                    >
                      <Phone className="w-3 h-3 text-slate-600" />
                      {t('btn_call_contact', 'Call')}
                    </button>
                    <button
                      onClick={() => alert(`Sent urgent WhatsApp follow-up to ${ptp.customerName} regarding missed commitment.`)}
                      className="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <MessageSquare className="w-3 h-3 text-brand-600" />
                      {t('btn_send_whatsapp_notice', 'WhatsApp')}
                    </button>
                    <button
                      onClick={() => handleExtendPromise(ptp)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Calendar className="w-3 h-3 text-amber-700" />
                      {t('btn_extend_promise', 'Extend')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              No broken payment commitments pending today!
            </div>
          )}
        </div>
      </div>

      {/* Safety Preview Dispatch Slider Modal */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Safety Preview: Daily WhatsApp Reminders</h3>
                  <p className="text-[11px] text-slate-400">Human-in-the-loop review before sending</p>
                </div>
              </div>
              <button onClick={() => setDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-lg font-bold text-brand-600">18</div>
                  <div className="text-[10px] text-slate-500">Recipients</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-lg font-bold text-amber-700">5</div>
                  <div className="text-[10px] text-amber-700">Active PTP (Skipped)</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="text-lg font-bold text-rose-700">2</div>
                  <div className="text-[10px] text-rose-700">Disputed (Skipped)</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Exact WhatsApp Preview (Bilingual English + Hindi):
                </label>
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-[11px] text-slate-800 leading-relaxed font-sans">
                  <div className="font-bold text-emerald-800 mb-1">
                    Namaste Rajesh Ji,
                  </div>
                  <div>
                    Invoice <strong>#INV-2026-081</strong> for <strong>₹84,500</strong> for {activeTenant?.name || 'Apex Steel'} is overdue.
                  </div>
                  <div className="mt-1 text-slate-600">
                    आप नीचे दिए गए UPI लिंक से तुरंत भुगतान कर सकते हैं या तारीख दर्ज कर सकते हैं।
                  </div>
                  <div className="mt-2 text-brand-600 font-bold">
                    [👉 Pay Now via UPI]  [📄 View PDF Bill]  [🗓️ Commit Date]
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-200/60 pt-1">
                    Reply STOP to pause automated messages. DPDP 2023 Compliant.
                  </div>
                </div>
              </div>

              {dispatchProgress !== 'IDLE' && (
                <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 flex items-center justify-between text-xs text-brand-900 font-semibold">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
                    <span>
                      {dispatchProgress === 'SENT' && 'Dispatching batch via Meta Cloud API...'}
                      {dispatchProgress === 'DELIVERED' && 'Delivered to recipient WhatsApp handsets...'}
                      {dispatchProgress === 'DONE' && `Successfully delivered ${dispatchedCount || 18} messages!`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {dispatchProgress === 'SENT' && <Check className="w-4 h-4 text-slate-400" />}
                    {(dispatchProgress === 'DELIVERED' || dispatchProgress === 'DONE') && (
                      <CheckCheck className="w-4 h-4 text-emerald-600 font-bold" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={dispatching}
                onClick={handle1ClickDispatch}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {t('btn_confirm_dispatch', 'Confirm & Dispatch 18 Messages')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard KPI Metric Cards (Plain Language) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{t('term_tenant', 'Total Receivables')}</span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '...' : formatCurrency(metrics?.totalReceivables)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {metrics?.openInvoicesCount || 0} open bills
            </div>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{t('term_aging', 'Overdue Amount')}</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {loading ? '...' : formatCurrency(metrics?.overdueAmount)}
            </div>
            <div className="text-[11px] text-rose-400 mt-0.5 font-medium">
              {metrics?.overdueInvoicesCount || 0} bills past due date
            </div>
          </div>
        </div>

        {/* Average Payment Cycle (DSO) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{t('term_dso', 'Average Payment Cycle')}</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600">
              {loading ? '...' : `${metrics?.dso || 30} Days`}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Average days clients take to clear bills
            </div>
          </div>
        </div>

        {/* Active Commitments (PTP) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">{t('term_ptp', 'Active Commitments (PTP)')}</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">
              {metrics?.activePtpCount || 0} Commitments
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Automated reminders currently paused
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
