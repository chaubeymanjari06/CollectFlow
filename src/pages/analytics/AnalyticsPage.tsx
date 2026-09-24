import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Send,
  ArrowUpRight,
  Target,
  BarChart3,
  Layers,
  Zap,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { collectionIntelligenceService } from '../../services/collectionIntelligenceService';
import { CollectionIntelligenceMetrics } from '../../types';
import { Link } from 'react-router-dom';

export const AnalyticsPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [metrics, setMetrics] = useState<CollectionIntelligenceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const data = await collectionIntelligenceService.getCollectionIntelligence(
        activeTenant.tenantId
      );
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load collection intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenant]);

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-brand-600" />
            Collection Intelligence & Priority Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            DSO tracking, collection efficiency, risk tiers, and transparent priority scoring
          </p>
        </div>

        <button
          onClick={loadData}
          title="Refresh metrics"
          className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DSO */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Days Sales Outstanding (DSO)</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '...' : `${metrics?.dso || 0} Days`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Industry Target: &lt;45 Days
            </div>
          </div>
        </div>

        {/* Collection Efficiency */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Collection Efficiency (CEI)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? '...' : `${metrics?.collectionEfficiencyPct || 0}%`}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">
              Ratio of billed capital collected
            </div>
          </div>
        </div>

        {/* Overdue Percentage */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Overdue Ratio</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600">
              {loading ? '...' : `${metrics?.overduePercentage || 0}%`}
            </div>
            <div className="text-[11px] text-amber-600/80 mt-0.5 font-medium">
              {formatCurrency(metrics?.totalOverdue)} overdue
            </div>
          </div>
        </div>

        {/* Capital At Risk */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Capital at Risk (&gt;60 Days)</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {loading ? '...' : formatCurrency(metrics?.atRiskCapital)}
            </div>
            <div className="text-[11px] text-rose-400 mt-0.5 font-medium">
              High-priority accounts
            </div>
          </div>
        </div>
      </div>

      {/* Risk Distribution Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Customer Portfolio Risk Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between">
            <div>
              <div className="text-rose-500 font-semibold uppercase text-[10px]">
                Critical Urgency
              </div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                {metrics?.riskBreakdown.critical || 0}
              </div>
            </div>
            <ShieldAlert className="w-6 h-6 text-rose-500" />
          </div>

          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <div className="text-amber-500 font-semibold uppercase text-[10px]">
                High Urgency
              </div>
              <div className="text-xl font-bold text-amber-700 mt-1">
                {metrics?.riskBreakdown.high || 0}
              </div>
            </div>
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>

          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <div className="text-blue-500 font-semibold uppercase text-[10px]">
                Moderate Urgency
              </div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {metrics?.riskBreakdown.medium || 0}
              </div>
            </div>
            <Clock className="w-6 h-6 text-blue-500" />
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <div className="text-emerald-500 font-semibold uppercase text-[10px]">
                Low Urgency
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {metrics?.riskBreakdown.low || 0}
              </div>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Priority Action Queue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-600" />
              Prioritized Follow-Up Queue
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked dynamically by overdue balance, aging days, broken promises, and credit terms
            </p>
          </div>
          <Link
            to="/reminders"
            className="px-3.5 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-brand-700 transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Launch WhatsApp Batch
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Calculating collection priority scores...
          </div>
        ) : !metrics || metrics.priorityQueue.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            No prioritized collection actions required. All accounts are within credit terms!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {metrics.priorityQueue.map((item, index) => (
              <div
                key={item.customerId}
                className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-xs"
              >
                {/* Left: Priority Rank & Customer */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center shrink-0 ${
                      item.urgency === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : item.urgency === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : item.urgency === 'MEDIUM'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    #{index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.customerName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.urgency === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : item.urgency === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : item.urgency === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Priority Score: {item.priorityScore} ({item.urgency})
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Mobile: {item.mobile} • Total Due: {formatCurrency(item.totalReceivable)} • Overdue:{' '}
                      <span className="font-bold text-rose-600">
                        {formatCurrency(item.overdueBalance)}
                      </span>
                    </div>

                    {/* Transparent Factor Breakdown */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.contributingFactors.map((factor, fIdx) => (
                        <span
                          key={fIdx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]"
                        >
                          • {factor}
                        </span>
                      ))}
                    </div>

                    {/* Recommended Action */}
                    <div className="mt-2 text-brand-700 font-semibold text-[11px] flex items-center gap-1.5">
                      <span>Action:</span>
                      <span className="text-slate-800 font-normal">{item.recommendedAction}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <Link
                    to="/customers"
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
                  >
                    View 360
                  </Link>
                  <Link
                    to="/reminders"
                    className="px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 font-semibold text-xs transition flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Remind
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
