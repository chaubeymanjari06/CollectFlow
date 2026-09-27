import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  X,
  Plus,
  RefreshCw,
  Phone,
  Check,
  CheckCheck
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { reminderPtpService } from '../../services/reminderPtpService';
import { Message, PromiseToPay, Invoice, Customer } from '../../types';

export const RemindersPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isManager, isExecutive } = useTenant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [promises, setPromises] = useState<PromiseToPay[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'MESSAGES' | 'PTP'
  const [activeTab, setActiveTab] = useState<'MESSAGES' | 'PTP'>('MESSAGES');

  // Automation runner state
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [workflowBanner, setWorkflowBanner] = useState<string | null>(null);

  // Phase 19: Safety Preview & Meta Signup State
  const [showSafetyPreview, setShowSafetyPreview] = useState(false);
  const [showMetaSignup, setShowMetaSignup] = useState(false);
  const [safetySlideConfirmed, setSafetySlideConfirmed] = useState(false);

  // New PTP Modal
  const [showPtpModal, setShowPtpModal] = useState(false);
  const [ptpCustId, setPtpCustId] = useState('');
  const [ptpInvId, setPtpInvId] = useState('');
  const [ptpAmount, setPtpAmount] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  const [ptpNotes, setPtpNotes] = useState('');
  const [submittingPtp, setSubmittingPtp] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubMsg = dbService.subscribe<Record<string, Message>>(
      `messages/${activeTenant.tenantId}`,
      (data) => {
        setMessages(data ? Object.values(data).sort((a, b) => b.createdAt - a.createdAt) : []);
        setLoading(false);
      }
    );

    const unsubPtp = dbService.subscribe<Record<string, PromiseToPay>>(
      `promises/${activeTenant.tenantId}`,
      (data) => {
        setPromises(data ? Object.values(data).sort((a, b) => b.createdAt - a.createdAt) : []);
      }
    );

    const unsubInvoices = dbService.subscribe<Record<string, Invoice>>(
      `invoices/${activeTenant.tenantId}`,
      (data) => {
        setInvoices(data ? Object.values(data) : []);
      }
    );

    const unsubCustomers = dbService.subscribe<Record<string, Customer>>(
      `customers/${activeTenant.tenantId}`,
      (data) => {
        setCustomers(data ? Object.values(data) : []);
      }
    );

    return () => {
      unsubMsg();
      unsubPtp();
      unsubInvoices();
      unsubCustomers();
    };
  }, [activeTenant?.tenantId]);

  const handleRunWorkflow = async () => {
    if (!activeTenant) return;
    setRunningWorkflow(true);
    setWorkflowBanner(null);

    try {
      const { sent, result } = await reminderPtpService.runAutomatedBatchWorkflow(activeTenant.tenantId);
      setWorkflowBanner(
        `Dispatched ${sent} WhatsApp reminders. Skipped: ${result.skippedActivePtp} paused by active PTP, ${result.skippedDeduplication} in 48h deduplication window.`
      );
    } catch (err: any) {
      console.error(err);
      setWorkflowBanner(`Workflow execution error: ${err.message}`);
    } finally {
      setRunningWorkflow(false);
    }
  };

  const handleEvaluatePtps = async () => {
    if (!activeTenant) return;
    try {
      const { kept, broken } = await reminderPtpService.evaluateMaturedPtps(activeTenant.tenantId);
      alert(`PTP Evaluation: ${kept} marked KEPT, ${broken} marked BROKEN.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSubmittingPtp(true);

    try {
      const selectedCust = customers.find((c) => c.customerId === ptpCustId);
      const selectedInv = invoices.find((i) => i.invoiceId === ptpInvId);

      await reminderPtpService.createPromiseToPay(activeTenant.tenantId, {
        customerId: ptpCustId,
        customerName: selectedCust?.name || 'Customer',
        invoiceIds: ptpInvId ? [ptpInvId] : [],
        invoiceNumber: selectedInv?.invoiceNumber || 'Account Statement',
        amount: Number(ptpAmount),
        promisedDate: ptpDate,
        source: 'MANUAL_EXECUTIVE',
        notes: ptpNotes,
      });

      setShowPtpModal(false);
      setPtpCustId('');
      setPtpInvId('');
      setPtpAmount('');
      setPtpDate('');
      setPtpNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPtp(false);
    }
  };

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const ptpBadge = (status: PromiseToPay['status']) => {
    switch (status) {
      case 'KEPT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'BROKEN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PENDING':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const activePtps = promises.filter((p) => p.status === 'PENDING');
  const brokenPtps = promises.filter((p) => p.status === 'BROKEN');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">WhatsApp Collections & Promise-to-Pay</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta-compliant reminder sequences, deduplication protection, and PTP commitment tracking
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowMetaSignup(true)}
            className="py-2 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Meta WhatsApp Connect
          </button>

          {(isOwner || isAdmin || isManager || isExecutive) && (
            <button
              onClick={() => setShowPtpModal(true)}
              className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              Log PTP
            </button>
          )}

          {(isOwner || isAdmin || isManager) && (
            <>
              <button
                onClick={() => setShowSafetyPreview(true)}
                className="py-2 px-3.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Safety Preview
              </button>
              <button
                onClick={handleRunWorkflow}
                disabled={runningWorkflow}
                className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${runningWorkflow ? 'animate-pulse' : ''}`} />
                {runningWorkflow ? 'Evaluating...' : 'Run Automated Sequence'}
              </button>
            </>
          )}
        </div>
      </div>

      {workflowBanner && (
        <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-100 flex items-center gap-2.5 text-xs text-brand-900 font-medium">
          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
          <span>{workflowBanner}</span>
        </div>
      )}

      {/* DPDP Act 2023 & WhatsApp Compliance Pill */}
      <div className="p-3 bg-slate-900 text-white rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300">
            <strong>DPDP Act 2023 & Meta Anti-Spam Active:</strong> All reminder templates include mandatory <span className="text-emerald-400 font-mono">"Reply STOP to pause"</span> footer. Inbound STOP messages automatically freeze delivery.
          </span>
        </div>
        <div className="text-[11px] text-slate-400 shrink-0">
          Suppression List: {customers.filter((c) => c.optOutWhatsApp).length} numbers opted out
        </div>
      </div>

      {/* KPI Cards for Follow-ups & PTP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Total Messages Sent</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{messages.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Active PTPs (Paused)</div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{activePtps.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Broken Promises</div>
            <div className="text-xl font-bold text-rose-600 mt-0.5">{brokenPtps.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Deduplication Protection</div>
            <div className="text-xs font-bold text-emerald-700 mt-0.5">48h Active Window</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('MESSAGES')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'MESSAGES'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          WhatsApp Logs ({messages.length})
        </button>
        <button
          onClick={() => setActiveTab('PTP')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === 'PTP'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Promises to Pay ({promises.length})
        </button>
      </div>

      {/* Tab 1: Messages Communication Log */}
      {activeTab === 'MESSAGES' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No message history yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click "Run Automated Sequence" above to dispatch reminders to eligible customers
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {messages.map((msg) => (
                <div key={msg.messageId} className="p-4 hover:bg-slate-50/50 transition text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      WA
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        {msg.customerName}
                        {msg.invoiceNumber && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                            Ref: {msg.invoiceNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mt-1 max-w-xl text-[11px] leading-relaxed">
                        {msg.content}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{new Date(msg.createdAt).toLocaleString('en-IN')}</span>
                        <span>•</span>
                        <span className="uppercase font-mono">{msg.templateId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg self-start sm:self-center">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {msg.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Promise-to-Pay (PTP) Management */}
      {activeTab === 'PTP' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              When a PTP is recorded, automated reminders for that invoice are paused until the promised date.
            </span>
            <button
              onClick={handleEvaluatePtps}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
              Check Matured PTPs
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {promises.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Promise-to-Pay records</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Log PTP" when a customer commits to a payment date
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5">Invoice</th>
                      <th className="px-6 py-3.5">Promised Date</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {promises.map((p) => (
                      <tr key={p.promiseId} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-3.5 font-bold text-slate-800">{p.customerName}</td>
                        <td className="px-6 py-3.5 text-slate-600">{p.invoiceNumber}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">{p.promisedDate}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ptpBadge(
                              p.status
                            )}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-400 text-[11px]">{p.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log PTP Modal */}
      {showPtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Register Promise to Pay (PTP)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter customer commitment date to pause follow-ups until then
            </p>

            <form onSubmit={handleCreatePtp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Customer *</label>
                <select
                  required
                  value={ptpCustId}
                  onChange={(e) => setPtpCustId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Linked Invoice (Optional)</label>
                <select
                  value={ptpInvId}
                  onChange={(e) => {
                    setPtpInvId(e.target.value);
                    const inv = invoices.find((i) => i.invoiceId === e.target.value);
                    if (inv) setPtpAmount(String(inv.balance));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">All Account Balance</option>
                  {invoices
                    .filter((inv) => !ptpCustId || inv.customerId === ptpCustId)
                    .map((inv) => (
                      <option key={inv.invoiceId} value={inv.invoiceId}>
                        {inv.invoiceNumber} (Balance: ₹{inv.balance.toLocaleString('en-IN')})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Promised Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={ptpDate}
                    onChange={(e) => setPtpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Promised Amount *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={ptpAmount}
                    onChange={(e) => setPtpAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Executive Notes</label>
                <input
                  type="text"
                  value={ptpNotes}
                  onChange={(e) => setPtpNotes(e.target.value)}
                  placeholder="e.g. Anand confirmed RTGS transfer on Monday morning"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPtpModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPtp}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition"
                >
                  {submittingPtp ? 'Registering...' : 'Register PTP & Pause Reminders'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safety Preview Modal */}
      {showSafetyPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-brand-600" />
                  Pre-Dispatch Safety Preview
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Verify recipients, paused accounts, and message templates before sending
                </p>
              </div>
              <button
                onClick={() => setShowSafetyPreview(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Ready to Dispatch</div>
                <div className="text-xl font-bold text-emerald-800 mt-0.5">
                  {invoices.filter((i) => i.balance > 0 && !i.hasActivePtp && i.status !== 'DISPUTED').length}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-[10px] text-amber-700 font-bold uppercase">Paused (Active PTP)</div>
                <div className="text-xl font-bold text-amber-800 mt-0.5">
                  {invoices.filter((i) => i.hasActivePtp).length}
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-[10px] text-purple-700 font-bold uppercase">Paused (Disputed)</div>
                <div className="text-xl font-bold text-purple-800 mt-0.5">
                  {invoices.filter((i) => i.status === 'DISPUTED').length}
                </div>
              </div>
            </div>

            {/* WhatsApp Template Live Preview */}
            <div className="p-4 bg-emerald-950/5 border border-emerald-200/50 rounded-xl space-y-2">
              <div className="text-[10px] font-bold uppercase text-emerald-900 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Live WhatsApp Message Preview (Verified Business Account)
              </div>
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 space-y-2 text-slate-800 text-[11px] leading-relaxed">
                <div>
                  <strong>Namaste Shree Ganesh Traders,</strong>
                </div>
                <div>
                  This is a polite reminder from <strong>{activeTenant?.name || 'Your Company'}</strong> regarding outstanding Invoice <strong>#INV-2026-042</strong> for <strong>₹45,000</strong> which is due today.
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-900 font-mono text-[10px]">
                  📲 1-Tap UPI Payment: upi://pay?pa=collectflow@hdfcbank&am=45000
                </div>
                <div className="text-[10px] text-slate-400 border-t pt-1">
                  🔒 DPDP Act Compliant: Reply <strong>STOP</strong> to pause automated messages.
                </div>
              </div>
            </div>

            {/* Slide-to-confirm / checkbox */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="checkbox"
                  checked={safetySlideConfirmed}
                  onChange={(e) => setSafetySlideConfirmed(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>I have reviewed the recipient list and confirm batch WhatsApp dispatch</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSafetyPreview(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!safetySlideConfirmed || runningWorkflow}
                onClick={async () => {
                  setShowSafetyPreview(false);
                  await handleRunWorkflow();
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition disabled:opacity-50"
              >
                {runningWorkflow ? 'Dispatching...' : 'Dispatch Verified Reminders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta WhatsApp Embedded Signup Modal */}
      {showMetaSignup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Meta WhatsApp Co-Existence Setup
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Link your phone number in 3 minutes via Meta Embedded Signup
                </p>
              </div>
              <button
                onClick={() => setShowMetaSignup(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-emerald-900">Co-Existence Mode Active</div>
                  <div className="text-[11px] text-emerald-800">
                    Your personal/business WhatsApp app on your mobile continues to work normally.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="text-slate-500 text-[11px]">Active Channel Status:</div>
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>CollectFlow Verified Shared Channel</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Connected
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Day-1 Pilot Channel active with pre-approved multilingual templates.
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMetaSignup(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Launching Meta Embedded Signup OAuth window... (Co-existence flow authorized)');
                  setShowMetaSignup(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
              >
                Launch Meta OAuth Signup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
