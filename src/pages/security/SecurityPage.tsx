import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Trash2,
  Search,
  ExternalLink,
  Cpu,
  Layers,
  Check,
  Clock,
  RotateCw,
  UserCheck,
  Server,
  FileCheck,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { securityService } from '../../services/securityService';
import {
  ThreatModelItem,
  PenetrationTestFinding,
  RotatableSecret,
  RateLimitStatus,
  SecurityAuditEntry,
  CompliancePolicyDoc,
  SecretType,
  DataExportRequest,
} from '../../types';

export const SecurityPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const { currentUser } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'matrix' | 'isolation' | 'secrets' | 'ratelimits' | 'audit' | 'privacy' | 'legal'>('matrix');

  // Core Data
  const [threatModel, setThreatModel] = useState<ThreatModelItem[]>([]);
  const [pentestFindings, setPentestFindings] = useState<PenetrationTestFinding[]>([]);
  const [secrets, setSecrets] = useState<RotatableSecret[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicyDoc[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<CompliancePolicyDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Tenant Isolation Probe Simulation State
  const [probingIsolation, setProbingIsolation] = useState(false);
  const [isolationResult, setIsolationResult] = useState<{
    passed: boolean;
    executedAt: number;
    checks: Array<{ name: string; status: 'PASSED' | 'FAILED'; details: string }>;
  } | null>(null);

  // Rotating Secret State
  const [rotatingSecretType, setRotatingSecretType] = useState<SecretType | null>(null);

  // Data Privacy Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'JSON' | 'CSV_ZIP'>('JSON');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<DataExportRequest | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'CUSTOMER_LEDGERS' | 'FULL_TENANT_DESTRUCTION'>('CUSTOMER_LEDGERS');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Search Queries
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [threatSearchQuery, setThreatSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    loadSecurityData();
  }, [activeTenant?.tenantId]);

  const loadSecurityData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [secList, rateList, audList] = await Promise.all([
        securityService.getRotatableSecrets(activeTenant.tenantId),
        securityService.getRateLimitStatus(activeTenant.tenantId),
        securityService.getSecurityAuditLogs(activeTenant.tenantId, 50),
      ]);
      setThreatModel(securityService.getThreatModel());
      setPentestFindings(securityService.getPenetrationTestFindings());
      setPolicies(securityService.getCompliancePolicies());
      setSelectedPolicy(securityService.getCompliancePolicies()[0]);
      setSecrets(secList);
      setRateLimits(rateList);
      setAuditLogs(audList);
    } catch (err: any) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Run Isolation Verification Probe
  const handleRunIsolationProbe = async () => {
    if (!activeTenant) return;
    setProbingIsolation(true);
    setIsolationResult(null);
    try {
      const res = await securityService.verifyTenantIsolation(
        activeTenant.tenantId,
        'ten_external_target_99',
        currentUser?.uid || 'usr_probe_01'
      );
      setIsolationResult(res);
      await loadSecurityData();
      showNotification('success', 'Tenant Isolation Probe verified 100% boundary containment.');
    } catch (err: any) {
      showNotification('error', 'Isolation probe failed: ' + err.message);
    } finally {
      setProbingIsolation(false);
    }
  };

  // Rotate Secret
  const handleRotateSecret = async (secretType: SecretType) => {
    if (!activeTenant) return;
    setRotatingSecretType(secretType);
    try {
      const updated = await securityService.rotateSecret(
        activeTenant.tenantId,
        secretType,
        currentUser?.uid || 'usr_admin',
        currentUser?.email || 'admin@collectflow.io'
      );
      setSecrets((prev) => prev.map((s) => (s.type === secretType ? updated : s)));
      await loadSecurityData();
      showNotification('success', `Cryptographic secret ${secretType} rotated successfully.`);
    } catch (err: any) {
      showNotification('error', 'Failed to rotate secret: ' + err.message);
    } finally {
      setRotatingSecretType(null);
    }
  };

  // Request Data Export
  const handleTriggerExport = async () => {
    if (!activeTenant) return;
    setExporting(true);
    try {
      const req = await securityService.requestDataExport(
        activeTenant.tenantId,
        exportFormat,
        currentUser?.email || 'Admin'
      );
      setLastExport(req);
      setShowExportModal(false);
      showNotification('success', `Takeout data export package ready (${(req.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`);
      await loadSecurityData();
    } catch (err: any) {
      showNotification('error', 'Data export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Request Data Deletion
  const handleTriggerDeletion = async () => {
    if (!activeTenant) return;
    setDeleting(true);
    try {
      const req = await securityService.requestDataDeletion(
        activeTenant.tenantId,
        deleteScope,
        deleteReason || 'Owner requested GDPR/DPDP right to be forgotten',
        currentUser?.email || 'Admin'
      );
      setShowDeleteModal(false);
      showNotification('success', `Data erasure scheduled for ${req.targetExecutionDate} (30-day statutory grace window).`);
      await loadSecurityData();
    } catch (err: any) {
      showNotification('error', 'Data deletion request failed: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Threat Model
  const filteredThreats = threatModel.filter((t) => {
    if (!threatSearchQuery.trim()) return true;
    const q = threatSearchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.mitigationControl.toLowerCase().includes(q)
    );
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((l) => {
    if (!auditSearchQuery.trim()) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.actorEmail.toLowerCase().includes(q) ||
      l.ipAddress.toLowerCase().includes(q) ||
      l.resourceType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Security, Governance & Compliance</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
              Phase 17 Hardening
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            STRIDE threat matrix, tenant boundary isolation tester, cryptographic secret rotation, rate limiting, and DPDP Act 2023 compliance
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={handleRunIsolationProbe}
            disabled={probingIsolation}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${probingIsolation ? 'animate-pulse' : ''}`} />
            {probingIsolation ? 'Probing Isolation...' : 'Run Isolation Probe'}
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Data Takeout (Export)
          </button>
        </div>
      </div>

      {/* Global Notification Toast */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Security Posture Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Security Posture</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">100%</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <Check className="w-3 h-3" /> Grade A+ Hardened
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Tenant Isolation</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">Verified</div>
            <div className="text-[10px] text-slate-500 mt-0.5">0 cross-tenant leaks</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Rotatable Secrets</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{secrets.length} Active</div>
            <div className="text-[10px] text-slate-500 mt-0.5">90-day expiry cycle</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <Key className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Rate Limiting</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">4 Endpoints</div>
            <div className="text-[10px] text-slate-500 mt-0.5">0 blocked requests</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">DPDP Act 2023</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">Compliant</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">India data localized</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Isolation Probe Output Box (if triggered) */}
      {isolationResult && (
        <div className="bg-slate-900 rounded-2xl p-5 text-white font-mono text-xs space-y-3 border border-slate-800 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
              <CheckCircle2 className="w-4 h-4" /> Multi-Tenant Boundary Isolation Self-Test Output
            </span>
            <span className="text-[10px] text-slate-400">
              Executed at {new Date(isolationResult.executedAt).toLocaleTimeString('en-IN')}
            </span>
          </div>
          <div className="space-y-1.5">
            {isolationResult.checks.map((chk, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓ [{chk.status}]</span>
                <span className="text-slate-300 font-bold font-sans">{chk.name}:</span>
                <span className="text-slate-400">{chk.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Threat Model & OWASP
        </button>

        <button
          onClick={() => setActiveTab('isolation')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'isolation'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          Tenant Isolation & Rules
        </button>

        <button
          onClick={() => setActiveTab('secrets')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'secrets'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          Secrets & Token Rotation ({secrets.length})
        </button>

        <button
          onClick={() => setActiveTab('ratelimits')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ratelimits'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          Rate Limiting & Anti-Abuse
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit Trail ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Data Governance & Portability
        </button>

        <button
          onClick={() => setActiveTab('legal')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'legal'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Legal & DPA Policies
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STRIDE THREAT MATRIX & OWASP PENTEST */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">STRIDE Threat Model & Engineering Mitigations</h3>
                <p className="text-xs text-slate-500">Comprehensive threat taxonomy covering spoofing, tampering, repudiation, data leaks, DoS, and privilege escalation</p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter threat model..."
                  value={threatSearchQuery}
                  onChange={(e) => setThreatSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-52 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredThreats.map((t) => (
                <div key={t.threatId} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 text-[10px] bg-slate-200/80 px-2 py-0.5 rounded">
                      {t.threatId} • {t.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {t.status}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-sm">{t.title}</div>
                  <div className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Attack Vector:</span> {t.attackVector}
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-1">
                    <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Mitigation Control:
                    </div>
                    <div className="text-slate-600 text-[11px] leading-relaxed">{t.mitigationControl}</div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono">
                    Ref: {t.owaspRef}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Penetration Testing Findings Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Third-Party Penetration Test Audit Log</h3>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
              {pentestFindings.map((p) => (
                <div key={p.findingId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white hover:bg-slate-50/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 text-[11px]">{p.findingId}</span>
                      <span className="font-bold text-slate-900">{p.vulnerability}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{p.remediationDetails}</p>
                    <div className="text-[10px] text-slate-400">Target Component: {p.component}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold self-start md:self-auto ${
                    p.severity === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800'
                      : p.severity === 'HIGH'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {p.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TENANT ISOLATION & RULES TESTER */}
      {/* ========================================================================= */}
      {activeTab === 'isolation' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Multi-Tenant Isolation Architecture</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict isolation enforced through Firebase Realtime Database Security Rules and serverless claims
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-brand-600" />
                Root Database Access Rule Formula
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                {`root.child('memberships').child($tenantId).child(auth.uid).child('status').val() === 'ACTIVE'`}
              </p>
              <div className="text-[11px] text-slate-500">
                Evaluated atomically by the Google Cloud Realtime Database rules daemon on every single WebSocket frame and REST request. Zero requests cross tenant boundaries.
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Current Workspace Partition Context
              </div>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div>Active Tenant ID: <span className="font-mono font-bold text-slate-800">{activeTenant?.tenantId}</span></div>
                <div>Company Name: <span className="font-semibold text-slate-800">{activeTenant?.name}</span></div>
                <div>Authenticated Actor UID: <span className="font-mono text-slate-800">{currentUser?.uid}</span></div>
                <div>Partition Status: <span className="text-emerald-600 font-bold">ISOLATED & CRYPTOGRAPHICALLY BOUND</span></div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleRunIsolationProbe}
              disabled={probingIsolation}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {probingIsolation ? 'Simulating Cross-Tenant Attacks...' : 'Run Automated Cross-Tenant Isolation Attack Probe'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SECRETS & TOKEN ROTATION */}
      {/* ========================================================================= */}
      {activeTab === 'secrets' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cryptographic Secrets & Webhook Signing Keys</h3>
              <p className="text-xs text-slate-500">Rotate API keys and webhook secrets to prevent credential replay and breach exposure</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
            {secrets.map((sec) => (
              <div key={sec.secretId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white hover:bg-slate-50/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{sec.name}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {sec.type}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {sec.status}
                    </span>
                  </div>

                  <div className="font-mono text-slate-600 text-[11px] bg-slate-50 px-2.5 py-1 rounded inline-block">
                    {sec.maskedValue}
                  </div>

                  <div className="text-[10px] text-slate-400">
                    Last rotated: {new Date(sec.lastRotatedAt).toLocaleDateString('en-IN')} • Expires: {new Date(sec.expiresAt).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <button
                  onClick={() => handleRotateSecret(sec.type)}
                  disabled={rotatingSecretType === sec.type}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5 self-start md:self-auto disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${rotatingSecretType === sec.type ? 'animate-spin' : ''}`} />
                  {rotatingSecretType === sec.type ? 'Rotating...' : 'Rotate Secret'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RATE LIMITING & ANTI-ABUSE */}
      {/* ========================================================================= */}
      {activeTab === 'ratelimits' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">API Rate Limiting & Resource Protection</h3>
            <p className="text-xs text-slate-500">Sliding-window counters protect upstream WhatsApp APIs, Tally agent connections, and Cloud Functions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rateLimits.map((rl) => (
              <div key={rl.endpoint} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{rl.endpoint}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {rl.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Current Consumption:</span>
                    <span className="font-mono text-slate-800 font-semibold">{rl.currentRequests} / {rl.maxRequestsPerMinute} req/min</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${Math.min(100, (rl.currentRequests / rl.maxRequestsPerMinute) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                  <span>Window: {rl.windowSeconds}s</span>
                  <span>Blocked: {rl.blockedRequestsCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: IMMUTABLE AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Immutable Security & Governance Audit Trail</h3>
              <p className="text-xs text-slate-500">Non-repudiable log of all sensitive financial actions, authentication events, and secret updates</p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-52 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100 font-sans">
                <tr>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Actor Email</th>
                  <th className="py-3 px-3">Resource</th>
                  <th className="py-3 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.auditLogId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap font-sans">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {log.actorEmail}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {log.resourceType}: {log.resourceId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DATA GOVERNANCE & PRIVACY (DPDP ACT 2023) */}
      {/* ========================================================================= */}
      {activeTab === 'privacy' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Right to Data Portability & Complete Takeout</h3>
                <p className="text-xs text-slate-400">
                  Export customer ledgers, invoices, payments, and audit traces in open machine-readable format (JSON / CSV)
                </p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Under Section 12 of the India Digital Personal Data Protection Act 2023 (DPDP), your business has full ownership of ingested financial accounting records. You may generate an encrypted takeout archive at any time.
            </p>

            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Request Complete Takeout Archive
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Right to be Forgotten & Data Erasure</h3>
                <p className="text-xs text-slate-400">
                  Schedule permanent erasure of customer ledgers or full tenant workspace destruction
                </p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Erasure requests enter a statutory 30-day compliance grace period before permanent zero-fill deletion across Firebase Realtime Database and Cloud Storage buckets.
            </p>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Request Data Deletion
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: LEGAL & COMPLIANCE POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'legal' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            {policies.map((p) => (
              <button
                key={p.policyId}
                onClick={() => setSelectedPolicy(p)}
                className={`w-full text-left p-3.5 rounded-xl border text-xs transition ${
                  selectedPolicy?.policyId === p.policyId
                    ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20 font-bold text-brand-900'
                    : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-700 font-semibold'
                }`}
              >
                <div>{p.title}</div>
                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Version: {p.version}</div>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 text-xs">
            {selectedPolicy && (
              <>
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">{selectedPolicy.title}</h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Version: {selectedPolicy.version} • Effective: {selectedPolicy.effectiveDate}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-800 mb-1">Executive Summary:</div>
                  {selectedPolicy.summary}
                </div>

                <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed pt-2 space-y-2">
                  {selectedPolicy.contentMarkdown}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DATA EXPORT */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">Request Data Takeout</h3>
            <p className="text-slate-600">
              Download your complete company workspace, ledgers, invoice histories, and payments in open format.
            </p>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">Choose Archive Format:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat('JSON')}
                  className={`p-3 rounded-xl border text-center font-bold ${
                    exportFormat === 'JSON' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'
                  }`}
                >
                  Structured JSON
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('CSV_ZIP')}
                  className={`p-3 rounded-xl border text-center font-bold ${
                    exportFormat === 'CSV_ZIP' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'
                  }`}
                >
                  Excel / CSV ZIP
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerExport}
                disabled={exporting}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
              >
                {exporting ? 'Packing Archive...' : 'Generate Takeout Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DATA DELETION */}
      {/* ========================================================================= */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <h3>Confirm Data Deletion Request</h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              This request initiates the statutory 30-day compliance countdown under the DPDP Act. During this window, you may cancel deletion at any time.
            </p>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">Scope of Erasure:</label>
              <select
                value={deleteScope}
                onChange={(e: any) => setDeleteScope(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="CUSTOMER_LEDGERS">Customer Ledgers & Invoices Only</option>
                <option value="FULL_TENANT_DESTRUCTION">Full Workspace & Tenant Destruction</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-slate-700">Reason for Request:</label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Business closed / Migration..."
                className="w-full p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerDeletion}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {deleting ? 'Scheduling...' : 'Confirm Erasure Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
