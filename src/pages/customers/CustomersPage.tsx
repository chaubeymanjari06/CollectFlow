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
  FileText,
  Clock,
  MessageSquare,
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  Save,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { customer360Service } from '../../services/customer360Service';
import { Customer, Customer360Data, CustomerRiskTier } from '../../types';

export const CustomersPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isManager } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('ALL');

  // Modals & 360 Data
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customer360, setCustomer360] = useState<Customer360Data | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [active360Tab, setActive360Tab] = useState<
    'OVERVIEW' | 'INVOICES' | 'PAYMENTS' | 'PTPS' | 'MESSAGES' | 'RECONCILIATION' | 'STATEMENT'
  >('OVERVIEW');

  // Credit Terms Edit Mode
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [editLimit, setEditLimit] = useState(500000);
  const [editTermsDays, setEditTermsDays] = useState(30);
  const [editOptOut, setEditOptOut] = useState(false);

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

    const unsubscribe = dbService.subscribe<Record<string, Customer>>(
      `customers/${activeTenant.tenantId}`,
      (data) => {
        setCustomers(data ? Object.values(data) : []);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTenant?.tenantId]);

  const handleOpen360 = async (customerId: string) => {
    if (!activeTenant) return;
    setSelectedCustomerId(customerId);
    setActive360Tab('OVERVIEW');
    setIsEditingTerms(false);
    setLoading360(true);
    try {
      const data = await customer360Service.getCustomer360(activeTenant.tenantId, customerId);
      setCustomer360(data);
      if (data) {
        setEditLimit(data.customer.creditLimit || 500000);
        setEditTermsDays(data.customer.paymentTerms || 30);
        setEditOptOut(data.customer.optOutWhatsApp || false);
      }
    } catch (err) {
      console.error('Failed to load Customer 360:', err);
    } finally {
      setLoading360(false);
    }
  };

  const handleSaveTerms = async () => {
    if (!activeTenant || !selectedCustomerId) return;
    try {
      const updated = await customer360Service.updateCustomerCreditTerms(
        activeTenant.tenantId,
        selectedCustomerId,
        {
          creditLimit: Number(editLimit),
          paymentTerms: Number(editTermsDays),
          optOutWhatsApp: editOptOut,
        }
      );
      if (updated && customer360) {
        setCustomer360({
          ...customer360,
          customer: updated,
          metrics: {
            ...customer360.metrics,
            creditLimit: updated.creditLimit,
            creditUtilizationPct: Math.round(
              (customer360.metrics.outstandingBalance / (updated.creditLimit || 1)) * 100
            ),
          },
        });
      }
      setIsEditingTerms(false);
    } catch (err: any) {
      alert(`Failed to update credit terms: ${err.message}`);
    }
  };

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

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getRiskBadge = (tier: CustomerRiskTier) => {
    switch (tier) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            CRITICAL RISK
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            MODERATE
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            LOW RISK
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-6 h-6 text-brand-600" />
            Customer 360 & Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Party master, real-time credit terms, 360 history, and downloadable customer statements
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

      {/* Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party name, contact person, or mobile..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Customer Directory Table */}
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
                onClick={() => handleOpen360(c.customerId)}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition cursor-pointer text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-normal">
                      Net {c.paymentTerms} Days
                    </span>
                    {c.optOutWhatsApp && (
                      <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md">
                        Opted-Out
                      </span>
                    )}
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
                    {c.contactPerson && (
                      <span className="text-slate-500 font-medium">Attn: {c.contactPerson}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Total Receivable
                    </div>
                    <div className="font-bold text-slate-800 text-sm">
                      {formatCurrency(c.metrics?.totalReceivable)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-400 font-semibold uppercase">
                      Overdue Balance
                    </div>
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

      {/* Comprehensive Customer 360 Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            {loading360 || !customer360 ? (
              <div className="py-20 text-center text-xs text-slate-400">
                Loading 360 profile & ledger...
              </div>
            ) : (
              <div className="space-y-6">
                {/* 360 Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900">
                        {customer360.customer.name}
                      </h2>
                      {getRiskBadge(customer360.metrics.riskTier)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                      <span>{customer360.customer.mobile}</span>
                      {customer360.customer.email && <span>• {customer360.customer.email}</span>}
                      {customer360.customer.contactPerson && (
                        <span>• Contact: {customer360.customer.contactPerson}</span>
                      )}
                      <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded">
                        ID: {customer360.customer.customerId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActive360Tab('STATEMENT')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Statement
                    </button>
                    <button
                      onClick={() => setSelectedCustomerId(null)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Subtab Navigation */}
                <div className="flex border-b border-slate-200 text-xs font-semibold gap-4 overflow-x-auto">
                  {[
                    { id: 'OVERVIEW', label: 'Financial Overview', icon: Building2 },
                    {
                      id: 'INVOICES',
                      label: `Invoices (${customer360.invoices.length})`,
                      icon: FileText,
                    },
                    {
                      id: 'PAYMENTS',
                      label: `Payments (${customer360.payments.length})`,
                      icon: CreditCard,
                    },
                    {
                      id: 'PTPS',
                      label: `PTPs (${customer360.promises.length})`,
                      icon: Clock,
                    },
                    {
                      id: 'MESSAGES',
                      label: `WhatsApp Logs (${customer360.messages.length})`,
                      icon: MessageSquare,
                    },
                    {
                      id: 'RECONCILIATION',
                      label: `Reconciled (${customer360.reconciliations.length})`,
                      icon: GitCompare,
                    },
                    { id: 'STATEMENT', label: 'Ledger Statement', icon: Printer },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActive360Tab(tab.id as any)}
                        className={`pb-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
                          active360Tab === tab.id
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* 360 Tab 1: Overview & Credit Terms */}
                {active360Tab === 'OVERVIEW' && (
                  <div className="space-y-6 text-xs">
                    {/* Financial Summary KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">
                          Total Receivables
                        </div>
                        <div className="text-lg font-bold text-slate-900 mt-1">
                          {formatCurrency(customer360.metrics.outstandingBalance)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Lifetime Billed: {formatCurrency(customer360.metrics.totalBilled)}
                        </div>
                      </div>

                      <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100">
                        <div className="text-[11px] font-semibold text-rose-500 uppercase">
                          Overdue Balance
                        </div>
                        <div className="text-lg font-bold text-rose-600 mt-1">
                          {formatCurrency(customer360.metrics.overdueBalance)}
                        </div>
                        <div className="text-[10px] text-rose-400 mt-0.5">Immediate attention</div>
                      </div>

                      <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                        <div className="text-[11px] font-semibold text-emerald-600 uppercase">
                          Total Paid
                        </div>
                        <div className="text-lg font-bold text-emerald-700 mt-1">
                          {formatCurrency(customer360.metrics.totalPaid)}
                        </div>
                        <div className="text-[10px] text-emerald-600 mt-0.5">
                          {customer360.payments.length} settled receipts
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100">
                        <div className="text-[11px] font-semibold text-blue-600 uppercase">
                          PTP Success Rate
                        </div>
                        <div className="text-lg font-bold text-blue-800 mt-1">
                          {customer360.metrics.ptpSuccessRate}%
                        </div>
                        <div className="text-[10px] text-blue-600 mt-0.5">
                          Avg Delay: {customer360.metrics.averagePaymentDelayDays} days
                        </div>
                      </div>
                    </div>

                    {/* Credit Limit & Utilization */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            Credit Terms & Exposure
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Limit: {formatCurrency(customer360.metrics.creditLimit)} | Payment
                            Terms: Net {customer360.customer.paymentTerms} Days
                          </div>
                        </div>

                        {!isEditingTerms ? (
                          <button
                            onClick={() => setIsEditingTerms(true)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit Terms
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsEditingTerms(false)}
                              className="px-3 py-1 text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveTerms}
                              className="flex items-center gap-1 px-3.5 py-1.5 bg-brand-600 text-white rounded-xl font-semibold shadow hover:bg-brand-700"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Credit Utilization Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>Credit Utilization</span>
                          <span
                            className={
                              customer360.metrics.creditUtilizationPct > 100
                                ? 'text-rose-600 font-bold'
                                : 'text-slate-800'
                            }
                          >
                            {customer360.metrics.creditUtilizationPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              customer360.metrics.creditUtilizationPct > 100
                                ? 'bg-rose-500'
                                : customer360.metrics.creditUtilizationPct > 75
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, customer360.metrics.creditUtilizationPct)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {isEditingTerms && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Credit Limit (INR)
                            </label>
                            <input
                              type="number"
                              value={editLimit}
                              onChange={(e) => setEditLimit(Number(e.target.value))}
                              className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Payment Terms (Days)
                            </label>
                            <input
                              type="number"
                              value={editTermsDays}
                              onChange={(e) => setEditTermsDays(Number(e.target.value))}
                              className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-6">
                            <input
                              type="checkbox"
                              id="optOutWhatsApp"
                              checked={editOptOut}
                              onChange={(e) => setEditOptOut(e.target.checked)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            <label htmlFor="optOutWhatsApp" className="font-semibold text-slate-700">
                              Opt-out of WhatsApp reminders
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 360 Tab 2: Invoices */}
                {active360Tab === 'INVOICES' && (
                  <div className="space-y-3">
                    {customer360.invoices.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No invoice records found for this customer.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3">Invoice #</th>
                              <th className="py-2.5 px-3">Dates</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3 text-right">Balance</th>
                              <th className="py-2.5 px-3">Aging / Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customer360.invoices.map((inv) => (
                              <tr key={inv.invoiceId} className="hover:bg-slate-50/50">
                                <td className="py-3 px-3 font-semibold text-slate-900">
                                  {inv.invoiceNumber}
                                </td>
                                <td className="py-3 px-3 text-slate-500">
                                  <div>Inv: {inv.invoiceDate}</div>
                                  <div className="text-[10px]">Due: {inv.dueDate}</div>
                                </td>
                                <td className="py-3 px-3 text-right font-semibold text-slate-800">
                                  {formatCurrency(inv.amount)}
                                </td>
                                <td className="py-3 px-3 text-right font-bold text-slate-900">
                                  {formatCurrency(inv.balance)}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      inv.status === 'PAID'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : inv.status === 'OVERDUE'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {inv.status}
                                  </span>
                                  {inv.daysPastDue > 0 && (
                                    <div className="text-[10px] text-rose-500 mt-0.5">
                                      {inv.daysPastDue}d overdue
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 360 Tab 3: Payments */}
                {active360Tab === 'PAYMENTS' && (
                  <div className="space-y-3">
                    {customer360.payments.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No payments logged for this customer yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3">Payment ID / UTR</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Source</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3">Reconciliation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customer360.payments.map((p) => (
                              <tr key={p.paymentId} className="hover:bg-slate-50/50">
                                <td className="py-3 px-3 font-semibold text-slate-900">
                                  {p.paymentId}
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {p.utr || 'No UTR'}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-500">
                                  {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] uppercase">
                                    {p.provider}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-bold text-slate-900">
                                  {formatCurrency(p.amount)}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      p.reconciliationStatus === 'FULLY_MATCHED'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : p.reconciliationStatus === 'PARTIALLY_MATCHED'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {p.reconciliationStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 360 Tab 4: PTP Commitments */}
                {active360Tab === 'PTPS' && (
                  <div className="space-y-3">
                    {customer360.promises.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No Promise-to-Pay records captured for this customer.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {customer360.promises.map((ptp) => (
                          <div
                            key={ptp.promiseId}
                            className="py-3 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                Promised Date: {ptp.promisedDate}
                              </div>
                              <div className="text-slate-500 text-[11px]">
                                Amount: {formatCurrency(ptp.amount)} • Source: {ptp.source}
                              </div>
                              {ptp.notes && (
                                <div className="text-slate-400 text-[10px] mt-0.5 italic">
                                  "{ptp.notes}"
                                </div>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                ptp.status === 'KEPT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ptp.status === 'BROKEN'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ptp.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 360 Tab 5: WhatsApp Logs */}
                {active360Tab === 'MESSAGES' && (
                  <div className="space-y-3">
                    {customer360.messages.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No WhatsApp reminder logs sent to this customer.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customer360.messages.map((m) => (
                          <div
                            key={m.messageId}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 font-mono">
                                Template: {m.templateId}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                {m.status}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.content}</p>
                            <div className="text-[10px] text-slate-400 mt-1">
                              Sent:{' '}
                              {new Date(m.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 360 Tab 6: Reconciliation */}
                {active360Tab === 'RECONCILIATION' && (
                  <div className="space-y-3">
                    {customer360.reconciliations.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No reconciliations found for this customer.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customer360.reconciliations.map((rec) => (
                          <div
                            key={rec.reconciliationId}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">
                                Match Rule: {rec.matchRule} ({rec.confidenceScore}% confidence)
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatCurrency(rec.totalAllocated)}
                              </span>
                            </div>
                            <div className="text-slate-500 text-[11px] mt-1">
                              Status: {rec.status} • Tally Write-Back: {rec.tallyWriteBackStatus}
                              {rec.tallyVoucherNumber && ` (${rec.tallyVoucherNumber})`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 360 Tab 7: Printable Customer Statement */}
                {active360Tab === 'STATEMENT' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Statement of Account</div>
                        <div className="text-[11px] text-slate-500">
                          Party: {customer360.customer.name} | Closing Balance:{' '}
                          <span className="font-bold text-slate-800">
                            {formatCurrency(customer360.metrics.outstandingBalance)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow hover:bg-slate-800 transition flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Statement
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Particulars / Ref</th>
                            <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                            <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                            <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customer360.ledgerEntries.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                No ledger transactions recorded.
                              </td>
                            </tr>
                          ) : (
                            customer360.ledgerEntries.map((entry) => (
                              <tr key={entry.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-mono text-slate-600">
                                  {entry.date}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 font-medium">
                                  {entry.description}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                                  {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                                  {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                  {formatCurrency(entry.runningBalance)}
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
            )}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Enterprises Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+919876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="accounts@anand.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit (INR)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold shadow hover:bg-brand-700 disabled:opacity-50"
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
