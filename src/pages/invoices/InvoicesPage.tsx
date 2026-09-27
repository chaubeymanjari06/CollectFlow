import React, { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  QrCode,
  CheckCircle,
  Copy,
  DollarSign,
  AlertTriangle,
  X,
  FileMinus,
  ShieldAlert,
  Clock,
  HelpCircle,
  Check
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { dbService } from '../../services/dbService';
import { receivablesService } from '../../services/receivablesService';
import { Invoice, Customer, AgingBucket, DisputeCategory } from '../../types';

export const InvoicesPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isManager } = useTenant();
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [bucketFilter, setBucketFilter] = useState<string>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Credit Note Form State
  const [showCnForm, setShowCnForm] = useState(false);
  const [cnAmount, setCnAmount] = useState('');
  const [cnNumber, setCnNumber] = useState('');
  const [cnReason, setCnReason] = useState('Goods Return / Quality Rejection');
  const [cnSuccess, setCnSuccess] = useState(false);

  // Dispute Form State
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>('RATE_MISMATCH');
  const [disputeReasonText, setDisputeReasonText] = useState('');
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  // New Invoice Form
  const [newCustId, setNewCustId] = useState('');
  const [newInvNum, setNewInvNum] = useState('');
  const [newInvDate, setNewInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubInvoices = dbService.subscribe<Record<string, Invoice>>(
      `invoices/${activeTenant.tenantId}`,
      (data) => {
        setInvoices(data ? Object.values(data) : []);
        setLoading(false);
      }
    );

    const unsubCustomers = dbService.subscribe<Record<string, Customer>>(
      `customers/${activeTenant.tenantId}`,
      (data) => {
        setCustomers(data ? Object.values(data) : []);
      }
    );

    return () => {
      unsubInvoices();
      unsubCustomers();
    };
  }, [activeTenant?.tenantId]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchesBucket = bucketFilter === 'ALL' || inv.agingBucket === bucketFilter;
    return matchesSearch && matchesStatus && matchesBucket;
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSubmitting(true);

    try {
      const selectedCustomer = customers.find((c) => c.customerId === newCustId);
      const custName = selectedCustomer ? selectedCustomer.name : 'Unknown Customer';

      await receivablesService.createInvoice(activeTenant.tenantId, {
        customerId: newCustId,
        customerName: custName,
        invoiceNumber: newInvNum,
        invoiceDate: newInvDate,
        dueDate: newDueDate,
        amount: Number(newAmount),
        upiVpa: activeTenant.settings?.upiVpa || 'collectflow@hdfcbank',
        payeeName: activeTenant.name,
      });

      setShowCreateModal(false);
      setNewCustId('');
      setNewInvNum('');
      setNewAmount('');
      setNewDueDate('');
    } catch (err) {
      console.error('Failed to create invoice:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedInvoice || !paymentAmount) return;
    setSubmitting(true);

    try {
      const updated = await receivablesService.recordPaymentOnInvoice(
        activeTenant.tenantId,
        selectedInvoice.invoiceId,
        Number(paymentAmount)
      );
      if (updated) {
        setSelectedInvoice(updated);
      }
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 3000);
      setPaymentAmount('');
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedInvoice || !cnAmount) return;
    setSubmitting(true);
    try {
      await receivablesService.createCreditNote(activeTenant.tenantId, {
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        noteNumber: cnNumber || `CN-${Date.now().toString().slice(-4)}`,
        noteDate: new Date().toISOString().split('T')[0],
        amount: Number(cnAmount),
        reason: cnReason,
        invoiceId: selectedInvoice.invoiceId,
      });
      const updated = await dbService.get<Invoice>(
        `invoices/${activeTenant.tenantId}/${selectedInvoice.invoiceId}`
      );
      if (updated) {
        setSelectedInvoice(updated);
      }
      setCnSuccess(true);
      setTimeout(() => {
        setCnSuccess(false);
        setShowCnForm(false);
      }, 2000);
      setCnAmount('');
      setCnNumber('');
    } catch (err) {
      console.error('Failed to apply credit note:', err);
      alert('Failed to apply credit note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedInvoice) return;
    setSubmitting(true);
    try {
      const updated = await receivablesService.markInvoiceDisputed(
        activeTenant.tenantId,
        selectedInvoice.invoiceId,
        disputeCategory,
        disputeReasonText || 'Billing or goods mismatch reported by client'
      );
      if (updated) {
        setSelectedInvoice(updated);
      }
      setDisputeSuccess(true);
      setTimeout(() => {
        setDisputeSuccess(false);
        setShowDisputeForm(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to mark disputed:', err);
      alert('Failed to mark disputed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveDispute = async () => {
    if (!activeTenant || !selectedInvoice) return;
    if (!confirm('Resolve dispute and re-enable automated WhatsApp reminders?')) return;
    setSubmitting(true);
    try {
      const updated = await receivablesService.resolveDispute(
        activeTenant.tenantId,
        selectedInvoice.invoiceId,
        'Dispute resolved amicably with customer'
      );
      if (updated) {
        setSelectedInvoice(updated);
      }
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
      alert('Failed to resolve dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'OVERDUE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PAID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PARTIALLY_PAID':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DISPUTED':
        return 'bg-purple-50 text-purple-700 border-purple-200 font-bold';
      case 'DUE_SOON':
      case 'DUE_TODAY':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'OPEN':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const agingBucketsList: Array<{ label: string; value: string }> = [
    { label: 'All Invoices', value: 'ALL' },
    { label: 'Current', value: 'CURRENT' },
    { label: '1–30 Days', value: '1-30' },
    { label: '31–60 Days', value: '31-60' },
    { label: '61–90 Days', value: '61-90' },
    { label: '90+ Days', value: '90+' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices & Receivables Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor aging buckets, due dates, partial payments, and generate dynamic UPI collection links
          </p>
        </div>

        {(isOwner || isAdmin || isManager) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        )}
      </div>

      {/* Aging Bucket Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {agingBucketsList.map((b) => (
          <button
            key={b.value}
            onClick={() => setBucketFilter(b.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              bucketFilter === b.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice # or party name..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="DISPUTED">Disputed / On Hold</option>
            <option value="DUE_SOON">Due Soon Only</option>
            <option value="OPEN">Open Only</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No invoices match your filter</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sync Tally data or click "New Invoice" to manually add an invoice
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Due Date & 43B(h)</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Aging</th>
                  <th className="px-6 py-3.5 text-right">Net Balance / Gross</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const h43 = receivablesService.calculateSection43Bh(inv.invoiceDate, inv.msmeCategory || 'MICRO', true);
                  return (
                    <tr
                      key={inv.invoiceId}
                      className="hover:bg-slate-50/50 transition cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-3.5 text-slate-700 font-medium">
                        {inv.customerName}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        <div>
                          {inv.dueDate}
                          {inv.daysPastDue > 0 && (
                            <span className="ml-1 text-[10px] text-rose-500 font-semibold">
                              ({inv.daysPastDue}d overdue)
                            </span>
                          )}
                        </div>
                        {inv.status !== 'PAID' && (
                          <div className="mt-0.5">
                            {h43.isOverdue ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800" title="Section 43B(h) Income Tax disallowance breached">
                                ⚠️ 43B(h) Breached
                              </span>
                            ) : h43.daysRemaining <= 15 ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800" title="Section 43B(h) MSME 45-day statutory deadline">
                                ⏳ 43B(h): {h43.daysRemaining}d left
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge(inv.status)}`}>
                          {inv.status}
                        </span>
                        {inv.disputeReason && (
                          <div className="text-[9px] text-purple-600 font-semibold mt-0.5">
                            {inv.disputeReason.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-slate-600">
                        {inv.agingBucket}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="font-bold text-slate-900">{formatCurrency(inv.balance)}</div>
                        {inv.creditNotesAmount && inv.creditNotesAmount > 0 ? (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Returns: -{formatCurrency(inv.creditNotesAmount)}
                          </div>
                        ) : null}
                        <div className="text-[10px] text-slate-400">Total: {formatCurrency(inv.amount)}</div>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-semibold text-[11px] hover:bg-brand-100 transition flex items-center gap-1 mx-auto"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail / Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">{selectedInvoice.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Invoice Date:</span>
                  <div className="font-bold text-slate-800">{selectedInvoice.invoiceDate}</div>
                </div>
                <div>
                  <span className="text-slate-400">Due Date:</span>
                  <div className="font-bold text-slate-800">{selectedInvoice.dueDate}</div>
                </div>
                <div>
                  <span className="text-slate-400">Aging Bucket:</span>
                  <div className="font-bold text-slate-800">{selectedInvoice.agingBucket}</div>
                </div>
                <div>
                  <span className="text-slate-400">Outstanding Balance:</span>
                  <div className="font-bold text-rose-600 text-sm">
                    {formatCurrency(selectedInvoice.balance)}
                  </div>
                </div>
              </div>

              {/* Section 43B(h) MSME Compliance Card */}
              {(() => {
                const h43 = receivablesService.calculateSection43Bh(
                  selectedInvoice.invoiceDate,
                  selectedInvoice.msmeCategory || 'MICRO',
                  true
                );
                return (
                  <div className={`p-3 rounded-xl border text-xs ${
                    h43.isOverdue
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : h43.daysRemaining <= 15
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Section 43B(h) Statutory Tracker
                      </span>
                      <span className="text-[11px] font-semibold">
                        Deadline: {h43.deadlineStr} ({h43.daysRemaining}d left)
                      </span>
                    </div>
                    <div className="text-[11px] mt-1 text-slate-600">
                      {h43.isOverdue ? (
                        <span className="font-bold text-rose-700">
                          ⚠️ Payment overdue past statutory 45 days. Buyer faces taxable income add-back under Sec 43B(h)!
                        </span>
                      ) : (
                        <span>
                          Supplier is MSME registered. Statutory payment period: 45 days.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Credit Note / Goods Return Breakdown */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileMinus className="w-4 h-4 text-brand-600" />
                    Credit Notes & Goods Returns
                  </div>
                  {selectedInvoice.balance > 0 && !showCnForm && (
                    <button
                      type="button"
                      onClick={() => setShowCnForm(true)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
                    >
                      + Apply Credit Note
                    </button>
                  )}
                </div>

                {selectedInvoice.creditNotesAmount && selectedInvoice.creditNotesAmount > 0 ? (
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span>Gross Invoice:</span>
                      <span>{formatCurrency(selectedInvoice.amount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Credit Notes Applied:</span>
                      <span>-{formatCurrency(selectedInvoice.creditNotesAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                      <span>Net Adjusted Balance:</span>
                      <span>{formatCurrency(selectedInvoice.netPayableAmount || selectedInvoice.balance)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    No Credit Notes applied. Gross bill amount applies.
                  </div>
                )}

                {showCnForm && (
                  <form onSubmit={handleApplyCreditNote} className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-700 text-[11px]">Apply Credit Note / Goods Return</div>
                    {cnSuccess && (
                      <div className="text-[11px] text-emerald-700 font-bold">Credit note applied! Net balance updated.</div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        required
                        min={1}
                        max={selectedInvoice.balance}
                        value={cnAmount}
                        onChange={(e) => setCnAmount(e.target.value)}
                        placeholder="Amount (₹)"
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-brand-500"
                      />
                      <input
                        type="text"
                        value={cnNumber}
                        onChange={(e) => setCnNumber(e.target.value)}
                        placeholder="CN # (e.g. CN-042)"
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <input
                      type="text"
                      value={cnReason}
                      onChange={(e) => setCnReason(e.target.value)}
                      placeholder="Reason for return or discount"
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-brand-500"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCnForm(false)}
                        className="px-2.5 py-1 text-slate-500 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700"
                      >
                        Deduct from Bill
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Dispute Management Section */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-600" />
                    Dispute & Hold Status
                  </div>
                  {selectedInvoice.status === 'DISPUTED' ? (
                    <button
                      type="button"
                      onClick={handleResolveDispute}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Resolve Dispute
                    </button>
                  ) : (
                    !showDisputeForm && selectedInvoice.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDisputeForm(true)}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 transition"
                      >
                        + Mark Disputed
                      </button>
                    )
                  )}
                </div>

                {selectedInvoice.status === 'DISPUTED' ? (
                  <div className="text-[11px] text-purple-900 space-y-1">
                    <div className="font-semibold">
                      Status: On Hold ({selectedInvoice.disputeReason?.replace(/_/g, ' ') || 'DISPUTED'})
                    </div>
                    <div className="text-slate-600 italic">
                      Notes: "{selectedInvoice.disputeNotes || 'Dispute raised by customer'}"
                    </div>
                    <div className="text-amber-800 font-medium">
                      ⏸️ Automated WhatsApp reminders are paused until dispute resolution.
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    No active disputes. Automated WhatsApp reminder sequences active.
                  </div>
                )}

                {showDisputeForm && (
                  <form onSubmit={handleMarkDispute} className="pt-2 border-t border-purple-100 space-y-2">
                    <div className="font-semibold text-purple-900 text-[11px]">Raise Invoice Dispute</div>
                    {disputeSuccess && (
                      <div className="text-[11px] text-emerald-700 font-bold">Invoice marked disputed! Reminders paused.</div>
                    )}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Dispute Category</label>
                      <select
                        value={disputeCategory}
                        onChange={(e) => setDisputeCategory(e.target.value as DisputeCategory)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                      >
                        <option value="RATE_MISMATCH">Rate Mismatch</option>
                        <option value="DAMAGED_GOODS">Damaged Goods</option>
                        <option value="MISSING_LR">Missing LR / Proof of Delivery</option>
                        <option value="DELIVERY_PENDING">Delivery Pending</option>
                        <option value="OTHER">Other Issue</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      required
                      value={disputeReasonText}
                      onChange={(e) => setDisputeReasonText(e.target.value)}
                      placeholder="Specific dispute notes / customer complaint"
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDisputeForm(false)}
                        className="px-2.5 py-1 text-slate-500 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1 bg-purple-700 text-white rounded-lg text-xs font-semibold hover:bg-purple-800"
                      >
                        Pause Reminders & Put on Hold
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* UPI QR & Intent Section */}
              {selectedInvoice.balance > 0 && (
                <div className="p-4 bg-brand-50/50 rounded-xl border border-brand-100 flex flex-col items-center text-center">
                  <h4 className="font-bold text-brand-900 text-xs mb-1">Dynamic UPI Payment QR</h4>
                  <p className="text-[11px] text-brand-700 mb-3">
                    Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
                  </p>
                  {selectedInvoice.paymentLink ? (
                    <img
                      src={selectedInvoice.paymentLink}
                      alt="UPI QR Code"
                      className="w-36 h-36 rounded-lg shadow-sm border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <div className="p-4 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-500">
                      UPI VPA: {activeTenant?.settings?.upiVpa || 'collectflow@hdfcbank'}
                    </div>
                  )}

                  {selectedInvoice.upiIntentString && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedInvoice.upiIntentString || '');
                        alert('UPI Intent URL copied to clipboard!');
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-white border border-brand-200 text-brand-700 font-semibold text-[11px] hover:bg-brand-50 transition flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy UPI Deep Link
                    </button>
                  )}
                </div>
              )}

              {/* Record Payment Section */}
              {selectedInvoice.balance > 0 && (
                <form onSubmit={handleRecordPayment} className="pt-2 border-t border-slate-100 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">Record Received Payment</h4>
                  {paymentSuccess && (
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs flex items-center gap-1.5 font-semibold">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Payment recorded & aging updated!
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      max={selectedInvoice.balance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Max ${selectedInvoice.balance}`}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      Apply Payment
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Invoice</h3>
            <p className="text-xs text-slate-500 mb-4">Add a bill to calculate aging and generate UPI link</p>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Party *
                </label>
                <select
                  required
                  value={newCustId}
                  onChange={(e) => setNewCustId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  required
                  value={newInvNum}
                  onChange={(e) => setNewInvNum(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newInvDate}
                    onChange={(e) => setNewInvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Amount (INR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Save Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
