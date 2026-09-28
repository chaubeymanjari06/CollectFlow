import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Users,
  FileSpreadsheet,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  TrendingUp,
  FileText,
  DollarSign,
  Search,
  Filter,
  Check,
  Eye,
  Trash2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { promotionService, DEFAULT_MSME_PROMO_TEMPLATES } from '../../services/promotionService';
import {
  PromotionClient,
  PromotionTemplate,
  PromotionCampaign,
  PromotionInquiry,
} from '../../types/promotions';

export const PromotionsPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin } = useTenant();

  // Active Tab: 'overview' | 'clients' | 'templates' | 'composer' | 'inquiries'
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'templates' | 'composer' | 'inquiries'>('overview');

  // Data states
  const [clients, setClients] = useState<PromotionClient[]>([]);
  const [templates, setTemplates] = useState<PromotionTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [inquiries, setInquiries] = useState<PromotionInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Client Directory Filters & Search
  const [clientSearch, setClientSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');

  // Add Client Modal
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    gstin: '',
    city: '',
    tag: 'WHOLESALE',
  });

  // CSV Import Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);

  // Template Studio state
  const [selectedTemplate, setSelectedTemplate] = useState<PromotionTemplate | null>(null);

  // Campaign Wizard State
  const [campaignName, setCampaignName] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'EMAIL' | 'OMNICHANNEL'>('WHATSAPP');
  const [wizardTemplateId, setWizardTemplateId] = useState<string>('preset_festive_volume_scheme');
  const [targetMode, setTargetMode] = useState<'ALL_CLIENTS' | 'SEGMENT'>('ALL_CLIENTS');
  const [targetTag, setTargetTag] = useState<string>('ALL');
  const [excludeFrozenCredit, setExcludeFrozenCredit] = useState(true);
  const [testOwnerMobile, setTestOwnerMobile] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Load all promotions data
  const loadData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [cList, tList, cmpList, inqList] = await Promise.all([
        promotionService.getClients(activeTenant.tenantId),
        promotionService.getTemplates(activeTenant.tenantId),
        promotionService.getCampaigns(activeTenant.tenantId),
        promotionService.getInquiries(activeTenant.tenantId),
      ]);
      setClients(cList);
      setTemplates(tList);
      setCampaigns(cmpList);
      setInquiries(inqList);
      if (tList.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tList[0]);
      }
    } catch (err) {
      console.error('Failed to load promotions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTenant?.tenantId]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // 1-Click Sync from Tally / CollectFlow Customers
  const handleSyncFromTally = async () => {
    if (!activeTenant) return;
    try {
      const { syncedCount } = await promotionService.syncClientsFromCustomers(activeTenant.tenantId);
      await loadData();
      showToast('success', `Synced ${syncedCount} verified client contacts from Tally ledgers!`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to sync from Tally customers');
    }
  };

  // Add Single Client Form Submit
  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    if (!newClient.companyName || !newClient.mobile) {
      showToast('error', 'Company name and mobile number are required.');
      return;
    }

    try {
      await promotionService.createClient(activeTenant.tenantId, {
        companyName: newClient.companyName,
        contactPerson: newClient.contactPerson || newClient.companyName,
        mobile: newClient.mobile,
        email: newClient.email || undefined,
        gstin: newClient.gstin ? newClient.gstin.toUpperCase() : undefined,
        city: newClient.city || 'Local',
        tags: [newClient.tag],
        source: 'MANUAL',
      });
      setShowAddClientModal(false);
      setNewClient({ companyName: '', contactPerson: '', mobile: '', email: '', gstin: '', city: '', tag: 'WHOLESALE' });
      await loadData();
      showToast('success', 'Client added to directory successfully.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add client.');
    }
  };

  // CSV Bulk Import Parse
  const handleCsvImport = async () => {
    if (!activeTenant || !csvRawText.trim()) return;
    setImportingCsv(true);
    try {
      const lines = csvRawText.trim().split('\n');
      const parsed: Array<Partial<PromotionClient>> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Skip header row if present
        if (i === 0 && (line.toLowerCase().includes('company') || line.toLowerCase().includes('phone') || line.toLowerCase().includes('name'))) {
          continue;
        }

        const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 2) {
          parsed.push({
            companyName: cols[0],
            contactPerson: cols[1] || cols[0],
            mobile: cols[2] || cols[1],
            email: cols[3] || '',
            city: cols[4] || '',
            tags: cols[5] ? [cols[5]] : ['CSV_IMPORT'],
          });
        }
      }

      if (parsed.length === 0) {
        showToast('error', 'No valid rows found in CSV. Format: CompanyName, ContactPerson, Mobile, Email, City, Tag');
        return;
      }

      const { importedCount } = await promotionService.bulkImportClients(activeTenant.tenantId, parsed);
      setShowCsvModal(false);
      setCsvRawText('');
      await loadData();
      showToast('success', `Imported ${importedCount} client contacts from CSV!`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to import CSV.');
    } finally {
      setImportingCsv(false);
    }
  };

  // Delete Client
  const handleDeleteClient = async (clientId: string) => {
    if (!activeTenant) return;
    if (confirm('Are you sure you want to remove this client from the promotion directory?')) {
      await promotionService.deleteClient(activeTenant.tenantId, clientId);
      await loadData();
      showToast('success', 'Client removed.');
    }
  };

  // Launch Campaign Wizard Dispatch
  const handleLaunchCampaign = async (isTestOnly: boolean = false) => {
    if (!activeTenant) return;
    if (!campaignName.trim() && !isTestOnly) {
      showToast('error', 'Please provide a campaign name.');
      return;
    }

    setDispatching(true);
    try {
      // 1. Create campaign draft
      const targetAudienceCount = targetMode === 'ALL_CLIENTS'
        ? clients.length
        : clients.filter((c) => c.tags.includes(targetTag)).length;

      const campaign = await promotionService.createCampaign(activeTenant.tenantId, {
        name: campaignName.trim() || `Diwali Special Blast - ${new Date().toLocaleDateString()}`,
        templateId: wizardTemplateId,
        channel: selectedChannel,
        targeting: {
          mode: targetMode,
          filterTags: targetMode === 'SEGMENT' ? [targetTag] : undefined,
          excludeFrozenCredit,
        },
        dispatchConfig: {
          totalTargetAudience: targetAudienceCount,
          estimatedMetaCostInr: Math.round(targetAudienceCount * 0.8),
          batchSizePerMinute: 20,
          sendTestToOwnerNumber: testOwnerMobile || undefined,
          isScheduled: false,
        },
        createdBy: 'user',
      });

      // 2. Dispatch
      if (isTestOnly) {
        if (!testOwnerMobile) {
          showToast('error', 'Please enter your mobile number for the test broadcast.');
          setDispatching(false);
          return;
        }
        const res = await promotionService.dispatchCampaign(activeTenant.tenantId, campaign.campaignId, testOwnerMobile);
        showToast('success', res.message);
      } else {
        const res = await promotionService.dispatchCampaign(activeTenant.tenantId, campaign.campaignId);
        showToast('success', res.message);
        setActiveTab('overview');
        setCampaignName('');
      }

      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to dispatch campaign.');
    } finally {
      setDispatching(false);
    }
  };

  // Inbound Inquiry Status Update
  const handleInquiryStatusChange = async (inquiryId: string, status: PromotionInquiry['status']) => {
    if (!activeTenant) return;
    try {
      await promotionService.updateInquiryStatus(activeTenant.tenantId, inquiryId, status);
      await loadData();
      showToast('success', `Inquiry status updated to ${status}.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update status.');
    }
  };

  // Filtered Clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.mobile.includes(clientSearch) ||
      (c.city && c.city.toLowerCase().includes(clientSearch.toLowerCase()));

    if (selectedTagFilter === 'ALL') return matchesSearch;
    if (selectedTagFilter === 'PROMPT_PAYER') return matchesSearch && (c.financialSnapshot?.overdueAmount || 0) === 0;
    if (selectedTagFilter === 'ZERO_DEBT') return matchesSearch && (c.financialSnapshot?.currentOutstanding || 0) === 0;
    if (selectedTagFilter === 'HIGH_OVERDUE') return matchesSearch && (c.financialSnapshot?.overdueAmount || 0) > 50000;
    return matchesSearch && c.tags.includes(selectedTagFilter);
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold border transition animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          data-testid="toast-notification"
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                Promotions & Growth Hub
              </h1>
              <p className="text-xs text-slate-500">
                प्रमोशन एवं व्यापार विस्तार केंद्र • Broadcast schemes, catalogs & early-cash discount offers over WhatsApp & Email
              </p>
            </div>
          </div>
        </div>

        {/* Meta Cloud WhatsApp Quality Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Meta WhatsApp Quality: <strong>High (Healthy)</strong></span>
          </div>

          <button
            onClick={() => setActiveTab('composer')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold text-slate-600 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Campaigns Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'clients'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Client Directory & CSV ({clients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Template Studio ({templates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'composer'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Campaign Wizard</span>
        </button>

        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'inquiries'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Inbound Leads ({inquiries.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CAMPAIGNS OVERVIEW & MSME ROI                      */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total B2B Audience</span>
                <Users className="w-4 h-4 text-brand-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{clients.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Verified WhatsApp / email business contacts</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">WhatsApp Read Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">81.5%</div>
              <p className="text-[11px] text-slate-400 mt-1">High engagement rate across Indian MSMEs</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inbound Leads</span>
                <MessageSquare className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-700">{inquiries.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Direct buyer WhatsApp responses</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue Recovered</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">₹ 3,45,000</div>
              <p className="text-[11px] text-slate-400 mt-1">Cash recovered via early-settlement schemes</p>
            </div>
          </div>

          {/* Recent Campaigns Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Promotional Campaigns</h3>
                <p className="text-[11px] text-slate-400">Track delivery funnels, read rates, and conversions</p>
              </div>
              <button
                onClick={() => setActiveTab('composer')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 transition"
              >
                + Create Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-700">No campaigns launched yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Launch your first promotional broadcast to announce festive discounts, new arrivals, or early cash recovery offers.
                </p>
                <button
                  onClick={() => setActiveTab('composer')}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold"
                >
                  Launch First Campaign
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Campaign Name</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Recipients</th>
                      <th className="p-3">Delivered</th>
                      <th className="p-3">Read Rate</th>
                      <th className="p-3">Inquiries</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map((cmp) => (
                      <tr key={cmp.campaignId} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{cmp.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {cmp.channel}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{cmp.metrics?.totalQueued || 0}</td>
                        <td className="p-3 text-slate-600">{cmp.metrics?.deliveredCount || 0}</td>
                        <td className="p-3 text-emerald-600 font-medium">
                          {cmp.metrics?.totalQueued
                            ? `${Math.round(((cmp.metrics.readCount || 0) / cmp.metrics.totalQueued) * 100)}%`
                            : '0%'}
                        </td>
                        <td className="p-3 font-semibold text-indigo-600">{cmp.metrics?.inquiriesReceived || 0}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cmp.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : cmp.status === 'DISPATCHING'
                                ? 'bg-amber-50 text-amber-700 animate-pulse'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {cmp.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(cmp.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CLIENT DIRECTORY & CSV BULK INGESTION              */}
      {/* ========================================================= */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {/* Action Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by company, mobile, person, city..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="bg-transparent text-xs w-full focus:outline-none text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncFromTally}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title="1-Click Pull from Tally Customer Ledgers"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync from Tally</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCsvModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import CSV / Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddClientModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>

          {/* Quick Segment Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-semibold text-slate-600">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filter:
            </span>
            {['ALL', 'PROMPT_PAYER', 'ZERO_DEBT', 'TALLY_LEDGER', 'CSV_IMPORT', 'HIGH_OVERDUE', 'WHOLESALE'].map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(tag)}
                className={`px-2.5 py-1 rounded-lg border transition ${
                  selectedTagFilter === tag
                    ? 'bg-brand-50 text-brand-700 border-brand-200 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tag.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Clients Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3">Company & Contact</th>
                    <th className="p-3">WhatsApp Mobile</th>
                    <th className="p-3">City / Cluster</th>
                    <th className="p-3">Financial Snapshot</th>
                    <th className="p-3">Tags</th>
                    <th className="p-3">DPDP Opt-out</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No clients found. Click <strong>"Sync from Tally"</strong> or <strong>"Import CSV"</strong> to populate your promotional audience.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.clientId} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{client.companyName}</div>
                          <div className="text-[11px] text-slate-400">{client.contactPerson}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-slate-700">{client.mobile}</span>
                        </td>
                        <td className="p-3 text-slate-600">{client.city || 'India'}</td>
                        <td className="p-3">
                          {client.financialSnapshot ? (
                            <div className="text-[11px]">
                              <span className="text-slate-500">Balance: ₹{client.financialSnapshot.currentOutstanding.toLocaleString()}</span>
                              {client.financialSnapshot.isCreditFrozen && (
                                <span className="ml-1 text-rose-600 font-bold">[Credit Frozen]</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {client.tags.slice(0, 2).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {client.preferences?.promotionsOptOut ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              STOP (Opted-Out)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Active (Opted-In)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteClient(client.clientId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Delete contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: TEMPLATE STUDIO & WHATSAPP PHONE SIMULATOR        */}
      {/* ========================================================= */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Template Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Pre-Built MSME Promotional Schemes</h3>
            <p className="text-xs text-slate-500">Pick any template to preview its exact visual appearance on WhatsApp.</p>

            <div className="space-y-2.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.templateId}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    selectedTemplate?.templateId === tpl.templateId
                      ? 'bg-brand-50/60 border-brand-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">{tpl.title}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {tpl.category.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{tpl.whatsapp.bodyText}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive Phone Simulator */}
          <div className="lg:col-span-6">
            {selectedTemplate && (
              <div className="bg-slate-900 rounded-3xl p-4 shadow-xl border-4 border-slate-800 max-w-sm mx-auto">
                {/* Phone Header */}
                <div className="flex items-center justify-between text-white text-[11px] pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-xs">
                      CF
                    </div>
                    <div>
                      <div className="font-bold leading-none">{activeTenant?.name || 'Your Company'}</div>
                      <div className="text-[9px] text-emerald-400">Official Business Account</div>
                    </div>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>

                {/* WhatsApp Chat Area */}
                <div className="py-4 space-y-2 text-xs">
                  <div className="bg-white rounded-2xl p-3 shadow-md space-y-2 text-slate-800">
                    {/* Header attachment */}
                    {selectedTemplate.whatsapp.headerType === 'DOCUMENT' && (
                      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 text-slate-700">
                        <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                        <div className="truncate">
                          <div className="font-bold text-[11px] truncate">{selectedTemplate.whatsapp.headerFileName}</div>
                          <div className="text-[10px] text-slate-400">PDF Document • 2.4 MB</div>
                        </div>
                      </div>
                    )}

                    {selectedTemplate.whatsapp.headerType === 'IMAGE' && (
                      <div className="rounded-xl overflow-hidden bg-slate-200 h-28 flex items-center justify-center text-slate-400 text-[10px]">
                        [Promotional Stock Image Header]
                      </div>
                    )}

                    {/* Body */}
                    <div className="text-slate-800 leading-relaxed text-[11px]">
                      {selectedTemplate.whatsapp.bodyText
                        .replace('{{1}}', 'Ramesh Bhai')
                        .replace('{{2}}', activeTenant?.name || 'Our Company')
                        .replace('{{3}}', '5% Cash Rebate')
                        .replace('{{4}}', '31st October')}
                    </div>

                    {/* Footer */}
                    <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                      {selectedTemplate.whatsapp.footerText}
                    </div>
                  </div>

                  {/* Interactive CTA Buttons */}
                  {selectedTemplate.whatsapp.buttons?.map((btn, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl py-2 px-3 text-center font-semibold text-emerald-700 text-xs shadow-sm flex items-center justify-center gap-1.5 border border-slate-100"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>{btn.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: CAMPAIGN WIZARD & PRE-FLIGHT VERIFIER              */}
      {/* ========================================================= */}
      {activeTab === 'composer' && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Campaign Dispatch Wizard</h2>
            <p className="text-xs text-slate-500">Configure audience, safe credit filters, and review pre-flight costs.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Diwali 2026 Volume Advance Booking"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-800"
                >
                  <option value="WHATSAPP">WhatsApp Business (Meta Cloud API)</option>
                  <option value="EMAIL">Branded Email Broadcast</option>
                  <option value="OMNICHANNEL">Omnichannel (WhatsApp + Email)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Offer Template</label>
                <select
                  value={wizardTemplateId}
                  onChange={(e) => setWizardTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none text-slate-800"
                >
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audience Targeting & Credit Risk Filter */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <span className="font-bold text-slate-800 block">Audience & Credit Risk Guardrail</span>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={targetMode === 'ALL_CLIENTS'}
                    onChange={() => setTargetMode('ALL_CLIENTS')}
                  />
                  <span>All Clients in Directory ({clients.length})</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={targetMode === 'SEGMENT'}
                    onChange={() => setTargetMode('SEGMENT')}
                  />
                  <span>Target by Category Tag</span>
                </label>
              </div>

              {targetMode === 'SEGMENT' && (
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Select Tag Group</label>
                  <select
                    value={targetTag}
                    onChange={(e) => setTargetTag(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="WHOLESALE">Wholesale Dealers</option>
                    <option value="PROMPT_PAYER">Prompt Payers (Loyalty Scheme)</option>
                    <option value="TALLY_LEDGER">Imported from Tally</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-200/60 text-slate-700">
                <input
                  type="checkbox"
                  checked={excludeFrozenCredit}
                  onChange={(e) => setExcludeFrozenCredit(e.target.checked)}
                />
                <span className="font-semibold text-slate-900">Exclude chronic defaulters and frozen credit accounts</span>
              </label>
            </div>

            {/* Pre-Flight Cost & Delivery Window Box */}
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2 text-indigo-900">
              <div className="font-bold text-xs flex items-center justify-between">
                <span>Pre-Flight Budget & Safety Window</span>
                <span className="text-[11px] font-mono font-bold text-indigo-700">
                  Est. Cost: ₹{Math.round((targetMode === 'ALL_CLIENTS' ? clients.length : 20) * 0.8)}
                </span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Dispatch rate: 15–20 messages/min with randomized jitter delays to protect your WhatsApp business number from Meta spam flags.
              </p>
            </div>

            {/* "Sethji Preview" Test Send */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
              <span className="font-bold text-amber-900 block">Sethji Pre-Send Test (Verify on Your Phone)</span>
              <p className="text-[11px] text-amber-800">
                Send 1 live test message to your personal WhatsApp to inspect layout and PDF download before mass broadcast.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter 10-digit mobile number"
                  value={testOwnerMobile}
                  onChange={(e) => setTestOwnerMobile(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs w-48 text-slate-800"
                />
                <button
                  type="button"
                  disabled={dispatching}
                  onClick={() => handleLaunchCampaign(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition"
                >
                  Send Test to My Phone
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={dispatching}
              onClick={() => handleLaunchCampaign(false)}
              className="px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {dispatching ? 'Launching Safe Blast...' : 'Confirm & Launch Campaign'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: INBOUND WHATSAPP INQUIRIES & LEADS                 */}
      {/* ========================================================= */}
      {activeTab === 'inquiries' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inbound Promotional Inquiries (Leads)</h3>
              <p className="text-[11px] text-slate-400">Buyers responding directly to your WhatsApp promotional campaigns</p>
            </div>
          </div>

          {inquiries.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-700">No inbound inquiries yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When buyers tap "Enquire on WhatsApp" or reply to your broadcasts, their responses appear here for fast follow-up.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3">Buyer Name</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Message Preview</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Received At</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inquiries.map((inq) => (
                    <tr key={inq.inquiryId} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{inq.clientName}</td>
                      <td className="p-3 font-mono text-slate-600">{inq.clientMobile}</td>
                      <td className="p-3 text-slate-700 font-medium">{inq.messagePreview}</td>
                      <td className="p-3">
                        <select
                          value={inq.status}
                          onChange={(e) => handleInquiryStatusChange(inq.inquiryId, e.target.value as any)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700"
                        >
                          <option value="NEW_LEAD">New Lead</option>
                          <option value="FOLLOWING_UP">Following Up</option>
                          <option value="QUOTATION_SENT">Quotation Sent</option>
                          <option value="ORDER_PLACED">Order Placed</option>
                          <option value="LOST">Lost</option>
                        </select>
                      </td>
                      <td className="p-3 text-slate-400">{new Date(inq.receivedAt).toLocaleTimeString()}</td>
                      <td className="p-3 text-right">
                        <a
                          href={`https://wa.me/${inq.clientMobile.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hover:bg-emerald-100 transition"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Chat</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD CLIENT MANUALLY                                */}
      {/* ========================================================= */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Promotional Contact</h3>
            <form onSubmit={handleAddClientSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Firm Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shree Balaji Textiles"
                  value={newClient.companyName}
                  onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Bhai"
                    value={newClient.contactPerson}
                    onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp Mobile *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210"
                    value={newClient.mobile}
                    onChange={(e) => setNewClient({ ...newClient, mobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="client@trade.in"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Cluster</label>
                  <input
                    type="text"
                    placeholder="e.g. Surat"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Tag</label>
                <select
                  value={newClient.tag}
                  onChange={(e) => setNewClient({ ...newClient, tag: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                >
                  <option value="WHOLESALE">Wholesale</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAILER">Retailer</option>
                  <option value="VIP">VIP Account</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CSV BULK IMPORT                                    */}
      {/* ========================================================= */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Bulk Import Contacts via CSV / Excel</h3>
            <p className="text-xs text-slate-500">
              Paste CSV rows below or copy-paste directly from Excel. Columns expected:
              <br />
              <code className="text-brand-700 bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">
                CompanyName, ContactPerson, Mobile, Email, City, Tag
              </code>
            </p>

            <textarea
              rows={6}
              placeholder={`Shree Balaji Textiles, Ramesh Bhai, 9876543210, ramesh@balaji.in, Surat, WHOLESALE\nRoyal Hardware, Mukesh Seth, 9825012345, mukesh@royal.com, Rajkot, VIP`}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importingCsv || !csvRawText.trim()}
                onClick={handleCsvImport}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
              >
                {importingCsv ? 'Importing...' : 'Parse & Import Contacts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
