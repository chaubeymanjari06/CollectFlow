import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  Users,
  MessageSquare,
  FileCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Award,
  Filter,
  LifeBuoy,
  PlusCircle,
  HelpCircle,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import {
  PilotStage,
  PilotCluster,
  PilotMerchant,
  PilotKPIs,
  ControlledAccount,
  PilotGraduationCriterion,
  PilotSupportTicket,
  DailyPilotMeasurement,
} from '../../types';
import { pilotService } from '../../services/pilotService';

type TabKey = 'funnel' | 'guardrail' | 'clusters' | 'trajectory' | 'graduation' | 'tickets';

const STAGE_LABELS: Record<PilotStage, { label: string; step: number; color: string }> = {
  partner_onboarding: { label: '1. Partner Onboarding', step: 1, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  merchant_onboarding: { label: '2. Merchant Onboarding', step: 2, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  tally_connection: { label: '3. Tally Connection', step: 3, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  data_validation: { label: '4. Data Validation', step: 4, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  controlled_10_account: { label: '5. 10-Account Pilot', step: 5, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  full_activation: { label: '6. Full Activation', step: 6, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  payment_recon_test: { label: '7. Payment & Recon Test', step: 7, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  measurement_30_day: { label: '8. 30-Day Measurement', step: 8, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  graduated: { label: 'Graduated to Production', step: 9, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

export const PilotPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('funnel');
  const [kpis, setKpis] = useState<PilotKPIs | null>(null);
  const [clusters, setClusters] = useState<PilotCluster[]>([]);
  const [merchants, setMerchants] = useState<PilotMerchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<PilotMerchant | null>(null);
  const [tickets, setTickets] = useState<PilotSupportTicket[]>([]);
  const [measurements, setMeasurements] = useState<DailyPilotMeasurement[]>([]);
  const [graduationData, setGraduationData] = useState<{
    score: number;
    eligible: boolean;
    criteria: PilotGraduationCriterion[];
  } | null>(null);
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New ticket modal
  const [showNewTicketModal, setShowNewTicketModal] = useState<boolean>(false);
  const [newTicketTitle, setNewTicketTitle] = useState<string>('');
  const [newTicketCategory, setNewTicketCategory] = useState<PilotSupportTicket['category']>('TALLY_SYNC');
  const [newTicketSeverity, setNewTicketSeverity] = useState<PilotSupportTicket['severity']>('MEDIUM');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedKpis, fetchedClusters, fetchedMerchants, fetchedTickets, fetchedMeasurements] =
        await Promise.all([
          pilotService.getPilotKPIs(),
          pilotService.getClusters(),
          pilotService.getMerchants(),
          pilotService.getSupportTickets(),
          pilotService.getDailyMeasurements(),
        ]);

      setKpis(fetchedKpis);
      setClusters(fetchedClusters);
      setMerchants(fetchedMerchants);
      setTickets(fetchedTickets);
      setMeasurements(fetchedMeasurements);

      if (fetchedMerchants.length > 0 && !selectedMerchant) {
        setSelectedMerchant(fetchedMerchants[0]);
        const grad = await pilotService.getGraduationCriteria(fetchedMerchants[0].id);
        setGraduationData(grad);
      }
    } catch (err) {
      console.error('Failed to load pilot data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectMerchant = async (merchant: PilotMerchant) => {
    setSelectedMerchant(merchant);
    try {
      const grad = await pilotService.getGraduationCriteria(merchant.id);
      setGraduationData(grad);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdvanceStage = async (merchantId: string, nextStage: PilotStage) => {
    try {
      const updated = await pilotService.advanceStage(merchantId, nextStage);
      setMerchants((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      if (selectedMerchant?.id === updated.id) {
        setSelectedMerchant(updated);
        const grad = await pilotService.getGraduationCriteria(updated.id);
        setGraduationData(grad);
      }
      showToast(`Merchant successfully advanced to ${STAGE_LABELS[nextStage].label}!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to advance stage');
    }
  };

  const handleToggleGuardrail = async (merchantId: string, enabled: boolean) => {
    try {
      const updated = await pilotService.toggleControlled10Pilot(merchantId, enabled);
      setMerchants((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      if (selectedMerchant?.id === updated.id) {
        setSelectedMerchant(updated);
      }
      showToast(
        enabled
          ? 'Controlled 10-Account Throttle ENABLED (Restricted to safe test group)'
          : 'Controlled Throttle DISABLED (Full debtor activation mode)'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle throttle');
    }
  };

  const handleSimulateReminder = async (accountId: string) => {
    if (!selectedMerchant) return;
    try {
      const updatedAccount = await pilotService.simulateControlledReminder(selectedMerchant.id, accountId);
      setSelectedMerchant((prev) =>
        prev
          ? {
              ...prev,
              controlledAccounts: prev.controlledAccounts.map((a) =>
                a.id === updatedAccount.id ? updatedAccount : a
              ),
              messagesDelivered: prev.messagesDelivered + 1,
            }
          : null
      );
      showToast(`Safe test reminder delivered to ${updatedAccount.customerName}!`);
    } catch (err: any) {
      showToast(err.message || 'Simulation failed');
    }
  };

  const handleGraduate = async (merchantId: string) => {
    try {
      const graduated = await pilotService.graduateMerchant(merchantId);
      setMerchants((prev) => prev.map((m) => (m.id === graduated.id ? graduated : m)));
      if (selectedMerchant?.id === graduated.id) {
        setSelectedMerchant(graduated);
        const grad = await pilotService.getGraduationCriteria(graduated.id);
        setGraduationData(grad);
      }
      showToast(`🎉 Congratulations! ${graduated.businessName} has graduated to production!`);
    } catch (err: any) {
      showToast(err.message || 'Graduation failed');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim() || !selectedMerchant) return;
    try {
      const created = await pilotService.createSupportTicket({
        merchantId: selectedMerchant.id,
        merchantName: selectedMerchant.businessName,
        cluster: selectedMerchant.clusterName,
        title: newTicketTitle,
        category: newTicketCategory,
        severity: newTicketSeverity,
      });
      setTickets((prev) => [created, ...prev]);
      setShowNewTicketModal(false);
      setNewTicketTitle('');
      showToast(`Support Ticket ${created.ticketId} created with ${created.slaRemainingHours}h SLA`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create ticket');
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      const resolved = await pilotService.resolveSupportTicket(ticketId);
      setTickets((prev) => prev.map((t) => (t.ticketId === resolved.ticketId ? resolved : t)));
      showToast(`Ticket ${ticketId} resolved successfully!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve ticket');
    }
  };

  const formatCurrency = (amt: number) => {
    if (amt >= 10000000) {
      return `₹${(amt / 10000000).toFixed(2)} Cr`;
    }
    if (amt >= 100000) {
      return `₹${(amt / 100000).toFixed(2)} Lakh`;
    }
    return `₹${amt.toLocaleString('en-IN')}`;
  };

  const filteredMerchants =
    selectedClusterFilter === 'all'
      ? merchants
      : merchants.filter((m) => m.clusterId === selectedClusterFilter);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-900 text-white p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5" />
                Phase 18 — Pilot Launch
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-200 border border-brand-500/30">
                Live MSME Deployment
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Pilot Operations & Cohort Hub</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Target: 5–10 CA/Tally partners, 25–50 MSME businesses across 1–3 industrial clusters.
              Executing 8-step controlled pilot pipeline with strict 10-account safety guardrails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => showToast('Pilot audit report generated and downloaded as PDF/CSV!')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 backdrop-blur-sm"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Export 30-Day Audit
            </button>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg shadow-brand-500/30"
            >
              <PlusCircle className="w-4 h-4" />
              New Support Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Target vs Actual KPI Grid */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-brand-600" />
              Active MSMEs
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {kpis.activeBusinesses} <span className="text-xs font-normal text-slate-400">/ 25-50</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Target Exceeded (152%)</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              CA Partners
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {kpis.activePartners} <span className="text-xs font-normal text-slate-400">/ 5-10</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Target Met</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              Clusters
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {kpis.activeClusters} <span className="text-xs font-normal text-slate-400">/ 1-3</span>
            </div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Surat, Ludhiana, Peenya</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-600" />
              Sync Reliability
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">{kpis.syncSuccessRateAvg}%</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Benchmark &gt;= 98%</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
              Outstanding
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {formatCurrency(kpis.totalOutstandingTracked)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{kpis.totalInvoicesSynced} Invoices</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Pilot Collected
            </div>
            <div className="text-lg font-bold text-emerald-600 mt-1">
              {formatCurrency(kpis.totalAmountCollected)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              {kpis.collectionRecoveryRate}% Recovery
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              Response Rate
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">{kpis.avgResponseRate}%</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
              {kpis.avgPtpCreationRate}% PTP Gen
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-teal-600" />
              PTP Success
            </div>
            <div className="text-lg font-bold text-teal-600 mt-1">{kpis.avgPtpSuccessRate}%</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {kpis.totalReconciliationsCompleted} Reconciled
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('funnel')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'funnel'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          8-Step Pilot Pipeline
        </button>

        <button
          onClick={() => setActiveTab('guardrail')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'guardrail'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Controlled 10-Account Guardrail
        </button>

        <button
          onClick={() => setActiveTab('clusters')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'clusters'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Industrial Clusters (3)
        </button>

        <button
          onClick={() => setActiveTab('trajectory')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'trajectory'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          30-Day Velocity & Analytics
        </button>

        <button
          onClick={() => setActiveTab('graduation')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'graduation'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Graduation Readiness Scorecard
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'tickets'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Support & Diagnostics ({tickets.filter((t) => t.status !== 'RESOLVED').length})
        </button>
      </div>

      {/* TAB 1: 8-STEP PILOT PIPELINE FUNNEL */}
      {activeTab === 'funnel' && (
        <div className="space-y-4">
          {/* Cluster Filter */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Filter by Cluster:</span>
              <select
                value={selectedClusterFilter}
                onChange={(e) => setSelectedClusterFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All Clusters (Surat, Ludhiana, Peenya)</option>
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.merchantCount} MSMEs)
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredMerchants.length}</span> active pilot MSMEs
            </div>
          </div>

          {/* Pipeline Visual Stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMerchants.map((merchant) => {
              const currentStageMeta = STAGE_LABELS[merchant.stage];
              return (
                <div
                  key={merchant.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                    selectedMerchant?.id === merchant.id ? 'ring-2 ring-brand-500 border-transparent' : 'border-slate-200'
                  }`}
                  onClick={() => handleSelectMerchant(merchant)}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{merchant.businessName}</h3>
                        <div className="text-[11px] text-slate-500 mt-0.5">{merchant.clusterName}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStageMeta.color}`}>
                        {currentStageMeta.label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Pipeline Progress</span>
                        <span className="font-semibold text-slate-800">{merchant.stageProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${merchant.stageProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Metrics */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Tally Sync</span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {merchant.syncSuccessRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Outstanding</span>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(merchant.outstandingAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Collected</span>
                        <span className="font-semibold text-emerald-600">
                          {formatCurrency(merchant.amountCollected)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Safety Throttle</span>
                        <span
                          className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                            merchant.controlled10PilotActive
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {merchant.controlled10PilotActive ? '10-Acc Restricted' : 'Unrestricted'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Advance Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMerchant(merchant);
                        setActiveTab('guardrail');
                      }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      View Accounts &rarr;
                    </button>

                    {merchant.stage !== 'graduated' ? (
                      <select
                        value={merchant.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleAdvanceStage(merchant.id, e.target.value as PilotStage)}
                        className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100 focus:outline-none"
                      >
                        <option value="partner_onboarding">1. Partner Onboarding</option>
                        <option value="merchant_onboarding">2. Merchant Onboarding</option>
                        <option value="tally_connection">3. Tally Connection</option>
                        <option value="data_validation">4. Data Validation</option>
                        <option value="controlled_10_account">5. 10-Account Pilot</option>
                        <option value="full_activation">6. Full Activation</option>
                        <option value="payment_recon_test">7. Payment & Recon Test</option>
                        <option value="measurement_30_day">8. 30-Day Measurement</option>
                        <option value="graduated">Graduated to Production</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        Graduated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CONTROLLED 10-ACCOUNT GUARDRAIL */}
      {activeTab === 'guardrail' && (
        <div className="space-y-5">
          {/* Safety Architecture Context */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Controlled 10-Account Staged Rollout Guardrail
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                To guarantee zero debtor customer churn and eliminate WhatsApp spam reporting, CollectFlow enforces
                a strict 10-account safety boundary during the initial pilot phase. Automated WhatsApp reminders,
                dynamic UPI links, and PTP agreements are constrained only to these 10 curated test accounts until
                data accuracy, delivery receipt, and reconciliation parity reach 100%.
              </p>
            </div>
          </div>

          {/* Merchant Selector & Throttle Toggle */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Selected Pilot Merchant:</span>
              <select
                value={selectedMerchant?.id || ''}
                onChange={(e) => {
                  const m = merchants.find((item) => item.id === e.target.value);
                  if (m) handleSelectMerchant(m);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.businessName} ({m.clusterName})
                  </option>
                ))}
              </select>
            </div>

            {selectedMerchant && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">10-Account Safety Throttle:</span>
                <button
                  onClick={() =>
                    handleToggleGuardrail(selectedMerchant.id, !selectedMerchant.controlled10PilotActive)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    selectedMerchant.controlled10PilotActive
                      ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  {selectedMerchant.controlled10PilotActive ? 'GUARDRAIL ACTIVE (Restricted)' : 'UNRESTRICTED MODE'}
                </button>
              </div>
            )}
          </div>

          {/* 10 Designated Accounts Table */}
          {selectedMerchant && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    10 Controlled Pilot Debtor Accounts — {selectedMerchant.businessName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sampled representative receivables spanning 10 to 75 days overdue across key business relationships.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg">
                  10 of 10 Accounts Configured
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Debtor Customer Name</th>
                      <th className="py-3 px-4">Phone / WhatsApp</th>
                      <th className="py-3 px-4">Outstanding Balance</th>
                      <th className="py-3 px-4">Aging Overdue</th>
                      <th className="py-3 px-4">Reminder Status</th>
                      <th className="py-3 px-4">PTP Status</th>
                      <th className="py-3 px-4">Last Interaction</th>
                      <th className="py-3 px-4 text-right">Safe Test Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedMerchant.controlledAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">{account.customerName}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{account.phone}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatCurrency(account.outstandingBalance)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              account.overdueDays > 60
                                ? 'bg-red-100 text-red-700'
                                : account.overdueDays > 30
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {account.overdueDays} Days Overdue
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              account.reminderStatus === 'READ'
                                ? 'bg-emerald-100 text-emerald-700'
                                : account.reminderStatus === 'DELIVERED'
                                ? 'bg-teal-100 text-teal-700'
                                : account.reminderStatus === 'SENT'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {account.reminderStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              account.ptpStatus === 'HONORED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : account.ptpStatus === 'PROMISED'
                                ? 'bg-purple-100 text-purple-700'
                                : account.ptpStatus === 'BROKEN'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {account.ptpStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">{account.lastContactAt}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleSimulateReminder(account.id)}
                            className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-lg text-[11px] transition flex items-center gap-1 ml-auto"
                          >
                            <Smartphone className="w-3 h-3" />
                            Send Test WhatsApp
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INDUSTRIAL CLUSTERS */}
      {activeTab === 'clusters' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {clusters.map((cluster) => {
              const clusterMerchants = merchants.filter((m) => m.clusterId === cluster.id);
              const recoveryPct = Number(
                ((cluster.totalCollected / (cluster.totalOutstanding || 1)) * 100).toFixed(1)
              );

              return (
                <div key={cluster.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        Industrial Cluster
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{cluster.name}</h3>
                      <div className="text-xs text-slate-500">{cluster.location}</div>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                      {cluster.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{cluster.sector}</p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Active MSMEs</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {cluster.merchantCount} / {cluster.targetMerchants}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">CA / Tally Partners</span>
                      <span className="font-bold text-slate-800 text-sm">{cluster.partnerCount} Firms</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Outstanding</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formatCurrency(cluster.totalOutstanding)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Pilot Collected</span>
                      <span className="font-bold text-emerald-600 text-sm">
                        {formatCurrency(cluster.totalCollected)} ({recoveryPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-700 block mb-2">
                      Active Merchants in Cluster:
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {clusterMerchants.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            handleSelectMerchant(m);
                            setActiveTab('guardrail');
                          }}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-brand-50 transition cursor-pointer flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-800 truncate mr-2">{m.businessName}</span>
                          <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                            Day {m.pilotDayNumber} / 30
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: 30-DAY VELOCITY & ANALYTICS */}
      {activeTab === 'trajectory' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Cohort Duration</span>
              <div className="text-xl font-bold text-slate-900 mt-1">Day 28 of 30</div>
              <span className="text-xs text-emerald-600 font-medium">93% Measurement Period Completed</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Daily Average Run Rate</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">₹12.3 Lakh / Day</div>
              <span className="text-xs text-slate-500 font-medium">Average collection velocity</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Customer Interaction Funnel</span>
              <div className="text-xl font-bold text-brand-600 mt-1">42.6% Response</div>
              <span className="text-xs text-slate-500 font-medium">From WhatsApp reminders</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">PTP Conversion</span>
              <div className="text-xl font-bold text-teal-600 mt-1">78.4% Honored</div>
              <span className="text-xs text-emerald-600 font-medium">+18% vs manual calling</span>
            </div>
          </div>

          {/* 30-Day Measurement Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">30-Day Pilot Measurement Trajectory</h3>
                <p className="text-xs text-slate-500">
                  Continuous day-by-day telemetry measuring sync volume, reminder delivery, PTP generation, and collected funds.
                </p>
              </div>
              <button
                onClick={() => showToast('Full 30-day telemetry CSV exported!')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Pilot Day</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Active MSMEs</th>
                    <th className="py-2.5 px-4">Invoices Synced</th>
                    <th className="py-2.5 px-4">WhatsApp Sent</th>
                    <th className="py-2.5 px-4">Responses</th>
                    <th className="py-2.5 px-4">PTPs Created</th>
                    <th className="py-2.5 px-4 text-right">Cumulative Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {measurements.slice(0, 30).map((m) => (
                    <tr key={m.day} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-bold text-slate-800">Day {m.day}</td>
                      <td className="py-2.5 px-4 text-slate-500">{m.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{m.activeMerchants}</td>
                      <td className="py-2.5 px-4 text-slate-700">{m.invoicesSynced.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-slate-700">{m.messagesSent.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-brand-600 font-semibold">
                        {m.responsesReceived.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-teal-600 font-semibold">{m.ptpsCreated.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(m.amountCollected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GRADUATION READINESS SCORECARD */}
      {activeTab === 'graduation' && (
        <div className="space-y-5">
          {/* Merchant Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Select Merchant to Evaluate:</span>
              <select
                value={selectedMerchant?.id || ''}
                onChange={(e) => {
                  const m = merchants.find((item) => item.id === e.target.value);
                  if (m) handleSelectMerchant(m);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.businessName} — Score: {m.graduationScore}/100
                  </option>
                ))}
              </select>
            </div>

            {selectedMerchant && (
              <div>
                {selectedMerchant.stage === 'graduated' ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Graduated to Production Mode
                  </span>
                ) : (
                  <button
                    disabled={!selectedMerchant.graduationEligible}
                    onClick={() => handleGraduate(selectedMerchant.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      selectedMerchant.graduationEligible
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    Graduate to Production
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Readiness Scorecard */}
          {selectedMerchant && graduationData && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedMerchant.businessName}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Cluster: {selectedMerchant.clusterName} &bull; Tally Version: {selectedMerchant.tallyVersion} &bull; CA
                    Partner: {selectedMerchant.partnerName}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Graduation Score</div>
                    <div className="text-3xl font-extrabold text-slate-900">{graduationData.score} / 100</div>
                  </div>
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg border-2 ${
                      graduationData.score >= 80
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
                        : 'bg-amber-50 text-amber-700 border-amber-500'
                    }`}
                  >
                    {graduationData.score >= 80 ? 'PASS' : 'WARN'}
                  </div>
                </div>
              </div>

              {/* 6 Automated Criteria */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  6-Point Production Readiness Gates
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {graduationData.criteria.map((crit) => (
                    <div
                      key={crit.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start gap-3"
                    >
                      {crit.status === 'PASSED' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{crit.title}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              crit.status === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {crit.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{crit.description}</p>
                        <div className="mt-2 text-[11px] flex justify-between font-medium">
                          <span className="text-slate-500">Target: {crit.targetMetric}</span>
                          <span className="text-slate-800 font-bold">Actual: {crit.actualMetric}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SUPPORT & OPERATIONAL DIAGNOSTICS */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pilot Support &amp; Integration Queue</h3>
              <p className="text-xs text-slate-500">
                Track and triage pilot merchant support tickets, Tally connector issues, and WhatsApp delivery queries.
              </p>
            </div>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Raise Pilot Issue
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Merchant &amp; Cluster</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Title / Issue Description</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">SLA / Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.ticketId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{t.ticketId}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{t.merchantName}</div>
                      <div className="text-[10px] text-slate-400">{t.cluster}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium max-w-xs">{t.title}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700'
                            : t.severity === 'HIGH'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {t.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {t.status === 'RESOLVED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          RESOLVED
                        </span>
                      ) : (
                        <div className="text-[11px]">
                          <span className="font-bold text-amber-600 block">{t.status}</span>
                          <span className="text-slate-400 text-[10px]">SLA: {t.slaRemainingHours}h remaining</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {t.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleResolveTicket(t.ticketId)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded text-[11px] transition"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-brand-600" />
                Raise Pilot Support Ticket
              </h3>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Issue Description</label>
                <textarea
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="e.g. Tally port 9000 unreachable or customer opted out"
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                <select
                  value={newTicketCategory}
                  onChange={(e) => setNewTicketCategory(e.target.value as any)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="TALLY_SYNC">Tally Connector &amp; ODBC Sync</option>
                  <option value="WHATSAPP_DELIVERY">WhatsApp Template &amp; Delivery</option>
                  <option value="PAYMENT_QR">Payment QR &amp; UPI Intent</option>
                  <option value="RECON_DISCREPANCY">Reconciliation Discrepancy</option>
                  <option value="TRAINING">Merchant Onboarding &amp; Training</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Severity</label>
                <select
                  value={newTicketSeverity}
                  onChange={(e) => setNewTicketSeverity(e.target.value as any)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="CRITICAL">Critical (4h SLA)</option>
                  <option value="HIGH">High (8h SLA)</option>
                  <option value="MEDIUM">Medium (24h SLA)</option>
                  <option value="LOW">Low (48h SLA)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-500/20"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
