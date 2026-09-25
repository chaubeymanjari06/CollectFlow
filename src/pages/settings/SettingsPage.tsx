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
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { syncService } from '../../services/syncService';
import { Device, SyncJob } from '../../types';

export const SettingsPage: React.FC = () => {
  const { activeTenant, role, refreshTenantData } = useTenant();
  const [devices, setDevices] = useState<Device[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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

    return () => {
      unsubDevices();
      unsubJobs();
    };
  }, [activeTenant?.tenantId]);

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
              <h3 className="text-sm font-bold text-slate-900">Tally Connector & Windows Agent</h3>
              <p className="text-xs text-slate-400">
                Synchronizes ledgers, open bills, and receipts between TallyPrime and CollectFlow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPairModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Pair Agent
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

      {/* Pair Agent Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Pair Tally Windows Agent</h3>
            <p className="text-xs text-slate-500 mb-4">Register a workstation running TallyPrime</p>

            <form onSubmit={handlePairDevice} className="space-y-3.5 text-xs">
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
          </div>
        </div>
      )}
    </div>
  );
};
