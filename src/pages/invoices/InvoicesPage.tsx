import React, { useEffect, useState } from 'react';
import { FileText, Search, Filter, AlertCircle, Plus, ExternalLink } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { Invoice } from '../../types';

export const InvoicesPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubscribe = dbService.subscribe<Record<string, Invoice>>(
      `invoices/${activeTenant.tenantId}`,
      (data) => {
        if (data) {
          setInvoices(Object.values(data));
        } else {
          setInvoices([]);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTenant?.tenantId]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices & Receivables</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor open bills, due dates, aging, and dynamic UPI collection links
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice number or customer..."
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
            <option value="OPEN">Open Only</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No invoices found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Connect your Tally Windows Agent to synchronize bills automatically
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
                  <th className="px-6 py-3.5 text-right">Balance / Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5 font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">
                      {inv.customerName}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {inv.dueDate}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {inv.agingBucket}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(inv.balance)}</div>
                      <div className="text-[10px] text-slate-400">Total: {formatCurrency(inv.amount)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
