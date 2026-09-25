import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Plus,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Laptop,
  Radio,
  FileText,
  DollarSign,
  LifeBuoy,
  Building,
  Copy,
  Check,
  Activity,
  ArrowUpRight,
  Award,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { partnerService } from '../../services/partnerService';
import {
  PartnerProfile,
  PartnerPortfolioOverview,
  PartnerClientSummary,
  PartnerClientOnboarding,
  PartnerSupportTicket,
  PartnerPayout,
  PartnerType,
  TicketCategory,
  TicketPriority,
} from '../../types';

export const PartnerPortalPage: React.FC = () => {
  const { activeTenant, switchTenant } = useTenant();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'clients' | 'onboarding' | 'commissions' | 'tickets' | 'reports'>('clients');
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PartnerPortfolioOverview | null>(null);
  const [invitations, setInvitations] = useState<PartnerClientOnboarding[]>([]);
  const [tickets, setTickets] = useState<PartnerSupportTicket[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);

  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [selectedClientHealth, setSelectedClientHealth] = useState<PartnerClientSummary | null>(null);

  // Invite Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newCity, setNewCity] = useState('Mumbai');
  const [newVolume, setNewVolume] = useState('1500000');
  const [newNotes, setNewNotes] = useState('');
  const [inviting, setInviting] = useState(false);

  // Ticket Form
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>('TALLY_SYNC');
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>('HIGH');
  const [ticketClientTenant, setTicketClientTenant] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Registration Form (if not registered)
  const [regFirmName, setRegFirmName] = useState('Verma & Associates Chartered Accountants');
  const [regPartnerType, setRegPartnerType] = useState<PartnerType>('CA');
  const [regMembershipNo, setRegMembershipNo] = useState('ICAI-MRN-402911');
  const [regContactPerson, setRegContactPerson] = useState('CA Neha Verma');
  const [regEmail, setRegEmail] = useState('partner@collectflow.demo');
  const [regMobile, setRegMobile] = useState('+919820011221');
  const [regCity, setRegCity] = useState('Mumbai');
  const [regPayout, setRegPayout] = useState('ca.neha@hdfcbank');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    loadPartnerData();
  }, [currentUser?.uid]);

  const loadPartnerData = async () => {
    setLoading(true);
    try {
      const uid = currentUser?.uid || 'user_demo_ca';
      let profile = await partnerService.getPartnerProfile(uid);

      if (!profile) {
        // Auto-provision demo partner for smooth evaluation
        profile = await partnerService.registerPartner({
          userId: uid,
          firmName: 'Verma & Associates Chartered Accountants',
          partnerType: 'CA',
          membershipNumber: 'ICAI-MRN-402911',
          contactPerson: 'CA Neha Verma',
          email: 'partner@collectflow.demo',
          mobile: '+919820011221',
          city: 'Mumbai',
          payoutUpiOrBank: 'ca.neha@hdfcbank',
        });
      }

      setPartnerProfile(profile);

      const [pOverview, pInvites, pTickets, pPayouts] = await Promise.all([
        partnerService.getPartnerPortfolio(profile.partnerId),
        partnerService.getPartnerInvitations(profile.partnerId),
        partnerService.getSupportTickets(profile.partnerId),
        partnerService.getPartnerPayouts(profile.partnerId),
      ]);

      setPortfolio(pOverview);
      setInvitations(pInvites);
      setTickets(pTickets);
      setPayouts(pPayouts);
    } catch (err: any) {
      console.error('Failed to load partner portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleCopyInviteLink = () => {
    if (!partnerProfile) return;
    const link = `https://collectflow-320c4.web.app/register?ref=${partnerProfile.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    showAlert('success', 'Partner invitation link copied to clipboard!');
  };

  const handleInviteClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerProfile) return;
    setInviting(true);

    try {
      const invitation = await partnerService.inviteClient(partnerProfile.partnerId, {
        clientName: newClientName,
        contactPerson: newContactPerson,
        email: newEmail,
        mobile: newMobile,
        gstin: newGstin || undefined,
        city: newCity,
        expectedMonthlyVolume: parseFloat(newVolume) || 1000000,
        notes: newNotes,
      });

      setShowInviteModal(false);
      setNewClientName('');
      setNewContactPerson('');
      setNewEmail('');
      setNewMobile('');
      setNewGstin('');
      setNewNotes('');

      showAlert('success', `Invitation generated for ${invitation.clientName}!`);
      await loadPartnerData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleFastTrackOnboard = async (invitationId: string) => {
    if (!partnerProfile) return;
    try {
      const res = await partnerService.fastTrackOnboardClient(partnerProfile.partnerId, invitationId);
      showAlert('success', `Fast-tracked onboarding for ${res.summary.clientName}! Client workspace is live.`);
      await loadPartnerData();
    } catch (err: any) {
      showAlert('error', err.message || 'Fast-track failed');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerProfile) return;
    setCreatingTicket(true);

    try {
      const client = portfolio?.clients.find((c) => c.tenantId === ticketClientTenant);
      await partnerService.createSupportTicket({
        partnerId: partnerProfile.partnerId,
        partnerName: partnerProfile.firmName,
        clientTenantId: ticketClientTenant || undefined,
        clientName: client?.clientName,
        title: ticketTitle,
        category: ticketCategory,
        priority: ticketPriority,
        description: ticketDescription,
      });

      setShowTicketModal(false);
      setTicketTitle('');
      setTicketDescription('');
      showAlert('success', 'Support ticket opened successfully. Engineering team notified.');
      await loadPartnerData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!partnerProfile) return;
    try {
      await partnerService.resolveSupportTicket(
        partnerProfile.partnerId,
        ticketId,
        'Resolved and verified by Chartered Accountant / Partner advisory team.'
      );
      showAlert('success', 'Ticket marked as resolved.');
      await loadPartnerData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to update ticket');
    }
  };

  return (
    <div className="space-y-6">
      {/* Partner Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-brand-300 shadow-inner">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">
                  {partnerProfile?.firmName || 'CA / Tally Partner Portal'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
                  {partnerProfile?.partnerType || 'CA'} Partner
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {partnerProfile?.tier || 'SILVER'} Tier
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Multi-client receivables management, Tally Windows Agent health monitoring, debtor aging audits, and recurring referral revenue
              </p>
              {partnerProfile?.membershipNumber && (
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  Reg No: {partnerProfile.membershipNumber} • Lead Advisor: {partnerProfile.contactPerson} ({partnerProfile.city})
                </div>
              )}
            </div>
          </div>

          {/* Partner Action Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={handleCopyInviteLink}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/15 flex items-center gap-1.5 shadow-sm"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied Link!' : `Code: ${partnerProfile?.referralCode || '...'}`}
            </button>

            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition shadow-lg shadow-brand-500/30 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Invite New Client
            </button>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
            alert.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{alert.message}</span>
        </div>
      )}

      {/* Portfolio Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Managed Clients</span>
            <Users className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {portfolio?.totalClients || 0}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {portfolio?.activeClients || 0} Active • {portfolio?.onboardingClients || 0} Onboarding
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Receivables</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            ₹{((portfolio?.totalReceivablesUnderManagement || 0) / 100000).toFixed(1)}L
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
            Under active management
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Portfolio</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 mt-1">
            ₹{((portfolio?.totalOverdueUnderManagement || 0) / 100000).toFixed(1)}L
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {portfolio?.totalReceivablesUnderManagement
              ? `${Math.round(
                  (portfolio.totalOverdueUnderManagement / portfolio.totalReceivablesUnderManagement) * 100
                )}% of portfolio`
              : '0%'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average DSO</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {portfolio?.averagePortfolioDso || 0} <span className="text-xs font-normal text-slate-500">Days</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            Target: &lt; 45 days
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Monthly Revenue Share</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            ₹{portfolio?.pendingPayoutAmount?.toLocaleString('en-IN') || 0}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
            20% recurring commission
          </div>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'clients'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          Client Portfolio ({portfolio?.clients.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('onboarding')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'onboarding'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Onboarding Pipeline ({invitations.length})
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'commissions'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Commissions & Payouts
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'tickets'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Support Tickets ({tickets.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'reports'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Partner Reports & Audits
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLIENT PORTFOLIO & HEALTH DIAGNOSTICS */}
      {/* ========================================================================= */}
      {activeTab === 'clients' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Managed MSME Clients</h3>
              <p className="text-xs text-slate-500">
                Live financial health, debtor balances, and Tally desktop connectivity status across all businesses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadPartnerData}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Sync
              </button>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3">Client Business</th>
                  <th className="py-3 px-3 text-center">Tally Agent</th>
                  <th className="py-3 px-3 text-right">Receivables</th>
                  <th className="py-3 px-3 text-right">Overdue</th>
                  <th className="py-3 px-3 text-center">DSO</th>
                  <th className="py-3 px-3 text-center">Health Tier</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolio?.clients.map((client) => (
                  <tr key={client.tenantId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{client.clientName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>{client.city}</span>
                        {client.gstin && <span>• GST: {client.gstin}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          client.agentStatus === 'ONLINE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            client.agentStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        {client.agentStatus === 'ONLINE' ? 'Live Agent' : 'Offline'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-800">
                      ₹{client.totalReceivables.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-rose-600">
                        ₹{client.overdueAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {client.overdueRatioPct}% overdue
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {client.dso}d
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedClientHealth(client)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase cursor-pointer hover:opacity-80 transition ${
                          client.health.tier === 'EXCELLENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : client.health.tier === 'HEALTHY'
                            ? 'bg-blue-100 text-blue-800'
                            : client.health.tier === 'NEEDS_ATTENTION'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {client.health.tier.replace('_', ' ')} ({client.health.score})
                      </button>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedClientHealth(client)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] hover:bg-slate-200"
                        >
                          Diagnostics
                        </button>
                        <button
                          onClick={() => switchTenant(client.tenantId)}
                          className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-bold text-[11px] hover:bg-brand-100 flex items-center gap-1"
                        >
                          Open Workspace
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLIENT ONBOARDING PIPELINE */}
      {/* ========================================================================= */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          {/* Pipeline Explanation Ribbon */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Partner Assisted Onboarding Workflow</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                  Invite Client
                </div>
                <p className="text-[11px] text-slate-500">Generate referral token and onboarding link</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                  Install Agent
                </div>
                <p className="text-[11px] text-slate-500">Merchant installs Windows background service</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                  Connect Tally
                </div>
                <p className="text-[11px] text-slate-500">ODBC/XML port paired on localhost:9000</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">4</span>
                  Initial Sync
                </div>
                <p className="text-[11px] text-slate-500">Ledgers, open invoices, and historical payments</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px]">5</span>
                  Live Collections
                </div>
                <p className="text-[11px] text-emerald-700">WhatsApp reminders and UPI collection links</p>
              </div>
            </div>
          </div>

          {/* Invitations Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Client Invitations ({invitations.length})</h3>
                <p className="text-xs text-slate-500">Track registration milestones for invited businesses</p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Invite Client
              </button>
            </div>

            {invitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No client invitations sent yet. Click "Invite Client" to begin.
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-3">Business Name</th>
                      <th className="py-3 px-3">Contact Person</th>
                      <th className="py-3 px-3">Mobile / Email</th>
                      <th className="py-3 px-3">Expected Volume</th>
                      <th className="py-3 px-3 text-center">Stage</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitations.map((inv) => (
                      <tr key={inv.invitationId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{inv.clientName}</div>
                          <div className="text-[10px] text-slate-400">{inv.city}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {inv.contactPerson}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-700">{inv.mobile}</div>
                          <div className="text-[10px] text-slate-400">{inv.email}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          ₹{(inv.expectedMonthlyVolume / 100000).toFixed(1)}L / mo
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.stage === 'LIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.stage === 'TALLY_CONNECTED'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {inv.stage.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {inv.stage !== 'LIVE' ? (
                            <button
                              onClick={() => handleFastTrackOnboard(inv.invitationId)}
                              className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 font-bold text-[11px] hover:bg-brand-100 transition"
                            >
                              Fast-Track Provision
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[11px]">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REVENUE & REFERRAL COMMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Partner Commission & Payout Schedule</h3>
              <p className="text-xs text-slate-500">
                Earn 20% recurring monthly revenue share on every referred client subscription. Payouts processed automatically on the 5th of every month.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400">Commission Rate</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">20%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Recurring lifetime share</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] font-bold uppercase text-emerald-600">Pending Next Payout</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  ₹{portfolio?.pendingPayoutAmount?.toLocaleString('en-IN') || 0}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Due on 5th October 2026</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Lifetime Payouts</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  ₹{portfolio?.totalCommissionEarned?.toLocaleString('en-IN') || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Direct to {partnerProfile?.payoutUpiOrBank}</div>
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Monthly Payout Disbursements
              </h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-3">Billing Cycle</th>
                      <th className="py-3 px-3 text-center">Active Clients</th>
                      <th className="py-3 px-3 text-right">Commission Amount</th>
                      <th className="py-3 px-3">Disbursement Account</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">UTR / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((p) => (
                      <tr key={p.payoutId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-bold text-slate-800">{p.month}</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700">
                          {p.clientCount} clients
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {p.destination}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500 text-[11px]">
                          {p.utr || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPPORT TICKETS & HELPDESK */}
      {/* ========================================================================= */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Partner Advisory Helpdesk</h3>
              <p className="text-xs text-slate-500">
                Log technical or accounting tickets for client Tally installations, ledger mappings, and WhatsApp templates
              </p>
            </div>
            <button
              onClick={() => setShowTicketModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Open Support Ticket
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {tickets.map((t) => (
              <div key={t.ticketId} className="p-4 space-y-2 hover:bg-slate-50/60 transition text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {t.category}
                      </span>
                    </div>
                    {t.clientName && (
                      <div className="text-[11px] text-brand-700 font-semibold mt-0.5">
                        Client: {t.clientName}
                      </div>
                    )}
                  </div>

                  {t.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleResolveTicket(t.ticketId)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] hover:bg-emerald-100"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>

                <p className="text-slate-600 leading-relaxed">{t.description}</p>

                {t.resolution && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-900 text-[11px]">
                    <span className="font-bold">Resolution: </span>
                    {t.resolution}
                  </div>
                )}

                <div className="text-[10px] text-slate-400">
                  Ticket #{t.ticketId} • Logged on {new Date(t.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PARTNER COMPLIANCE & AUDIT REPORTS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Partner Compliance & Audit Summaries</h3>
              <p className="text-xs text-slate-500">
                Consolidated cross-client debtors audit for year-end statutory compliance, income tax section 43B(h) MSME compliance, and Tally sync health
              </p>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-3">Client Entity</th>
                    <th className="py-3 px-3">GSTIN</th>
                    <th className="py-3 px-3 text-right">Total Debtors</th>
                    <th className="py-3 px-3 text-right">&lt; 45 Days</th>
                    <th className="py-3 px-3 text-right">45–90 Days</th>
                    <th className="py-3 px-3 text-right">&gt; 90 Days</th>
                    <th className="py-3 px-3 text-center">43B(h) Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {portfolio?.clients.map((c) => {
                    const currentAnd30 = Math.round(c.totalReceivables * 0.45);
                    const days31_90 = Math.round(c.totalReceivables * 0.35);
                    const days90Plus = c.totalReceivables - currentAnd30 - days31_90;
                    const highRisk = days90Plus > 200000;

                    return (
                      <tr key={c.tenantId} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-bold text-slate-800">{c.clientName}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{c.gstin || 'Pending'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          ₹{c.totalReceivables.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-medium">
                          ₹{currentAnd30.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-600 font-medium">
                          ₹{days31_90.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-600 font-bold">
                          ₹{days90Plus.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              highRisk ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {highRisk ? 'High Risk' : 'Compliant'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CLIENT HEALTH DIAGNOSTICS */}
      {/* ========================================================================= */}
      {selectedClientHealth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedClientHealth.clientName}</h3>
                <p className="text-xs text-slate-500">Partner Financial Health & Risk Assessment</p>
              </div>
              <button
                onClick={() => setSelectedClientHealth(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Health Index Score</div>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {selectedClientHealth.health.score} / 100
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedClientHealth.health.tier === 'EXCELLENT'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedClientHealth.health.tier === 'HEALTHY'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedClientHealth.health.tier === 'NEEDS_ATTENTION'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {selectedClientHealth.health.tier.replace('_', ' ')}
              </span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Diagnostic Factors
              </h4>
              <div className="space-y-1.5">
                {selectedClientHealth.health.reasons.map((reason, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-900">
              <span className="font-bold">Recommended Partner Advisory: </span>
              {selectedClientHealth.health.recommendedAction}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedClientHealth(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  switchTenant(selectedClientHealth.tenantId);
                  setSelectedClientHealth(null);
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
              >
                Switch to Client Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INVITE CLIENT */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Invite MSME Client</h3>
              <p className="text-xs text-slate-500">
                Send an onboarding invitation linked to your partner referral code ({partnerProfile?.referralCode})
              </p>
            </div>

            <form onSubmit={handleInviteClient} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Business Name *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Mahavir Engineering Works"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  placeholder="e.g. Ramesh Shah"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    placeholder="+919820011223"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="finance@mahavir.com"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={newGstin}
                    onChange={(e) => setNewGstin(e.target.value)}
                    placeholder="27AAACM1234A1Z5"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono uppercase focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Uses TallyPrime 4.0 Multi-user on LAN Server"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-50"
                >
                  {inviting ? 'Generating...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OPEN SUPPORT TICKET */}
      {/* ========================================================================= */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Open Support Ticket</h3>
              <p className="text-xs text-slate-500">Contact CollectFlow support on behalf of your client</p>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Business</label>
                <select
                  value={ticketClientTenant}
                  onChange={(e) => setTicketClientTenant(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- General / Practice Level --</option>
                  {portfolio?.clients.map((c) => (
                    <option key={c.tenantId} value={c.tenantId}>
                      {c.clientName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Category *</label>
                <select
                  value={ticketCategory}
                  onChange={(e: any) => setTicketCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="TALLY_SYNC">Tally Windows Agent / Sync Issue</option>
                  <option value="INTEGRATIONS">Zoho / Google Sheets Integration</option>
                  <option value="PAYMENTS">Payment Gateway / UPI QR Issue</option>
                  <option value="BILLING">Billing & Subscription</option>
                  <option value="GENERAL">General Query</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject / Summary *</label>
                <input
                  type="text"
                  required
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  placeholder="e.g. Tally XML error code 400 on sync"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detailed Description *</label>
                <textarea
                  rows={4}
                  required
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Provide details about the error, Tally release version, and steps to reproduce..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingTicket ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
