import React from 'react';
import { CreditCard, QrCode, CheckCircle, ArrowDownLeft } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const PaymentsPage: React.FC = () => {
  const { activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments & UPI Collections</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track real-time gateway payments, bank receipts, and generate dynamic UPI links
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Settled This Month</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">₹0</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Active UPI Links</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">0</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Unallocated Receipts</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">₹0</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
        <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800">No payment records yet</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Incoming payments via Razorpay, Cashfree, or Tally Bank receipts will appear here for automated matching.
        </p>
      </div>
    </div>
  );
};
