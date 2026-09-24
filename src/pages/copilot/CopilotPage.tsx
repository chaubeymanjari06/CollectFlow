import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Bot,
  BrainCircuit,
  MessageSquare,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Send,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  FileText,
  DollarSign,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { aiCopilotService } from '../../services/aiCopilotService';
import {
  Customer,
  Invoice,
  AccountDiagnosis,
  SmartDraftResult,
  ExtractedPtpResult,
  CashFlowForecast,
  ManagementSummary,
  MessageTone,
} from '../../types';

export const CopilotPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<
    'diagnose' | 'draft' | 'ptp' | 'forecast' | 'briefing'
  >('diagnose');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab 1: Diagnostician State
  const [diagnosis, setDiagnosis] = useState<AccountDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // Tab 2: Smart Message Drafter State
  const [tone, setTone] = useState<MessageTone>('firm');
  const [draftResult, setDraftResult] = useState<SmartDraftResult | null>(null);
  const [editableContent, setEditableContent] = useState<string>('');
  const [drafting, setDrafting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tab 3: PTP NLP Parser State
  const [nlpInput, setNlpInput] = useState<string>(
    'Received your reminder. Will pay 50k tomorrow via NEFT directly to your account.'
  );
  const [extractedPtp, setExtractedPtp] = useState<ExtractedPtpResult | null>(null);
  const [ptpSaving, setPtpSaving] = useState(false);

  // Tab 4: Cash Flow Forecast State
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [forecasting, setForecasting] = useState(false);

  // Tab 5: Management Summary State
  const [summary, setSummary] = useState<ManagementSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [copiedBriefing, setCopiedBriefing] = useState(false);

  // Load customer and invoice registry
  useEffect(() => {
    if (!activeTenant) return;
    const loadRegistry = async () => {
      try {
        const [custMap, invMap] = await Promise.all([
          dbService.get<Record<string, Customer>>(`customers/${activeTenant.tenantId}`),
          dbService.get<Record<string, Invoice>>(`invoices/${activeTenant.tenantId}`),
        ]);
        const custList = Object.values(custMap || {});
        setCustomers(custList);
        setInvoices(Object.values(invMap || {}));
        if (custList.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(custList[0].customerId);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadRegistry();
  }, [activeTenant]);

  // Trigger Account Diagnosis when customer changes
  useEffect(() => {
    if (!activeTenant || !selectedCustomerId) return;
    const runDiagnosis = async () => {
      setDiagnosing(true);
      try {
        const diag = await aiCopilotService.diagnoseCustomerAccount(
          activeTenant.tenantId,
          selectedCustomerId
        );
        setDiagnosis(diag);
      } catch (err) {
        console.error('Failed to diagnose customer account:', err);
      } finally {
        setDiagnosing(false);
      }
    };
    runDiagnosis();
  }, [activeTenant, selectedCustomerId]);

  // Trigger Smart Message Drafting when customer or tone changes
  useEffect(() => {
    if (!activeTenant || !selectedCustomerId) return;
    const runDraft = async () => {
      setDrafting(true);
      try {
        const draft = await aiCopilotService.draftSmartCollectionMessage(
          activeTenant.tenantId,
          selectedCustomerId,
          tone
        );
        setDraftResult(draft);
        if (draft) {
          setEditableContent(draft.content);
        }
      } catch (err) {
        console.error('Failed to draft message:', err);
      } finally {
        setDrafting(false);
      }
    };
    runDraft();
  }, [activeTenant, selectedCustomerId, tone]);

  // Trigger PTP NLP Parsing whenever nlpInput changes
  useEffect(() => {
    if (!nlpInput.trim()) {
      setExtractedPtp(null);
      return;
    }
    const result = aiCopilotService.extractPtpFromMessage(nlpInput);
    setExtractedPtp(result);
  }, [nlpInput]);

  // Trigger Cash Flow Forecast when tab active or days change
  useEffect(() => {
    if (!activeTenant || activeTab !== 'forecast') return;
    const runForecast = async () => {
      setForecasting(true);
      try {
        const data = await aiCopilotService.forecastCashFlow(
          activeTenant.tenantId,
          forecastDays
        );
        setForecast(data);
      } catch (err) {
        console.error('Failed to forecast cash flow:', err);
      } finally {
        setForecasting(false);
      }
    };
    runForecast();
  }, [activeTenant, forecastDays, activeTab]);

  // Trigger Executive Summary when briefing tab is active
  useEffect(() => {
    if (!activeTenant || activeTab !== 'briefing') return;
    const runSummary = async () => {
      setSummarizing(true);
      try {
        const data = await aiCopilotService.generateManagementSummary(
          activeTenant.tenantId
        );
        setSummary(data);
      } catch (err) {
        console.error('Failed to generate management summary:', err);
      } finally {
        setSummarizing(false);
      }
    };
    runSummary();
  }, [activeTenant, activeTab]);

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: activeTenant?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSendDraft = async () => {
    if (!activeTenant || !selectedCustomerId || !editableContent) return;
    setLoading(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await aiCopilotService.dispatchDraftedMessage(
        activeTenant.tenantId,
        selectedCustomerId,
        {
          content: editableContent,
          invoicesReferenced: draftResult?.invoicesReferenced,
        }
      );
      setActionSuccess(
        `Approved & queued to WhatsApp thread for ${draftResult?.recipientName || 'Customer'}.`
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch message.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPtp = async () => {
    if (!activeTenant || !selectedCustomerId || !extractedPtp?.extractedDate) {
      setActionError('Cannot register PTP: Valid promised date required.');
      return;
    }
    const customer = customers.find((c) => c.customerId === selectedCustomerId);
    setPtpSaving(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await aiCopilotService.confirmExtractedPtp(activeTenant.tenantId, {
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Customer',
        amount: extractedPtp.extractedAmount || 0,
        promisedDate: extractedPtp.extractedDate,
        notes: `AI NLP parsed: "${extractedPtp.rawText}"`,
      });
      setActionSuccess(
        `PTP registered for ₹${(extractedPtp.extractedAmount || 0).toLocaleString(
          'en-IN'
        )} by ${extractedPtp.extractedDate}. Reminders paused until date.`
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to register PTP.');
    } finally {
      setPtpSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'briefing') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Receivables AI Copilot
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-purple-100 text-purple-700">
                  Assistant
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                AI diagnosis, human-in-the-loop WhatsApp drafting, NLP PTP parsing & cash forecasting
              </p>
            </div>
          </div>
        </div>

        {/* Global Notification Banners */}
        {actionSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-1 pb-px">
        <button
          onClick={() => setActiveTab('diagnose')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
            activeTab === 'diagnose'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Account Diagnostician</span>
        </button>

        <button
          onClick={() => setActiveTab('draft')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
            activeTab === 'draft'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Smart Message Drafter</span>
        </button>

        <button
          onClick={() => setActiveTab('ptp')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
            activeTab === 'ptp'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>PTP Response Parser (NLP)</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
            activeTab === 'forecast'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Cash Flow Forecast</span>
        </button>

        <button
          onClick={() => setActiveTab('briefing')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
            activeTab === 'briefing'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Management Briefing</span>
        </button>
      </div>

      {/* Customer Picker Sub-Header (Used in Diagnostician, Drafter, and PTP tabs) */}
      {(activeTab === 'diagnose' || activeTab === 'draft' || activeTab === 'ptp') && (
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Target Customer:
            </span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name} ({c.riskTier || 'MEDIUM'} Risk — ₹
                  {(c.metrics?.totalReceivable || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] text-slate-400">
            {customers.find((c) => c.customerId === selectedCustomerId)?.contactPerson || 'Contact'}{' '}
            • {customers.find((c) => c.customerId === selectedCustomerId)?.mobile || ''}
          </div>
        </div>
      )}

      {/* TAB 1: ACCOUNT DIAGNOSTICIAN */}
      {activeTab === 'diagnose' && (
        <div className="space-y-4">
          {diagnosing ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              <p className="text-xs font-medium">Analyzing account history, aging & promises...</p>
            </div>
          ) : diagnosis ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Executive Summary & Root Causes */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-600" />
                      <h2 className="text-sm font-bold text-slate-900">
                        AI Account Diagnosis: {diagnosis.customerName}
                      </h2>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        diagnosis.riskAssessment.defaultProbability === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : diagnosis.riskAssessment.defaultProbability === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      Default Risk: {diagnosis.riskAssessment.defaultProbability}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed mt-3 bg-purple-50/40 p-3.5 rounded-xl border border-purple-100/60">
                    {diagnosis.executiveSummary}
                  </p>

                  {/* Identified Root Causes */}
                  <div className="mt-5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Identified Root Causes
                    </h3>
                    <div className="space-y-2">
                      {diagnosis.rootCauses.map((cause, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <span>{cause}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Action Strategies */}
                  <div className="mt-5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Recommended Collection Strategy
                    </h3>
                    <div className="space-y-2">
                      {diagnosis.recommendedStrategy.map((strat, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100/60 text-xs text-slate-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{strat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setActiveTab('draft')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm shadow-purple-600/20"
                    >
                      <span>Draft Message for Customer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Risk Assessment Breakdown Card */}
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Risk Assessment Matrix
                  </h3>

                  <div>
                    <span className="text-[11px] text-slate-400">Risk Classification</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          diagnosis.riskAssessment.riskTier === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700'
                            : diagnosis.riskAssessment.riskTier === 'HIGH'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {diagnosis.riskAssessment.riskTier} TIER
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Credit Limit Utilization</span>
                      <span className="font-bold text-slate-800">
                        {diagnosis.riskAssessment.creditUtilizationPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          diagnosis.riskAssessment.creditUtilizationPct > 100
                            ? 'bg-rose-500'
                            : diagnosis.riskAssessment.creditUtilizationPct > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            diagnosis.riskAssessment.creditUtilizationPct
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Max Overdue
                      </div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {diagnosis.riskAssessment.overdueDays}d
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Default Prob.
                      </div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {diagnosis.riskAssessment.defaultProbability}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs">
              Select a customer to run an AI diagnostic evaluation.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMART MESSAGE DRAFTER */}
      {activeTab === 'draft' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  Smart WhatsApp Message Drafter
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a tone and inspect the AI-generated draft. Human approval required before sending.
                </p>
              </div>

              {/* Tone Selection Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                {(['courteous', 'firm', 'urgent', 'final_notice'] as MessageTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      tone === t
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices and Recipient Meta */}
            {draftResult && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Recipient:</span>
                  <span className="text-slate-900 font-bold">{draftResult.recipientName}</span>
                  <span className="text-slate-400">({draftResult.recipientMobile})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Invoices:</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md font-mono text-[11px]">
                    {draftResult.invoicesReferenced.join(', ') || 'All Open Invoices'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(draftResult.totalAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Editable Draft Text Area (Human in the Loop) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Message Content (Editable Draft)
              </label>
              <textarea
                rows={10}
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                className="w-full text-xs font-mono p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 leading-relaxed"
                placeholder="Message draft will appear here..."
              />
            </div>

            {/* Embedded UPI Link Preview */}
            {draftResult?.suggestedUpiLink && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 text-xs">
                <div className="truncate">
                  <span className="font-semibold text-indigo-900 mr-2">Instant UPI Link:</span>
                  <code className="text-indigo-700 text-[11px] font-mono">
                    {draftResult.suggestedUpiLink}
                  </code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(draftResult.suggestedUpiLink || '', 'link')
                  }
                  className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-medium text-[11px] hover:bg-indigo-50 flex items-center gap-1 shrink-0"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy UPI'}</span>
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Messages dispatched via Meta WhatsApp Cloud API directly to customer mobile.
              </span>
              <button
                disabled={loading || drafting || !editableContent}
                onClick={handleSendDraft}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Queuing...' : 'Approve & Send to WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PTP RESPONSE PARSER (NLP) */}
      {activeTab === 'ptp' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Transcript Area */}
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-purple-600" />
                  Customer Chat / Reply Transcript
                </h2>
                <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  NLP Extractor
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Paste incoming WhatsApp reply or conversation excerpt:
                </label>
                <textarea
                  rows={5}
                  value={nlpInput}
                  onChange={(e) => setNlpInput(e.target.value)}
                  className="w-full text-xs p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800"
                  placeholder="e.g. Will pay 50,000 on next Friday..."
                />
              </div>

              {/* Sample Preset Test Buttons */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                  Quick NLP Test Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Will pay 50k tomorrow by NEFT',
                    'Arranging Rs. 1,50,000 by next Friday',
                    'Full payment of 2.5 lakh by month end',
                    'Cheque for 75000 will be deposited on 2026-10-15',
                  ].map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => setNlpInput(phrase)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                    >
                      "{phrase}"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Parsed Output Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Extracted Financial Commitment
                  </h3>
                  {extractedPtp && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        extractedPtp.confidenceScore >= 70
                          ? 'bg-emerald-100 text-emerald-700'
                          : extractedPtp.confidenceScore >= 40
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Confidence: {extractedPtp.confidenceScore}%
                    </span>
                  )}
                </div>

                {extractedPtp ? (
                  <div className="space-y-4 mt-4">
                    {/* Confidence Meter */}
                    <div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            extractedPtp.confidenceScore >= 70
                              ? 'bg-emerald-500'
                              : extractedPtp.confidenceScore >= 40
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${extractedPtp.confidenceScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-purple-700">
                          Promised Amount
                        </span>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">
                          {extractedPtp.extractedAmount
                            ? formatCurrency(extractedPtp.extractedAmount)
                            : 'Not detected'}
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-indigo-700">
                          Promised Date
                        </span>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">
                          {extractedPtp.extractedDate || 'Not detected'}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <span className="font-semibold text-slate-700 block mb-0.5">
                        Synthesized Intent:
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        {extractedPtp.customerIntent}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Type or select a message to test the NLP extractor.
                  </div>
                )}
              </div>

              {/* Confirm Commitment Button */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  disabled={
                    ptpSaving ||
                    !extractedPtp ||
                    !extractedPtp.extractedDate ||
                    !selectedCustomerId
                  }
                  onClick={handleConfirmPtp}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm shadow-purple-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {ptpSaving
                      ? 'Registering...'
                      : 'Register PTP & Pause Automated Reminders'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CASH FLOW FORECAST */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          {/* Horizon Switcher */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Inflow & Cash Collection Forecast
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monte Carlo weighting of verified PTP commitments vs invoice due date maturities
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[15, 30, 60].map((days) => (
                <button
                  key={days}
                  onClick={() => setForecastDays(days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    forecastDays === days
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {forecasting ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              <p className="text-xs font-medium">Calculating forecast distributions...</p>
            </div>
          ) : forecast ? (
            <div className="space-y-6">
              {/* 3 Main Projection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Expected Projection */}
                <div className="p-5 rounded-2xl bg-white border-2 border-purple-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Expected Case (Recommended)
                    </span>
                    <div className="text-2xl font-bold text-slate-900 mt-3">
                      {formatCurrency(forecast.expectedInflow)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Models 85% realization on PTP commitments + 65% on maturing invoices
                    </p>
                  </div>
                </div>

                {/* Conservative Projection */}
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Conservative Case
                    </span>
                    <div className="text-2xl font-bold text-slate-900 mt-3">
                      {formatCurrency(forecast.conservativeInflow)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Accounts for potential 30-day rollovers and disputed accounts
                    </p>
                  </div>
                </div>

                {/* Optimistic Projection */}
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Optimistic Case
                    </span>
                    <div className="text-2xl font-bold text-slate-900 mt-3">
                      {formatCurrency(forecast.optimisticInflow)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Assumes 100% PTP fulfillment with prompt settlement
                    </p>
                  </div>
                </div>
              </div>

              {/* Inflow Sub-Components Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Inflow Pipeline Composition ({forecast.periodDays} Days)
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            PTP-Backed Inflow
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Firm commitments logged in system
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {formatCurrency(forecast.ptpBackedInflow)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            Scheduled Due Invoices
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Standard billing maturities in period
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {formatCurrency(forecast.dueInvoiceInflow)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modeling Assumptions */}
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Modeling Assumptions & Disclosures
                  </h3>

                  <div className="space-y-2">
                    {forecast.assumptions.map((assump, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs text-slate-600"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <span>{assump}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 5: MANAGEMENT BRIEFING */}
      {activeTab === 'briefing' && (
        <div className="space-y-4">
          {summarizing ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              <p className="text-xs font-medium">Synthesizing executive briefing narrative...</p>
            </div>
          ) : summary ? (
            <div className="space-y-6">
              {/* Executive Narrative Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Executive Receivables Briefing • {summary.tenantName}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${summary.executiveNarrative}\n\nKey Actions:\n${summary.suggestedActionItems.join(
                          '\n'
                        )}`,
                        'briefing'
                      )
                    }
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedBriefing ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBriefing ? 'Copied' : 'Copy Briefing'}</span>
                  </button>
                </div>

                <p className="text-sm font-light text-slate-200 leading-relaxed">
                  {summary.executiveNarrative}
                </p>
              </div>

              {/* KPI Snapshot Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">
                    Total Book Receivables
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {formatCurrency(summary.totalReceivables)}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">
                    Overdue Arrears
                  </div>
                  <div className="text-xl font-bold text-rose-600 mt-1">
                    {summary.overduePercentage}%
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">
                    Days Sales Outstanding
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {summary.dso} Days
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">
                    Critical Accounts
                  </div>
                  <div className="text-xl font-bold text-amber-600 mt-1">
                    {summary.criticalAccountsCount}
                  </div>
                </div>
              </div>

              {/* Top Overdue Accounts & Action Items */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Overdue Accounts */}
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Top Priority Interventions
                  </h3>

                  <div className="divide-y divide-slate-100">
                    {summary.topOverdueAccounts.length > 0 ? (
                      summary.topOverdueAccounts.map((acc, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-800">{acc.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Past due by {acc.daysOverdue} days
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-rose-600">
                              {formatCurrency(acc.overdueAmount)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No critical overdue accounts found.
                      </div>
                    )}
                  </div>
                </div>

                {/* CXO Suggested Actions */}
                <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                    Strategic Action Checklist
                  </h3>

                  <div className="space-y-2.5">
                    {summary.suggestedActionItems.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
