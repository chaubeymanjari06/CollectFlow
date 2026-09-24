import React, { useEffect, useState } from 'react';
import {
  Users2,
  Search,
  Phone,
  Mail,
  Plus,
  ArrowUpRight,
  Printer,
  X,
  CreditCard,
  FileText
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { Customer, Invoice } from '../../types';

export const CustomersPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isManager } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);

  // New Customer Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [creditLimit, setCreditLimit] = useState('500000');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubCustomers = dbService.subscribe<Record<string, Customer>>(
      `customers/${activeTenant.tenantId}`,
      (data) => {
        setCustomers(data ? Object.values(data) : []);
        setLoading(false);
      }
    );

    const unsubInvoices = dbService.subscribe<Record<string, Invoice>>(
      `invoices/${activeTenant.tenantId}`,
      (data) => {
        setInvoices(data ? Object.values(data) : []);
      }
    );

    return () => {
      unsubCustomers();
      unsubInvoices();
    };
  }, [activeTenant?.tenantId]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSubmitting(true);

    try {
      const now = Date.now();
      const customerId = `cust_${Math.random().toString(36).substring(2, 9)}_${now.toString(36)}`;

      const customer: Customer = {
        customerId,
        tenantId: activeTenant.tenantId,
        source: 'manual',
        name,
        contactPerson: contactPerson || null,
        mobile,
        email: email || null,
        creditLimit: Number(creditLimit),
        paymentTerms: Number(paymentTerms),
        optOutWhatsApp: false,
        metrics: {
          totalReceivable: 0,
          overdueBalance: 0,
          openInvoicesCount: 0,
          overdueInvoicesCount: 0,
          averagePaymentDelayDays: 0,
          ptpSuccessRate: 100,
        },
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };

      await dbService.set(`customers/${activeTenant.tenantId}/${customerId}`, customer);
      setShowAddModal(false);
      setName('');
      setContactPerson('');
      setMobile('');
      setEmail('');
      setGstin('');
    } catch (err) {
      console.error('Failed to add customer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm)
  );

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const customerInvoices = selectedCustomer
    ? invoices.filter((inv) => inv.customerId === selectedCustomer.customerId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer 360 & Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Party directory with contact details, credit terms, overdue balances, and ledger statements
          </p>
        </div>

        {(isOwner || isAdmin || isManager) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        )}
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party name or mobile number..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No customers found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sync Tally records or click "Add Customer" to add one manually
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <div
                key={c.customerId}
                onClick={() => setSelectedCustomer(c)}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition cursor-pointer text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-normal">
                      Net {c.paymentTerms} Days
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {c.mobile}
                    </span>
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Receivable</div>
                    <div className="font-bold text-slate-800 text-sm">
                      {formatCurrency(c.metrics?.totalReceivable)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-400 font-semibold uppercase">Overdue Balance</div>
                    <div className="font-bold text-rose-600 text-sm">
                      {formatCurrency(c.metrics?.overdueBalance)}
                    </div>
                  </div>
                  <div className="text-brand-600 font-semibold flex items-center gap-0.5">
                    View 360 <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer 360 Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-500">
                  {selectedCustomer.mobile} {selectedCustomer.email && `• ${selectedCustomer.email}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStatementModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 font-semibold text-xs hover:bg-brand-100 transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Statement
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Total Receivable:</span>
                  <div className="font-bold text-slate-900 text-sm">
                    {formatCurrency(selectedCustomer.metrics?.totalReceivable)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Overdue:</span>
                  <div className="font-bold text-rose-600 text-sm">
                    {formatCurrency(selectedCustomer.metrics?.overdueBalance)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Avg. Delay:</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedCustomer.metrics?.averagePaymentDelayDays || 0} days
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Credit Limit:</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedCustomer.creditLimit)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2">
                  Open Bills & Invoices ({customerInvoices.length})
                </h4>
                {customerInvoices.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No open invoices for this customer
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerInvoices.map((inv) => (
                      <div
                        key={inv.invoiceId}
                        className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-400">
                            Due: {inv.dueDate} ({inv.agingBucket})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{formatCurrency(inv.balance)}</div>
                          <div className="text-[10px] text-slate-400">Total: {formatCurrency(inv.amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {showStatementModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Customer Statement</h3>
              <button
                onClick={() => setShowStatementModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="font-bold text-slate-900 text-sm">{activeTenant?.name}</div>
                <div className="text-slate-500 mt-1">Statement for: <span className="font-bold text-slate-800">{selectedCustomer.name}</span></div>
                <div className="text-slate-400 text-[11px] mt-0.5">As of: {new Date().toLocaleDateString('en-IN')}</div>
              </div>

              <div className="divide-y divide-slate-100">
                {customerInvoices.map((inv) => (
                  <div key={inv.invoiceId} className="py-2.5 flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">Date: {inv.invoiceDate} | Due: {inv.dueDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(inv.balance)}</div>
                      <div className="text-[10px] text-slate-400">Total: {formatCurrency(inv.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-brand-50 rounded-xl flex items-center justify-between font-bold text-brand-900">
                <span>Total Amount Due:</span>
                <span>{formatCurrency(selectedCustomer.metrics?.totalReceivable)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Customer</h3>
            <p className="text-xs text-slate-500 mb-4">Create a new customer ledger party</p>

            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Engineering Ltd"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Anand Sharma"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 98201 12233"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@apex.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credit Limit (INR)
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
