import React, { useEffect, useState } from 'react';
import { Users2, Search, Phone, Mail, ArrowUpRight } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { Customer } from '../../types';

export const CustomersPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);

    const unsubscribe = dbService.subscribe<Record<string, Customer>>(
      `customers/${activeTenant.tenantId}`,
      (data) => {
        if (data) {
          setCustomers(Object.values(data));
        } else {
          setCustomers([]);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTenant?.tenantId]);

  const filtered = customers.filter((c) =>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Customer 360</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Directory of ledger parties with contact details, overdue balances, and payment behavior
        </p>
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
              Customers will populate upon Tally sync or ledger import
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <div
                key={c.customerId}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{c.name}</div>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
