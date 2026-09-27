import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  Building2,
  Radio,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Clock,
  Laptop,
  FileSpreadsheet,
  ArrowRight,
  Receipt,
  Activity,
  ShieldCheck,
  Rocket,
  Download,
  KeyRound,
  HelpCircle,
  Check,
  HardDrive
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { syncService } from '../../services/syncService';
import { Device, SyncJob, TallyPairingSession, DetectedTallyInstance } from '../../types';

export const SettingsPage: React.FC = () => {
  const { activeTenant, role, refreshTenantData, updateCompany } = useTenant();
  const [devices, setDevices] = useState<Device[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Company Profile State (Database-backed for further logins)
  const [companyName, setCompanyName] = useState(activeTenant?.name || '');
  const [legalName, setLegalName] = useState(activeTenant?.legalName || '');
  const [gstin, setGstin] = useState(activeTenant?.gstin || '');
  const [companyEmail, setCompanyEmail] = useState(activeTenant?.email || '');
  const [companyMobile, setCompanyMobile] = useState(activeTenant?.mobile || '');
  const [paymentTerms, setPaymentTerms] = useState(activeTenant?.settings?.defaultPaymentTermsDays || 30);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  // Zero-Tech Pairing State
  const [pairingSession, setPairingSession] = useState<TallyPairingSession | null>(null);
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [connectingInstance, setConnectingInstance] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<{ isOnline: boolean; pendingCommandsCount: number }>({
    isOnline: true,
    pendingCommandsCount: 0,
  });
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);

  // UPI settings
  const [upiVpa, setUpiVpa] = useState(activeTenant?.settings?.upiVpa || 'collectflow@hdfcbank');
  const [payeeName, setPayeeName] = useState(activeTenant?.settings?.payeeName || activeTenant?.name || '');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  // New Device Modal
  const [showPairModal, setShowPairModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newTallyHost, setNewTallyHost] = useState('localhost:9000');
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;

    const unsubDevices = dbService.subscribe<Record<string, Device>>(
      `devices/${activeTenant.tenantId}`,
      (data) => {
        setDevices(data ? Object.values(data) : []);
      }
    );

    const unsubJobs = dbService.subscribe<Record<string, SyncJob>>(
      `syncJobs/${activeTenant.tenantId}`,
      (data) => {
        if (data) {
          setSyncJobs(Object.values(data).sort((a, b) => b.startedAt - a.startedAt));
        } else {
          setSyncJobs([]);
        }
      }
    );

    // Check offline watchdog queue status
    const watchdog = syncService.getOfflineQueueStatus();
    setOfflineStatus({
      isOnline: watchdog.serviceRunning,
      pendingCommandsCount: watchdog.sqliteBufferedRecords,
    });

    return () => {
      unsubDevices();
      unsubJobs();
    };
  }, [activeTenant?.tenantId]);

  useEffect(() => {
    if (activeTenant) {
      setCompanyName(activeTenant.name);
      setLegalName(activeTenant.legalName || activeTenant.name);
      setGstin(activeTenant.gstin || '');
      setCompanyEmail(activeTenant.email);
      setCompanyMobile(activeTenant.mobile);
      if (activeTenant.settings?.defaultPaymentTermsDays) {
        setPaymentTerms(activeTenant.settings.defaultPaymentTermsDays);
      }
    }
  }, [activeTenant]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSavingCompany(true);
    try {
      if (updateCompany) {
      await updateCompany({
        name: companyName,
        legalName: legalName || companyName,
        gstin: gstin.trim().toUpperCase() || undefined,
        email: companyEmail,
        mobile: companyMobile,
        settings: {
          ...activeTenant.settings,
          defaultPaymentTermsDays: Number(paymentTerms),
        },
      });
    }
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
      await refreshTenantData();
    } catch (err) {
      console.error('Failed to update company in database:', err);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleStartZeroTechPairing = async () => {
    if (!activeTenant) return;
    setLoadingPairing(true);
    try {
      const session = await syncService.generatePairingSession(activeTenant.tenantId, activeTenant.name);
      setPairingSession(session);
      setShowPairModal(true);
    } catch (err: any) {
      alert(`Pairing initialization failed: ${err.message}`);
    } finally {
      setLoadingPairing(false);
    }
  };

  const handleConnectDetectedInstance = async (inst: DetectedTallyInstance) => {
    if (!activeTenant || !pairingSession) return;
    setConnectingInstance(true);
    try {
      await syncService.verifyPairingPin(
        activeTenant.tenantId,
        pairingSession.pairingPin,
        inst.companyName
      );
      setShowPairModal(false);
      setPairingSession(null);
      await refreshTenantData();
      alert(`Connected to ${inst.companyName} on port ${inst.port}! Tally data is now syncing.`);
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setConnectingInstance(false);
    }
  };

  const handleRunSync = async () => {
    if (!activeTenant) return;
    setSyncing(true);
    setSyncMessage(null);

    try {
      const job = await syncService.runSimulatedTallySync(activeTenant.tenantId, activeTenant.name);
      setSyncMessage(`Sync completed! ${job.recordsUpserted} records ingested from Tally.`);
      await refreshTenantData();
    } catch (err: any) {
      console.error(err);
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setSavingUpi(true);
    try {
      await dbService.update(`tenants/${activeTenant.tenantId}/settings`, {
        upiVpa,
        payeeName,
      });
      setUpiSaved(true);
      setTimeout(() => setUpiSaved(false), 3000);
      await refreshTenantData();
    } catch (err) {
      console.error('Failed to save UPI settings:', err);
    } finally {
      setSavingUpi(false);
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setPairing(true);

    try {
      await syncService.registerDevice(activeTenant.tenantId, {
        deviceName: newDeviceName,
        tallyHost: newTallyHost,
        activeCompany: activeTenant.name,
      });
      setShowPairModal(false);
      setNewDeviceName('');
    } catch (err) {
      console.error('Failed to pair device:', err);
    } finally {
      setPairing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings & Integrations</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage Tally Windows Agent connectivity, data sync frequency, and payment collections
        </p>
      </div>

      {/* Tally Windows Agent & Data Sync Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Tally Connector & Windows Agent</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <HardDrive className="w-3 h-3" /> Watchdog Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Synchronizes ledgers, open bills, and receipts between TallyPrime and CollectFlow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleStartZeroTechPairing}
              disabled={loadingPairing}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-brand-300" />
              {loadingPairing ? 'Scanning...' : 'Pair Agent (6-Digit PIN)'}
            </button>
            <button
              onClick={() => {
                setPairingSession(null);
                setShowPairModal(true);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Manual Port
            </button>
            <button
              onClick={handleRunSync}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Tally Now'}
            </button>
          </div>
        </div>

        {/* 1-Click Zero-Tech Installer Card */}
        <div className="p-4 bg-gradient-to-r from-brand-50 to-indigo-50/50 border border-brand-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-brand-950 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-brand-600" />
              CollectFlow Helper v2.0 (.exe) — Zero-Tech Desktop Installer
            </div>
            <p className="text-[11px] text-brand-800/80 mt-0.5">
              Runs as a lightweight Windows System Tray Service. Auto-scans TallyPrime ports (9000/9001) with local SQLite offline queue.
            </p>
          </div>
          <button
            onClick={() => {
              const dummyBlob = new Blob(['CollectFlow Helper Installer v2.0'], { type: 'application/octet-stream' });
              const url = URL.createObjectURL(dummyBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'CollectFlow-Helper-Setup.exe';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3.5 py-1.5 bg-white border border-brand-200 text-brand-800 font-semibold rounded-lg hover:bg-brand-50 transition shrink-0 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Download Installer (.exe)
          </button>
        </div>

        {syncMessage && (
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Registered Devices List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Connected Devices ({devices.length})
          </h4>
          {devices.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No active Tally agents registered. Click "Pair Agent" or "Sync Tally Now" to initialize.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {devices.map((d) => (
                <div key={d.deviceId} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-slate-500" />
                      {d.deviceName}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-2 text-slate-500 text-[11px] space-y-0.5">
                    <div>Host: <span className="font-mono text-slate-700">{d.tallyHost}</span></div>
                    <div>Agent Version: {d.agentVersion} ({d.osVersion})</div>
                    <div>Last Heartbeat: {new Date(d.lastHeartbeat).toLocaleTimeString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sync Jobs History */}
        {syncJobs.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Recent Sync History
            </h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white overflow-hidden text-xs">
              {syncJobs.slice(0, 4).map((job) => (
                <div key={job.syncJobId} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">
                      Batch #{job.syncJobId.substring(4, 12)} ({job.syncType})
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(job.startedAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">
                      +{job.recordsUpserted} records
                    </div>
                    <div className="text-[10px] text-slate-400">{job.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Company Profile & Business Details (Database Persistence) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Company & Business Profile</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Saved in Database
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tenant Namespace: <span className="font-mono text-slate-600">{activeTenant?.tenantId}</span> (Re-used automatically in further logins)
              </p>
            </div>
          </div>

          <Link
            to="/company-setup"
            className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            Full Setup View <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {companySaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Company profile updated successfully in database!</span>
          </div>
        )}

        <form onSubmit={handleSaveCompany} className="space-y-4 pt-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Display Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Shree Enterprises"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Legal Entity Name</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Shree Enterprises Pvt Ltd"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 27AABCS1429B1Z"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Accounts Email *</label>
              <input
                type="email"
                required
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="accounts@company.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">WhatsApp Phone *</label>
              <input
                type="tel"
                required
                value={companyMobile}
                onChange={(e) => setCompanyMobile(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 whitespace-nowrap">Default Payment Terms:</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value={15}>Net 15 Days</option>
                <option value={30}>Net 30 Days</option>
                <option value={45}>Net 45 Days</option>
                <option value={60}>Net 60 Days</option>
                <option value={90}>Net 90 Days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingCompany}
              className="px-5 py-2 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm self-end sm:self-auto"
            >
              {savingCompany ? 'Saving to Database...' : 'Save Company Details'}
            </button>
          </div>
        </form>
      </div>

      {/* UPI Payment Configuration */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">UPI Payment Gateway Configuration</h3>
            <p className="text-xs text-slate-400">
              Configure your business Virtual Payment Address (VPA) to generate instant QR codes on invoices
            </p>
          </div>
        </div>

        {upiSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>UPI settings updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveUpi} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Business UPI ID (VPA) *
            </label>
            <input
              type="text"
              required
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              placeholder="e.g. shreeenterprises@hdfcbank"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payee Display Name *
            </label>
            <input
              type="text"
              required
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder="e.g. Shree Enterprises"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingUpi}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {savingUpi ? 'Saving...' : 'Save UPI Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Cloud Integrations Hub Card */}
      <div className="bg-gradient-to-br from-slate-900 to-brand-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 text-brand-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Zoho Books, Excel & Google Sheets Hub</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Ingest invoices, sync customer directories, map custom spreadsheets, and configure real-time webhooks with our Phase 13 integration suite.
          </p>
        </div>

        <Link
          to="/integrations"
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-md flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          Open Integrations Center
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Subscription & Plan Billing Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-brand-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 text-brand-300">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Subscription, Usage Limits & GST Invoices</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Manage your Starter, Growth, or Enterprise SaaS subscription, check real-time WhatsApp usage meters, download SAC 998314 GST tax invoices, and simulate payment webhooks.
          </p>
        </div>

        <Link
          to="/billing"
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-md flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          Manage Plans & Billing
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Observability & Mission Control Card */}
      <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 text-purple-300">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Observability, Health & Operations Mission Control</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Inspect real-time Cloud Functions logs, probe Windows Agent latency & ODBC port status, review active system alerts, and trigger operational retries.
          </p>
        </div>

        <Link
          to="/observability"
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-md flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          Open Operations Center
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Security & Compliance Hardening Card */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Security, Compliance & DPDP Act 2023 Hardening</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Run automated multi-tenant isolation attack probes, rotate cryptographic API tokens, view immutable audit trails, and request DPDP data takeout archives.
          </p>
        </div>

        <Link
          to="/security"
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-md flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          Security & Compliance Hub
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Pilot Operations & Cohort Hub Card */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-brand-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 text-brand-300">
              <Rocket className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Phase 18 — Pilot Launch & Operations Hub</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Monitor real-time cohort KPIs across 38 MSMEs in Surat, Ludhiana & Peenya, control 10-account safety guardrails, and evaluate production graduation readiness.
          </p>
        </div>

        <Link
          to="/pilot"
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-md flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          Pilot Operations Hub
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Pair Agent Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {pairingSession ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <KeyRound className="w-5 h-5 text-brand-600" />
                      Zero-Tech Tally Pairing Handshake
                    </h3>
                    <p className="text-slate-400 text-[11px]">
                      Enter this 6-digit PIN in CollectFlow Helper or select a detected company below
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPairModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    ✕
                  </button>
                </div>

                {/* 6-Digit PIN Display */}
                <div className="p-4 bg-slate-900 text-white rounded-xl text-center space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Your One-Time Pairing PIN
                  </div>
                  <div className="text-3xl font-extrabold tracking-widest text-emerald-400 font-mono">
                    {pairingSession.pairingPin}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Expires in 15 minutes • No static IP or firewall opening needed
                  </div>
                </div>

                {/* QR Code */}
                {pairingSession.qrPayload && (
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairingSession.qrPayload)}`}
                      alt="Pairing QR Code"
                      className="w-28 h-28 bg-white p-1 rounded-lg border border-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 mt-1">
                      Scan with CollectFlow Mobile or Helper Agent
                    </span>
                  </div>
                )}

                {/* Detected Local Tally Instances */}
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-Detected Tally Instances ({pairingSession.detectedInstances.length})
                  </h4>
                  <div className="space-y-2">
                    {pairingSession.detectedInstances.map((inst) => (
                      <div
                        key={inst.port}
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {inst.companyName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Port {inst.port} • {inst.edition}
                          </div>
                        </div>
                        <button
                          onClick={() => handleConnectDetectedInstance(inst)}
                          disabled={connectingInstance}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {connectingInstance ? 'Connecting...' : 'Connect Company'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Troubleshooting Guidance Accordion */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTroubleshootingOpen(!troubleshootingOpen)}
                    className="w-full flex items-center justify-between text-slate-600 hover:text-slate-900 font-semibold text-xs py-1"
                  >
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-brand-600" />
                      Tally Not Connecting? View Plain-Language Guide
                    </span>
                    <span>{troubleshootingOpen ? '▲' : '▼'}</span>
                  </button>

                  {troubleshootingOpen && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-900 space-y-2 leading-relaxed">
                      <div>
                        <strong>1. Enable ODBC in Tally:</strong> In TallyPrime, press <kbd className="px-1 bg-white border rounded">F12</kbd> → <em>Data Configuration</em> → <em>ODBC Server</em> → set to <strong>Yes</strong> on Port 9000.
                      </div>
                      <div>
                        <strong>2. Ensure Company is Open:</strong> Open your company in TallyPrime before pairing.
                      </div>
                      <div>
                        <strong>3. Firewall Safe:</strong> CollectFlow Agent initiates outbound TLS over standard HTTPS port 443. No router port forwarding or public IP is ever needed.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handlePairDevice} className="space-y-3.5 text-xs">
                <h3 className="text-base font-bold text-slate-900 mb-1">Manual Tally Workstation Setup</h3>
                <p className="text-xs text-slate-500 mb-4">Register a workstation running TallyPrime by IP/Port</p>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Workstation Name *</label>
                  <input
                    type="text"
                    required
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="e.g. ACCOUNTS-PC-02"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tally ODBC/XML Port *</label>
                  <input
                    type="text"
                    required
                    value={newTallyHost}
                    onChange={(e) => setNewTallyHost(e.target.value)}
                    placeholder="localhost:9000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPairModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pairing}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition"
                  >
                    {pairing ? 'Registering...' : 'Register Device'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
