import React from 'react';
import { GitCompare, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const ReconciliationPage: React.FC = () => {
  const { activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reconciliation Engine</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Confidence-based matching engine pairing bank receipts to open invoices with Tally voucher write-back
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
          <div className="font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            95%–100% Match Confidence
          </div>
          <p className="text-emerald-700 mt-1">
            Auto-reconciles automatically and queues receipt voucher creation for Tally.
          </p>
        </div>

        <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100">
          <div className="font-bold text-amber-800 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            80%–94% Approval Queue
          </div>
          <p className="text-amber-700 mt-1">
            Requires one-click review by Accounts Manager before writing back to Tally.
          </p>
        </div>

        <div className="p-4 bg-slate-100/60 rounded-2xl border border-slate-200">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Manual Allocation Queue
          </div>
          <p className="text-slate-600 mt-1">
            Unidentified or partial payments needing split allocation across multiple bills.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
        <GitCompare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Reconciliation Queue is Clean</h3>
        <p className="text-xs text-slate-400 mt-1">
          All imported payments are reconciled or matched with current receivables.
        </p>
      </div>
    </div>
  );
};
