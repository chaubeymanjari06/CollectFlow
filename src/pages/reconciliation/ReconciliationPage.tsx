import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  Layers,
  Send,
  Building2,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { reconciliationService } from '../../services/reconciliationService';
import { paymentService } from '../../services/paymentService';
import { dbService } from '../../services/dbService';
import {
  Reconciliation,
  Payment,
  Invoice,
  Customer,
  TallyVoucherCommand,
} from '../../types';

export const ReconciliationPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const { userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'APPROVAL' | 'MANUAL' | 'TALLY' | 'HISTORY'>('APPROVAL');
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tallyCommands, setTallyCommands] = useState<TallyVoucherCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Manual Matching Form State
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Tally Simulation State
  const [syncingTally, setSyncingTally] = useState(false);

  const loadData = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      const [allRecs, allPayments, allCmds, invMap, custMap] = await Promise.all([
        reconciliationService.getReconciliations(activeTenant.tenantId),
        paymentService.getPayments(activeTenant.tenantId),
        reconciliationService.getTallyVoucherCommands(activeTenant.tenantId),
        dbService.get<Record<string, Invoice>>(`invoices/${activeTenant.tenantId}`),
        dbService.get<Record<string, Customer>>(`customers/${activeTenant.tenantId}`),
      ]);

      setReconciliations(allRecs);
      setPayments(allPayments);
      setTallyCommands(allCmds);
      setInvoices(invMap ? Object.values(invMap) : []);
      setCustomers(custMap ? Object.values(custMap) : []);
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenant]);

  const pendingApprovals = reconciliations.filter((r) => r.status === 'PENDING_APPROVAL');
  const queuedTallyCommands = tallyCommands.filter((c) => c.status === 'QUEUED');
  const unmatchedPayments = payments.filter((p) => p.unmatchedBalance > 0);

  const handleApprove = async (recId: string) => {
    if (!activeTenant) return;
    try {
      const updated = await reconciliationService.approveReconciliation(
        activeTenant.tenantId,
        recId,
        userProfile?.name || 'Accountant'
      );
      setActionNotice(
        `Reconciliation approved! Payment matched and Tally Receipt Voucher queued.`
      );
      await loadData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async (recId: string) => {
    if (!activeTenant) return;
    if (!confirm('Are you sure you want to reject this match suggestion?')) return;
    try {
      await reconciliationService.rejectReconciliation(activeTenant.tenantId, recId);
      setActionNotice('Match suggestion rejected. Payment returned to manual queue.');
      await loadData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const handleSelectPaymentForManual = (pId: string) => {
    setSelectedPaymentId(pId);
    const payment = payments.find((p) => p.paymentId === pId);
    if (payment && payment.customerId) {
      setSelectedCustomerId(payment.customerId);
    } else {
      setSelectedCustomerId('');
    }
    setManualAllocations({});
  };

  const handleAllocationAmountChange = (invoiceId: string, amount: number) => {
    setManualAllocations((prev) => ({
      ...prev,
      [invoiceId]: Math.max(0, amount),
    }));
  };

  const currentSelectedPayment = payments.find((p) => p.paymentId === selectedPaymentId);
  const totalAllocatedInForm = Object.values(manualAllocations).reduce((sum, val) => sum + val, 0);

  const customerOpenInvoices = invoices.filter(
    (inv) => inv.customerId === selectedCustomerId && inv.balance > 0
  );

  const handleSubmitManualReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !currentSelectedPayment || !selectedCustomerId) return;

    if (totalAllocatedInForm <= 0) {
      alert('Please allocate an amount greater than zero to at least one invoice.');
      return;
    }

    if (totalAllocatedInForm > currentSelectedPayment.unmatchedBalance + 0.01) {
      alert('Total allocated amount exceeds the unmatched payment balance.');
      return;
    }

    try {
      setManualSubmitting(true);
      const cust = customers.find((c) => c.customerId === selectedCustomerId);
      const allocations = Object.entries(manualAllocations)
        .filter(([_, amt]) => amt > 0)
        .map(([invId, amt]) => {
          const inv = invoices.find((i) => i.invoiceId === invId);
          return {
            invoiceId: invId,
            invoiceNumber: inv ? inv.invoiceNumber : 'INV',
            amount: amt,
          };
        });

      await reconciliationService.createManualReconciliation(
        activeTenant.tenantId,
        selectedPaymentId,
        selectedCustomerId,
        cust ? cust.name : 'Customer',
        allocations,
        userProfile?.name || 'Accountant'
      );

      setActionNotice(
        `Manual match completed for ₹${totalAllocatedInForm.toLocaleString('en-IN')}. Tally write-back queued.`
      );
      setSelectedPaymentId('');
      setSelectedCustomerId('');
      setManualAllocations({});
      await loadData();
    } catch (err: any) {
      alert(`Manual reconciliation failed: ${err.message}`);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleSimulateTallySync = async () => {
    if (!activeTenant) return;
    try {
      setSyncingTally(true);
      const res = await reconciliationService.simulateProcessTallyVouchers(activeTenant.tenantId);
      setActionNotice(
        `Windows Agent Sync Complete: ${res.processedCount} Receipt Vouchers created in TallyPrime!`
      );
      await loadData();
    } catch (err: any) {
      alert(`Tally sync simulation failed: ${err.message}`);
    } finally {
      setSyncingTally(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-brand-600" />
            Confidence-Based Reconciliation Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated payment matching, accountant approval workflows, and Tally voucher write-back
          </p>
        </div>

        <div className="flex items-center gap-2">
          {queuedTallyCommands.length > 0 && (
            <button
              onClick={handleSimulateTallySync}
              disabled={syncingTally}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingTally ? 'animate-spin' : ''}`} />
              Sync {queuedTallyCommands.length} to Tally
            </button>
          )}
          <button
            onClick={loadData}
            title="Refresh reconciliation data"
            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Confidence Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-emerald-900">95%–100% Auto-Reconciliation</div>
            <p className="text-emerald-700 mt-0.5 leading-relaxed">
              Auto-reconciles exact bill references or exact amount matches immediately and queues Tally vouchers.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              80%–94% Approval Queue
              {pendingApprovals.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] rounded-full font-bold">
                  {pendingApprovals.length}
                </span>
              )}
            </div>
            <p className="text-amber-700 mt-0.5 leading-relaxed">
              Customer & UTR/FIFO suggestions requiring one-click accountant verification.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-200 text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              Manual Allocation Queue
              {unmatchedPayments.length > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 text-[10px] rounded-full font-bold">
                  {unmatchedPayments.length}
                </span>
              )}
            </div>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Unidentified or partial payments to manually split across invoices.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab('APPROVAL')}
          className={`pb-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'APPROVAL'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Approval Queue ({pendingApprovals.length})
        </button>

        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`pb-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'MANUAL'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Manual Matching & Split ({unmatchedPayments.length})
        </button>

        <button
          onClick={() => setActiveTab('TALLY')}
          className={`pb-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'TALLY'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          Tally Write-Back Queue ({queuedTallyCommands.length} queued)
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`pb-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'HISTORY'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit History ({reconciliations.length})
        </button>
      </div>

      {/* Tab 1: Approval Queue (80-94%) */}
      {activeTab === 'APPROVAL' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Pending Approvals</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                All high-confidence payments were either auto-reconciled or already verified by your accounting team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingApprovals.map((rec) => (
                <div
                  key={rec.reconciliationId}
                  className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          {rec.confidenceScore}% Confidence Match
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 uppercase">
                          Rule: {rec.matchRule}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-1">
                        Customer: {rec.customerName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(rec.reconciliationId)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(rec.reconciliationId)}
                        className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow transition"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Match
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Incoming Payment Details
                      </div>
                      <div className="text-base font-bold text-slate-900 mt-1">
                        ₹{rec.paymentAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Payment Ref: {rec.paymentId}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] text-slate-400 font-semibold uppercase">
                        Suggested Allocations ({rec.allocations.length} bills)
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {rec.allocations.map((alloc) => (
                          <div
                            key={alloc.invoiceId}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span className="font-semibold text-slate-800">
                              {alloc.invoiceNumber}
                            </span>
                            <span className="font-bold text-emerald-700">
                              Allocated: ₹{alloc.allocatedAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Matching & Split (<80% / Unmatched) */}
      {activeTab === 'MANUAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Select Payment */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Select Unmatched Payment
            </h3>

            {unmatchedPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                All payments are fully matched! Ingest a new payment to split.
              </p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {unmatchedPayments.map((p) => (
                  <button
                    key={p.paymentId}
                    type="button"
                    onClick={() => handleSelectPaymentForManual(p.paymentId)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                      selectedPaymentId === p.paymentId
                        ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{p.paymentId}</span>
                      <span className="font-bold text-slate-900">
                        ₹{p.unmatchedBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.customerName || 'Direct Unlinked'} • {p.provider}
                    </div>
                    {p.utr && <div className="text-[10px] font-mono text-slate-400">UTR: {p.utr}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Invoice Split Matrix */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Allocate Across Customer Open Invoices
            </h3>

            {!currentSelectedPayment ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Select an unmatched payment from the left to allocate amounts.
              </div>
            ) : (
              <form onSubmit={handleSubmitManualReconciliation} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500 text-[11px]">Selected Payment: </span>
                    <span className="font-semibold text-slate-800">
                      {currentSelectedPayment.paymentId}
                    </span>
                    <span className="text-slate-400 ml-2">
                      (Available to Match: ₹{currentSelectedPayment.unmatchedBalance.toLocaleString('en-IN')})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Allocated: </span>
                    <span
                      className={`font-bold ${
                        totalAllocatedInForm > currentSelectedPayment.unmatchedBalance
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      ₹{totalAllocatedInForm.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Customer Account *
                  </label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">-- Choose Customer to Match --</option>
                    {customers.map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomerId && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-2">
                      Open Invoices for Selected Customer:
                    </div>

                    {customerOpenInvoices.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400">
                        This customer currently has no open invoices with an outstanding balance.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {customerOpenInvoices.map((inv) => (
                          <div
                            key={inv.invoiceId}
                            className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between gap-4"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                {inv.invoiceNumber}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Total: ₹{inv.amount.toLocaleString('en-IN')} | Due Balance:{' '}
                                <span className="font-bold text-slate-700">
                                  ₹{inv.balance.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const fillAmt = Math.min(
                                    inv.balance,
                                    currentSelectedPayment.unmatchedBalance
                                  );
                                  handleAllocationAmountChange(inv.invoiceId, fillAmt);
                                }}
                                className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700"
                              >
                                Max Fill
                              </button>
                              <div className="relative w-32">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max={inv.balance}
                                  value={manualAllocations[inv.invoiceId] || ''}
                                  onChange={(e) =>
                                    handleAllocationAmountChange(
                                      inv.invoiceId,
                                      Number(e.target.value)
                                    )
                                  }
                                  placeholder="0"
                                  className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-800 text-right focus:ring-1 focus:ring-brand-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={
                      manualSubmitting ||
                      totalAllocatedInForm <= 0 ||
                      totalAllocatedInForm > currentSelectedPayment.unmatchedBalance
                    }
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow disabled:opacity-50 transition"
                  >
                    {manualSubmitting ? 'Committing...' : 'Commit Match & Queue Tally Voucher'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Tally Write-Back Queue */}
      {activeTab === 'TALLY' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tally Receipt Voucher Commands</h3>
              <p className="text-xs text-slate-500">
                Commands pulled by the Go/C# Windows Agent to create Receipt Vouchers in TallyPrime
              </p>
            </div>
            {queuedTallyCommands.length > 0 && (
              <button
                onClick={handleSimulateTallySync}
                disabled={syncingTally}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-emerald-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingTally ? 'animate-spin' : ''}`} />
                Process {queuedTallyCommands.length} Queued
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Command ID</th>
                  <th className="py-3 px-4">Customer Party</th>
                  <th className="py-3 px-4">Voucher Type / Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Allocated Bills</th>
                  <th className="py-3 px-4">Status & Tally Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tallyCommands.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No Tally voucher commands queued yet. Reconcile a payment to trigger write-back.
                    </td>
                  </tr>
                ) : (
                  tallyCommands.map((cmd) => (
                    <tr key={cmd.commandId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {cmd.commandId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{cmd.partyLedger}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] font-semibold">
                          {cmd.voucherType}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{cmd.voucherDate}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{cmd.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        {cmd.billsAllocated?.map((b) => b.billNumber).join(', ') || 'On Account'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            cmd.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {cmd.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600" />
                          )}
                          {cmd.status}
                        </span>
                        {cmd.tallyVoucherNumber && (
                          <div className="text-[11px] font-mono font-bold text-brand-700 mt-0.5">
                            {cmd.tallyVoucherNumber}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Audit History */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Reconciliation Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Match Rule & Score</th>
                  <th className="py-3 px-4 text-right">Total Allocated</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tally Write-Back</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No reconciliation records available yet.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((r) => (
                    <tr key={r.reconciliationId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.reconciliationId}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.customerName}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{r.confidenceScore}%</span>
                        <div className="text-[10px] text-slate-400 font-mono">{r.matchRule}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{r.totalAllocated.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            r.status === 'AUTO_RECONCILED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'APPROVED'
                              ? 'bg-blue-50 text-blue-700'
                              : r.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            r.tallyWriteBackStatus === 'SYNCED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.tallyWriteBackStatus === 'QUEUED'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.tallyWriteBackStatus}
                        </span>
                        {r.tallyVoucherNumber && (
                          <div className="text-[10px] font-mono text-brand-700 mt-0.5">
                            {r.tallyVoucherNumber}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
