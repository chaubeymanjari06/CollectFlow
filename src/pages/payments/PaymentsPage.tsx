import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  Zap,
  Search,
  Building2,
  ExternalLink,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import { reconciliationService } from '../../services/reconciliationService';
import { dbService } from '../../services/dbService';
import { Payment, Customer, Invoice, ReconciliationStatus } from '../../types';
import { Link } from 'react-router-dom';

export const PaymentsPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const { userProfile } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showManualReceiptModal, setShowManualReceiptModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Webhook Form State
  const [webhookProvider, setWebhookProvider] = useState<'razorpay' | 'cashfree' | 'bank'>('razorpay');
  const [webhookCustomerId, setWebhookCustomerId] = useState('');
  const [webhookInvoiceRef, setWebhookInvoiceRef] = useState('');
  const [webhookAmount, setWebhookAmount] = useState<number>(50000);
  const [webhookUtr, setWebhookUtr] = useState('');

  // Manual Receipt Form State
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualAmount, setManualAmount] = useState<number>(25000);
  const [manualUtr, setManualUtr] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualNotes, setManualNotes] = useState('');

  const loadData = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      const [allPayments, custMap, invMap] = await Promise.all([
        paymentService.getPayments(activeTenant.tenantId),
        dbService.get<Record<string, Customer>>(`customers/${activeTenant.tenantId}`),
        dbService.get<Record<string, Invoice>>(`invoices/${activeTenant.tenantId}`),
      ]);

      setPayments(allPayments);
      setCustomers(custMap ? Object.values(custMap) : []);
      setInvoices(invMap ? Object.values(invMap) : []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenant]);

  // Derived calculations
  const totalAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const matchedAmount = payments.reduce((acc, p) => acc + p.matchedAmount, 0);
  const unmatchedBalance = payments.reduce((acc, p) => acc + p.unmatchedBalance, 0);
  const fullyMatchedCount = payments.filter((p) => p.reconciliationStatus === 'FULLY_MATCHED').length;

  const filteredPayments = payments.filter((p) => {
    const matchesFilter =
      filterStatus === 'ALL' ||
      p.reconciliationStatus === filterStatus ||
      p.source === filterStatus;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      p.paymentId.toLowerCase().includes(q) ||
      (p.customerName && p.customerName.toLowerCase().includes(q)) ||
      (p.utr && p.utr.toLowerCase().includes(q)) ||
      (p.rawReference && p.rawReference.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || webhookAmount <= 0) return;

    try {
      const selectedCust = customers.find((c) => c.customerId === webhookCustomerId);

      const result = await paymentService.simulateGatewayWebhook(activeTenant.tenantId, {
        customerId: webhookCustomerId || undefined,
        customerName: selectedCust ? selectedCust.name : undefined,
        invoiceReference: webhookInvoiceRef.trim() || undefined,
        utr: webhookUtr.trim() || undefined,
        amount: Number(webhookAmount),
        provider: webhookProvider,
      });

      // Automatically trigger confidence-based matching check
      const rec = await reconciliationService.runAutoReconciliation(
        activeTenant.tenantId,
        result.payment
      );

      if (rec && rec.status === 'AUTO_RECONCILED') {
        setActionMessage(
          `Payment of ₹${webhookAmount.toLocaleString('en-IN')} ingested and AUTO-RECONCILED with ${rec.matchRule} (100% confidence)!`
        );
      } else if (rec && rec.status === 'PENDING_APPROVAL') {
        setActionMessage(
          `Payment ingested and queued in Reconciliation Approval Queue (${rec.confidenceScore}% confidence).`
        );
      } else {
        setActionMessage(
          `Payment of ₹${webhookAmount.toLocaleString('en-IN')} ingested successfully into Payments Ledger.`
        );
      }

      setShowWebhookModal(false);
      setWebhookInvoiceRef('');
      setWebhookUtr('');
      await loadData();
    } catch (err: any) {
      alert(`Webhook simulation failed: ${err.message}`);
    }
  };

  const handleRecordManualReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !manualCustomerId || manualAmount <= 0) return;

    try {
      const selectedCust = customers.find((c) => c.customerId === manualCustomerId);
      if (!selectedCust) return;

      const result = await paymentService.recordManualReceipt(activeTenant.tenantId, {
        customerId: manualCustomerId,
        customerName: selectedCust.name,
        amount: Number(manualAmount),
        paymentDate: manualDate,
        utr: manualUtr.trim() || undefined,
        notes: manualNotes.trim() || undefined,
      });

      // Run auto-reconciliation check
      const rec = await reconciliationService.runAutoReconciliation(
        activeTenant.tenantId,
        result.payment
      );

      if (rec && rec.status === 'AUTO_RECONCILED') {
        setActionMessage(
          `Manual receipt of ₹${manualAmount.toLocaleString('en-IN')} recorded & AUTO-RECONCILED!`
        );
      } else if (rec && rec.status === 'PENDING_APPROVAL') {
        setActionMessage(
          `Manual receipt recorded and added to Reconciliation Approval Queue (${rec.confidenceScore}% confidence).`
        );
      } else {
        setActionMessage(
          `Manual receipt of ₹${manualAmount.toLocaleString('en-IN')} recorded successfully.`
        );
      }

      setShowManualReceiptModal(false);
      setManualNotes('');
      setManualUtr('');
      await loadData();
    } catch (err: any) {
      alert(`Failed to record receipt: ${err.message}`);
    }
  };

  const handleQuickReconcile = async (payment: Payment) => {
    if (!activeTenant) return;
    try {
      const rec = await reconciliationService.runAutoReconciliation(activeTenant.tenantId, payment);
      if (rec && rec.status === 'AUTO_RECONCILED') {
        setActionMessage(
          `Payment ${payment.paymentId} AUTO-RECONCILED! Queued Tally receipt voucher.`
        );
      } else if (rec && rec.status === 'PENDING_APPROVAL') {
        setActionMessage(
          `Match found (${rec.confidenceScore}% confidence). Placed in Reconciliation Approval tab.`
        );
      } else {
        setActionMessage(
          `No automatic match found. Please use the Manual Allocation tab on Reconciliation page.`
        );
      }
      await loadData();
    } catch (err: any) {
      alert(`Reconciliation error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-brand-600" />
            Payments & UPI Ingestion
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time gateway webhook capture, bank UTR tracking, and payment ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWebhookModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate Webhook
          </button>
          <button
            onClick={() => setShowManualReceiptModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-brand-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Manual Receipt
          </button>
          <button
            onClick={loadData}
            title="Refresh payments"
            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Ingested
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              ₹{totalAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{payments.length} transactions</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Fully Matched
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              ₹{matchedAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-brand-600 font-medium mt-0.5">
              {fullyMatchedCount} settled bills
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Unallocated Balance
            </div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">
              ₹{unmatchedBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">
              Needs reconciliation
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Reconciliation
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">Ready to match</div>
            <Link
              to="/reconciliation"
              className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1 mt-1"
            >
              Open Engine <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'UNMATCHED', 'PARTIALLY_MATCHED', 'FULLY_MATCHED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL'
                ? 'All Payments'
                : st === 'UNMATCHED'
                ? 'Unmatched'
                : st === 'PARTIALLY_MATCHED'
                ? 'Partially Matched'
                : 'Fully Matched'}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer, UTR, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Payment / UTR</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Gateway / Source</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">Matching Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No payments found matching criteria. Ingest via Webhook simulation or Record Manual Receipt.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{p.paymentId}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {p.utr || 'No UTR specified'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.customerName || 'Direct / Unlinked'}
                      </div>
                      {p.rawReference && (
                        <div
                          className="text-[11px] text-slate-500 max-w-xs truncate mt-0.5"
                          title={p.rawReference}
                        >
                          {p.rawReference}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                          p.source === 'razorpay'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : p.source === 'cashfree'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : p.source === 'upi_qr'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.source}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 uppercase font-mono">
                        {p.provider}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-slate-900 text-sm">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </div>
                      {p.matchedAmount > 0 && (
                        <div className="text-[11px] text-emerald-600 font-medium">
                          Matched: ₹{p.matchedAmount.toLocaleString('en-IN')}
                        </div>
                      )}
                      {p.unmatchedBalance > 0 && (
                        <div className="text-[10px] text-amber-600">
                          Rem: ₹{p.unmatchedBalance.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          p.reconciliationStatus === 'FULLY_MATCHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.reconciliationStatus === 'PARTIALLY_MATCHED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {p.reconciliationStatus === 'FULLY_MATCHED' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                        {p.reconciliationStatus.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {p.unmatchedBalance > 0 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleQuickReconcile(p)}
                            title="Run Auto-Reconciliation"
                            className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold transition"
                          >
                            Auto Match
                          </button>
                          <Link
                            to="/reconciliation"
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                          >
                            Split
                          </Link>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Simulation Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Simulate Payment Webhook</h3>
                  <p className="text-[11px] text-slate-500">
                    Test automated gateway callback ingestion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWebhookModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateWebhook} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gateway Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['razorpay', 'cashfree', 'bank'] as const).map((prov) => (
                    <button
                      type="button"
                      key={prov}
                      onClick={() => setWebhookProvider(prov)}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold capitalize transition ${
                        webhookProvider === prov
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer (Optional)</label>
                <select
                  value={webhookCustomerId}
                  onChange={(e) => setWebhookCustomerId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="">-- Select Customer or Leave for Direct Match --</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.name} (₹{c.metrics?.totalReceivable?.toLocaleString('en-IN') || 0} due)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Invoice Reference in Webhook (Optional for 100% Exact Match)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-0012"
                  value={webhookInvoiceRef}
                  onChange={(e) => setWebhookInvoiceRef(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={webhookAmount}
                  onChange={(e) => setWebhookAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank UTR / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate UTR"
                  value={webhookUtr}
                  onChange={(e) => setWebhookUtr(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow hover:opacity-95"
                >
                  Dispatch Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Receipt Modal */}
      {showManualReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Bank / Cash Receipt</h3>
                  <p className="text-[11px] text-slate-500">
                    Log an offline payment received in bank or cash
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowManualReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordManualReceipt} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={manualCustomerId}
                  onChange={(e) => setManualCustomerId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="">-- Choose Paying Customer --</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl font-bold focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank UTR / Cheque Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC-98712398"
                  value={manualUtr}
                  onChange={(e) => setManualUtr(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Narration / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received via NEFT into collection account"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualReceiptModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold shadow hover:bg-brand-700"
                >
                  Save & Ingest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
