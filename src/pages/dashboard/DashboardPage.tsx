import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Send,
  GitCompare,
  RefreshCw,
  Building2,
  ArrowUpRight
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { DashboardMetrics } from '../../types';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenant) return;

    // Realtime subscription to tenant dashboard metrics
    const unsubscribe = dbService.subscribe<DashboardMetrics>(
      `dashboard/${activeTenant.tenantId}`,
      (data) => {
        setMetrics(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTenant?.tenantId]);

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-8">
      {/* Welcome / Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-brand-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/10">
        <div>
          <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold mb-1 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            {activeTenant?.name || 'Company Dashboard'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Receivables Overview</h1>
          <p className="text-xs text-slate-300 mt-1">
            Automating customer follow-ups and Tally reconciliation in real-time
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/reminders"
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Trigger Reminders
          </Link>
          <Link
            to="/reconciliation"
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition flex items-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Reconcile
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Receivables</span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '...' : formatCurrency(metrics?.totalReceivables)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {metrics?.openInvoicesCount || 0} open invoices
            </div>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Overdue Amount</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {loading ? '...' : formatCurrency(metrics?.overdueAmount)}
            </div>
            <div className="text-[11px] text-rose-400 mt-0.5 font-medium">
              {metrics?.overdueInvoicesCount || 0} invoices past due date
            </div>
          </div>
        </div>

        {/* Collected This Month */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Collected This Month</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? '...' : formatCurrency(metrics?.collectedThisMonth)}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">
              Verified through bank / UPI
            </div>
          </div>
        </div>

        {/* DSO & PTP Health */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">DSO & Active PTPs</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {metrics?.dso || 0} <span className="text-xs font-normal text-slate-400">days</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average collection delay</div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-brand-600">
                {metrics?.activePtpCount || 0}
              </span>
              <div className="text-[10px] text-slate-400">Promises Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Analysis Section */}
      <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Aging Analysis Buckets</h2>
            <p className="text-xs text-slate-400">Categorization of receivables based on invoice due dates</p>
          </div>
          <span className="text-xs font-semibold text-brand-600 flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Real-time
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Current</div>
            <div className="text-base font-bold text-slate-800 mt-1">
              {formatCurrency(metrics?.agingBuckets?.current)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 text-center">
            <div className="text-[11px] font-bold text-amber-700 uppercase">1–30 Days</div>
            <div className="text-base font-bold text-amber-800 mt-1">
              {formatCurrency(metrics?.agingBuckets?.days1_30)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-100 text-center">
            <div className="text-[11px] font-bold text-orange-700 uppercase">31–60 Days</div>
            <div className="text-base font-bold text-orange-800 mt-1">
              {formatCurrency(metrics?.agingBuckets?.days31_60)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 text-center">
            <div className="text-[11px] font-bold text-rose-700 uppercase">61–90 Days</div>
            <div className="text-base font-bold text-rose-800 mt-1">
              {formatCurrency(metrics?.agingBuckets?.days61_90)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-red-100/60 border border-red-200 text-center">
            <div className="text-[11px] font-bold text-red-800 uppercase">90+ Days</div>
            <div className="text-base font-bold text-red-900 mt-1">
              {formatCurrency(metrics?.agingBuckets?.days90Plus)}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Overdue Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Overdue Accounts */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Highest Overdue Customers</h3>
              <Link to="/customers" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {metrics?.topOverdueCustomers && metrics.topOverdueCustomers.length > 0 ? (
              <div className="space-y-3">
                {metrics.topOverdueCustomers.map((cust) => (
                  <div
                    key={cust.customerId}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{cust.name}</div>
                      <div className="text-[10px] text-slate-400">Oldest due: {cust.oldestDueDate}</div>
                    </div>
                    <div className="font-bold text-rose-600">{formatCurrency(cust.overdueAmount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No overdue accounts detected for this company.
              </div>
            )}
          </div>
        </div>

        {/* Tally Synchronization & Automation Status */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Workflow Automation Status</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-brand-600" />
                <div>
                  <div className="font-semibold text-slate-800">WhatsApp Collection Reminders</div>
                  <div className="text-[10px] text-slate-400">Scheduled daily at 10:00 AM IST</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                Active
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="font-semibold text-slate-800">Tally Receipt Write-Back</div>
                  <div className="text-[10px] text-slate-400">Automated queue for verified reconciliations</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px]">
                Ready
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-teal-600" />
                <div>
                  <div className="font-semibold text-slate-800">UPI Payment Links</div>
                  <div className="text-[10px] text-slate-400">Dynamic QR + UPI intent enabled</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-bold text-[10px]">
                Enabled
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
