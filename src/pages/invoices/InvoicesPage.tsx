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
  X
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { receivablesService } from '../../services/receivablesService';
import { Invoice, Customer, AgingBucket } from '../../types';

export const InvoicesPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isManager } = useTenant();
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

  const statusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'OVERDUE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PAID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PARTIALLY_PAID':
        return 'bg-amber-50 text-amber-700 border-amber-200';
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
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Aging</th>
                  <th className="px-6 py-3.5 text-right">Balance / Amount</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
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
                      {inv.dueDate}
                      {inv.daysPastDue > 0 && (
                        <span className="ml-1 text-[10px] text-rose-500 font-semibold">
                          ({inv.daysPastDue}d overdue)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-600">
                      {inv.agingBucket}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(inv.balance)}</div>
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
                        UPI Pay
                      </button>
                    </td>
                  </tr>
                ))}
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
