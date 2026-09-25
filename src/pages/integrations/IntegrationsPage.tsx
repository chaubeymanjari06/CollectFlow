import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link,
  Unlink,
  Upload,
  ArrowRight,
  Database,
  Cloud,
  FileText,
  AlertTriangle,
  Download,
  Calendar,
  Check,
  Send,
  Eye,
  Sliders,
  History,
  Building,
  Key,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { integrationService } from '../../services/integrationService';
import {
  ZohoIntegrationConfig,
  GoogleSheetsConfig,
  ExcelCsvColumnMapping,
  CsvValidationRow,
  IngestionReport,
  ZohoWebhookPayload,
} from '../../types';

export const IntegrationsPage: React.FC = () => {
  const { activeTenant, refreshTenantData } = useTenant();
  const [activeTab, setActiveTab] = useState<'zoho' | 'csv' | 'sheets' | 'history'>('zoho');

  // Loading & Alert state
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Zoho state
  const [zohoConfig, setZohoConfig] = useState<ZohoIntegrationConfig | null>(null);
  const [showZohoConnectModal, setShowZohoConnectModal] = useState(false);
  const [zohoOrgId, setZohoOrgId] = useState('');
  const [zohoOrgName, setZohoOrgName] = useState('');
  const [zohoClientId, setZohoClientId] = useState('');
  const [zohoClientSecret, setZohoClientSecret] = useState('');
  const [syncingZoho, setSyncingZoho] = useState(false);

  // Webhook Simulator state
  const [webhookEvent, setWebhookEvent] = useState<'invoice.created' | 'payment.created' | 'customer.created'>('invoice.created');
  const [webhookSimulating, setWebhookSimulating] = useState(false);

  // CSV Wizard state
  const [csvStep, setCsvStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawCsvText, setRawCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvParsedRows, setCsvParsedRows] = useState<Record<string, string>[]>([]);
  const [csvMapping, setCsvMapping] = useState<ExcelCsvColumnMapping>({
    customerName: '',
    mobile: '',
    email: '',
    gstin: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    amount: '',
    paidAmount: '',
    currency: '',
  });
  const [csvValidationResults, setCsvValidationResults] = useState<{
    rows: CsvValidationRow[];
    validCount: number;
    invalidCount: number;
    uniqueCustomersCount: number;
    totalAmount: number;
  } | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [lastCsvReport, setLastCsvReport] = useState<IngestionReport | null>(null);

  // Google Sheets state
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [sheetNameInput, setSheetNameInput] = useState('Sheet1');
  const [sheetSyncInterval, setSheetSyncInterval] = useState<'NONE' | 'HOURLY' | 'DAILY' | 'WEEKLY'>('DAILY');
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);

  // History state
  const [historyReports, setHistoryReports] = useState<IngestionReport[]>([]);
  const [selectedErrorReport, setSelectedErrorReport] = useState<IngestionReport | null>(null);

  // Load configs on mount or tenant change
  useEffect(() => {
    if (!activeTenant) return;
    loadConfigs();
  }, [activeTenant?.tenantId]);

  const loadConfigs = async () => {
    if (!activeTenant) return;
    try {
      const zConfig = await integrationService.getZohoConfig(activeTenant.tenantId);
      setZohoConfig(zConfig);
      setZohoOrgId(zConfig.organizationId || '');
      setZohoOrgName(zConfig.organizationName || '');
      setZohoClientId(zConfig.clientId || '');

      const sConfig = await integrationService.getGoogleSheetsConfig(activeTenant.tenantId);
      setSheetsConfig(sConfig);
      setSheetUrlInput(sConfig.spreadsheetUrl || sConfig.spreadsheetId || '');
      setSheetNameInput(sConfig.sheetName || 'Sheet1');
      setSheetSyncInterval(sConfig.autoSyncInterval || 'DAILY');

      const history = await integrationService.getIngestionHistory(activeTenant.tenantId);
      setHistoryReports(history);
    } catch (err: any) {
      console.error('Failed to load configs:', err);
    }
  };

  const showAlertMsg = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // ==========================================
  // ZOHO BOOKS HANDLERS
  // ==========================================
  const handleConnectZoho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setLoading(true);
    try {
      const updated = await integrationService.connectZoho(activeTenant.tenantId, {
        organizationId: zohoOrgId,
        organizationName: zohoOrgName,
        clientId: zohoClientId,
        clientSecret: zohoClientSecret,
      });
      setZohoConfig(updated);
      setShowZohoConnectModal(false);
      showAlertMsg('success', 'Successfully connected to Zoho Books via OAuth 2.0!');
      await loadConfigs();
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Failed to connect to Zoho Books');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectZoho = async () => {
    if (!activeTenant) return;
    if (!confirm('Are you sure you want to disconnect Zoho Books?')) return;
    try {
      const updated = await integrationService.disconnectZoho(activeTenant.tenantId);
      setZohoConfig(updated);
      showAlertMsg('success', 'Zoho Books has been disconnected.');
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Failed to disconnect');
    }
  };

  const handleSyncZoho = async (mode: 'customers' | 'invoices' | 'payments' | 'all') => {
    if (!activeTenant) return;
    setSyncingZoho(true);
    try {
      if (mode === 'customers') {
        const count = await integrationService.syncZohoCustomers(activeTenant.tenantId);
        showAlertMsg('success', `Synced ${count} customers from Zoho Books.`);
      } else if (mode === 'invoices') {
        const count = await integrationService.syncZohoInvoices(activeTenant.tenantId);
        showAlertMsg('success', `Synced ${count} invoices from Zoho Books.`);
      } else if (mode === 'payments') {
        const count = await integrationService.syncZohoPayments(activeTenant.tenantId);
        showAlertMsg('success', `Synced ${count} payment receipts from Zoho Books.`);
      } else {
        const report = await integrationService.syncAllZoho(activeTenant.tenantId);
        showAlertMsg(
          'success',
          `Full Zoho Sync complete! ${report.customersUpserted} customers, ${report.invoicesUpserted} invoices, ${report.paymentsUpserted} payments.`
        );
      }
      await refreshTenantData();
      await loadConfigs();
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Zoho sync failed');
    } finally {
      setSyncingZoho(false);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!activeTenant) return;
    setWebhookSimulating(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let mockData: any;

      if (webhookEvent === 'invoice.created') {
        mockData = {
          invoice_id: `zi_sim_${Date.now().toString(36)}`,
          customer_id: 'zc_501',
          customer_name: 'Godrej Properties Projects Div',
          invoice_number: `ZH-SIM-${Math.floor(1000 + Math.random() * 9000)}`,
          date: todayStr,
          due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          total: 285000,
          balance: 285000,
          currency_code: 'INR',
          status: 'open',
        };
      } else if (webhookEvent === 'payment.created') {
        mockData = {
          payment_id: `zpay_sim_${Date.now().toString(36)}`,
          customer_id: 'zc_502',
          customer_name: 'Tata Steel Tubes Division',
          payment_number: `ZH-PAY-SIM-${Math.floor(100 + Math.random() * 900)}`,
          invoice_numbers: ['ZH-INV-2026-082'],
          amount: 50000,
          date: todayStr,
          reference_number: `HDFC-SIM-${Date.now().toString(36).toUpperCase()}`,
        };
      } else {
        mockData = {
          contact_id: `zc_sim_${Date.now().toString(36)}`,
          contact_name: 'UltraTech Cement Western Infra',
          company_name: 'UltraTech Cement Ltd',
          contact_person: 'Rajiv Mathur',
          mobile: '+919820556677',
          email: 'accounts@ultratech.com',
          gst_no: '27AAACU1234A1Z7',
          credit_limit: 2000000,
          payment_terms: 30,
        };
      }

      const payload: ZohoWebhookPayload = {
        event: webhookEvent,
        timestamp: Date.now(),
        organization_id: zohoConfig?.organizationId || '60012345678',
        signature: 'simulated_valid_hmac_sha256_hash',
        data: mockData,
      };

      const res = await integrationService.handleZohoWebhook(activeTenant.tenantId, payload);
      showAlertMsg('success', `Webhook processed: ${res.action}`);
      await refreshTenantData();
      await loadConfigs();
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Webhook processing failed');
    } finally {
      setWebhookSimulating(false);
    }
  };

  // ==========================================
  // EXCEL / CSV WIZARD HANDLERS
  // ==========================================
  const sampleCsvData = `Customer Name,Mobile Number,Email,GSTIN,Invoice Number,Invoice Date,Due Date,Total Amount,Paid Amount,Currency
Ashok Leyland Spare Logistics,+919820123456,billing@ashokleyland.com,27AAACA1234A1Z5,INV-AL-2026-001,2026-08-10,2026-09-10,350000,50000,INR
Kirloskar Pneumatic Industrial,+919830987654,accounts@kirloskar.com,27AAACK5678B1Z2,INV-KP-2026-002,2026-07-15,2026-08-15,480000,0,INR
Thermax Energy Solutions Ltd,+919840567890,finance@thermax.com,27AAACT9012C1Z9,INV-TX-2026-003,2026-09-01,2026-10-01,220000,0,INR
Praj Industries Process Div,+919811234567,purchase@praj.net,27AAACP3456D1Z1,INV-PJ-2026-004,2026-08-25,2026-09-25,190000,90000,INR
Cummins Generator Technologies,+919880112233,cummins.pay@cummins.com,27AAACC7890E1Z3,INV-CG-2026-005,2026-06-20,2026-07-20,620000,120000,INR`;

  const handleLoadSampleCsv = () => {
    setRawCsvText(sampleCsvData);
    processCsvText(sampleCsvData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvText(content);
      processCsvText(content);
    };
    reader.readAsText(file);
  };

  const processCsvText = (text: string) => {
    const { headers, rows } = integrationService.parseCsvContent(text);
    if (headers.length === 0 || rows.length === 0) {
      showAlertMsg('error', 'Could not parse headers or rows from the provided data.');
      return;
    }
    setCsvHeaders(headers);
    setCsvParsedRows(rows);

    const detected = integrationService.autoDetectColumnMapping(headers);
    setCsvMapping(detected);
    setCsvStep(2);
  };

  const handleProceedToValidation = () => {
    if (!csvMapping.customerName || !csvMapping.mobile || !csvMapping.invoiceNumber || !csvMapping.amount || !csvMapping.dueDate) {
      showAlertMsg('error', 'Please map all required fields: Customer Name, Mobile, Invoice Number, Due Date, and Total Amount.');
      return;
    }

    const validation = integrationService.validateCsvRows(csvParsedRows, csvMapping);
    setCsvValidationResults(validation);
    setCsvStep(3);
  };

  const handleExecuteCsvIngestion = async () => {
    if (!activeTenant || !csvValidationResults) return;
    setImportingCsv(true);
    try {
      const report = await integrationService.ingestCsvBatch(
        activeTenant.tenantId,
        csvValidationResults.rows
      );
      setLastCsvReport(report);
      setCsvStep(4);
      showAlertMsg(
        'success',
        `Batch Ingestion Successful! Imported ${report.customersUpserted} customers and ${report.invoicesUpserted} invoices.`
      );
      await refreshTenantData();
      await loadConfigs();
    } catch (err: any) {
      showAlertMsg('error', err.message || 'CSV Ingestion failed');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const templateContent =
      'Customer Name,Mobile Number,Email,GSTIN,Invoice Number,Invoice Date,Due Date,Total Amount,Paid Amount,Currency\n' +
      'Sample Enterprise Pvt Ltd,+919876543210,billing@sample.com,27AAACS1234A1Z5,INV-2026-0001,2026-09-01,2026-10-01,150000,0,INR\n';
    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collectflow_receivables_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadErrorReport = () => {
    if (!csvValidationResults) return;
    const invalidRows = csvValidationResults.rows.filter((r) => !r.isValid);
    if (invalidRows.length === 0) return;

    let csvContent = 'Row Number,Errors,Raw Data\n';
    invalidRows.forEach((r) => {
      const errorsStr = `"${r.errors.join('; ')}"`;
      const rawStr = `"${Object.entries(r.raw)
        .map(([k, v]) => `${k}:${v}`)
        .join(' | ')}"`;
      csvContent += `${r.rowIndex},${errorsStr},${rawStr}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csv_ingestion_error_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ==========================================
  // GOOGLE SHEETS HANDLERS
  // ==========================================
  const handleTestGoogleSheets = async () => {
    if (!sheetUrlInput.trim()) {
      showAlertMsg('error', 'Please enter a Google Spreadsheet URL or ID');
      return;
    }

    setFetchingSheets(true);
    try {
      const spreadsheetId = integrationService.extractSpreadsheetId(sheetUrlInput);
      const data = await integrationService.fetchGoogleSheetRows(spreadsheetId, sheetNameInput);
      setSheetHeaders(data.headers);

      if (activeTenant) {
        await integrationService.saveGoogleSheetsConfig(activeTenant.tenantId, {
          spreadsheetId,
          spreadsheetUrl: sheetUrlInput,
          sheetName: sheetNameInput,
          autoSyncInterval: sheetSyncInterval,
          status: 'CONNECTED',
        });
        await loadConfigs();
      }

      showAlertMsg('success', `Connected to Google Sheet! Found ${data.headers.length} columns and ${data.rows.length} rows.`);
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Failed to connect to Google Sheet');
    } finally {
      setFetchingSheets(false);
    }
  };

  const handleSyncGoogleSheets = async () => {
    if (!activeTenant) return;
    setSyncingSheets(true);
    try {
      const report = await integrationService.syncGoogleSheets(activeTenant.tenantId);
      showAlertMsg(
        'success',
        `Google Sheets Sync completed! Imported ${report.customersUpserted} customers and ${report.invoicesUpserted} invoices.`
      );
      await refreshTenantData();
      await loadConfigs();
    } catch (err: any) {
      showAlertMsg('error', err.message || 'Google Sheets sync failed');
    } finally {
      setSyncingSheets(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Integrations & Data Sources</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
              Phase 13
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingest customer accounts, open invoices, and payment receipts from Zoho Books, Excel/CSV spreadsheets, and Google Sheets
          </p>
        </div>

        {/* Global Stats Badges */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Zoho:</span>
            <span className="font-bold text-slate-800">
              {zohoConfig?.status === 'CONNECTED' ? 'Active' : 'Offline'}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-600 font-medium">Sheets:</span>
            <span className="font-bold text-slate-800">
              {sheetsConfig?.status === 'CONNECTED' ? 'Active' : 'Offline'}
            </span>
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

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('zoho')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'zoho'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          Zoho Books
        </button>

        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'csv'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Excel / CSV Ingestion
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'sheets'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Cloud className="w-4 h-4" />
          Google Sheets
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          Ingestion History ({historyReports.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ZOHO BOOKS INTEGRATION */}
      {/* ========================================================================= */}
      {activeTab === 'zoho' && (
        <div className="space-y-6">
          {/* Zoho Status & Connection Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg border border-orange-100 shadow-inner">
                  ZB
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Zoho Books Cloud Integration</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        zohoConfig?.status === 'CONNECTED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {zohoConfig?.status || 'DISCONNECTED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synchronize contacts, sales invoices, aging statuses, and payment receipts from Zoho Books via OAuth 2.0 REST APIs
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {zohoConfig?.status === 'CONNECTED' ? (
                  <>
                    <button
                      onClick={handleDisconnectZoho}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                    <button
                      onClick={() => handleSyncZoho('all')}
                      disabled={syncingZoho}
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingZoho ? 'animate-spin' : ''}`} />
                      {syncingZoho ? 'Syncing...' : 'Sync All Zoho Data'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowZohoConnectModal(true)}
                    className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 shadow-md shadow-orange-600/20 transition flex items-center gap-1.5"
                  >
                    <Link className="w-3.5 h-3.5" />
                    Connect Zoho Books
                  </button>
                )}
              </div>
            </div>

            {/* Connection Details Metadata */}
            {zohoConfig?.status === 'CONNECTED' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Organization ID</div>
                  <div className="font-mono font-semibold text-slate-800 mt-1">
                    {zohoConfig.organizationId}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Organization Name</div>
                  <div className="font-semibold text-slate-800 mt-1 truncate">
                    {zohoConfig.organizationName || 'Zoho Main Org'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">OAuth Access Token</div>
                  <div className="font-mono text-emerald-700 font-semibold mt-1 truncate">
                    Active (Refreshes automatically)
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Last Synced At</div>
                  <div className="font-semibold text-slate-800 mt-1">
                    {zohoConfig.lastSyncedAt
                      ? new Date(zohoConfig.lastSyncedAt).toLocaleTimeString('en-IN')
                      : 'Never'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Zoho Books is not connected
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Connecting your Zoho Books account enables bidirectional synchronization: import overdue sales invoices, synchronize customer ledgers, and trigger automated WhatsApp payment follow-ups when bills mature.
                </p>
              </div>
            )}

            {/* Granular Sync Actions */}
            {zohoConfig?.status === 'CONNECTED' && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Granular Ingestion Endpoints
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Customers & Contacts</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Import Zoho customer accounts</div>
                    </div>
                    <button
                      onClick={() => handleSyncZoho('customers')}
                      disabled={syncingZoho}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      Sync Customers
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Sales Invoices</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Import open & overdue bills</div>
                    </div>
                    <button
                      onClick={() => handleSyncZoho('invoices')}
                      disabled={syncingZoho}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      Sync Invoices
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Payment Receipts</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Sync recorded payments</div>
                    </div>
                    <button
                      onClick={() => handleSyncZoho('payments')}
                      disabled={syncingZoho}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      Sync Payments
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zoho Inbound Webhook Simulator */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Zoho Webhook Integration & Testing</h3>
                  <p className="text-xs text-slate-400">
                    Real-time webhook listener endpoint for automatic reconciliation upon invoice or payment creation in Zoho
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">
                /api/v1/webhooks/zoho
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Simulate Event:</label>
                  <select
                    value={webhookEvent}
                    onChange={(e: any) => setWebhookEvent(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="invoice.created">invoice.created (New Sales Invoice)</option>
                    <option value="payment.created">payment.created (Customer Payment Recorded)</option>
                    <option value="customer.created">customer.created (New Contact)</option>
                  </select>
                </div>

                <button
                  onClick={handleSimulateWebhook}
                  disabled={webhookSimulating}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {webhookSimulating ? 'Processing Webhook...' : 'Dispatch Test Webhook'}
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                Incoming payloads are verified using HMAC-SHA256 signatures, validated against tenant isolation rules, and ingested idempotently into Firebase Realtime Database.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXCEL / CSV INGESTION WIZARD */}
      {/* ========================================================================= */}
      {activeTab === 'csv' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          {/* Step Progress Indicator */}
          <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-4 text-xs font-semibold">
            <div
              className={`flex items-center gap-2 pb-1 ${
                csvStep === 1 ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Upload & Parse</span>
            </div>

            <div
              className={`flex items-center gap-2 pb-1 ${
                csvStep === 2 ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Map Columns</span>
            </div>

            <div
              className={`flex items-center gap-2 pb-1 ${
                csvStep === 3 ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Validate & Preview</span>
            </div>

            <div
              className={`flex items-center gap-2 pb-1 ${
                csvStep === 4 ? 'text-brand-600 border-b-2 border-brand-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px]">
                4
              </span>
              <span>Import & Report</span>
            </div>
          </div>

          {/* STEP 1: UPLOAD / PASTE */}
          {csvStep === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Receivables Spreadsheet</h3>
                  <p className="text-xs text-slate-500">
                    Upload a CSV/TSV file or paste tabular data directly from Microsoft Excel or Tally export
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Template
                  </button>
                  <button
                    onClick={handleLoadSampleCsv}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-50 text-brand-700 text-xs font-bold hover:bg-brand-100 transition border border-brand-200"
                  >
                    Load Sample MSME Dataset
                  </button>
                </div>
              </div>

              {/* Drag & Drop File Upload */}
              <div className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-2xl p-6 text-center transition bg-slate-50/50">
                <input
                  type="file"
                  id="csvFileInput"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="csvFileInput" className="cursor-pointer space-y-2 block">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 mx-auto flex items-center justify-center shadow-sm">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Click to browse or drag and drop your CSV / TSV file
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Supports Comma-separated (CSV), Semicolon-delimited, and Tab-separated (TSV) values
                  </div>
                </label>
              </div>

              {/* Paste Text Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Or paste raw CSV text:
                </label>
                <textarea
                  rows={6}
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  placeholder="Customer Name,Mobile Number,Email,GSTIN,Invoice Number,Invoice Date,Due Date,Total Amount,Paid Amount,Currency..."
                  className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => processCsvText(rawCsvText)}
                  disabled={!rawCsvText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  Parse & Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {csvStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Map Spreadsheet Columns to Schema</h3>
                  <p className="text-xs text-slate-500">
                    Verify matched headers or reassign column targets to ensure exact data ingestion
                  </p>
                </div>
                <button
                  onClick={() => setCsvStep(1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Back to Upload
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Customer Name */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Customer / Party Name *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.customerName}
                    onChange={(e) => setCsvMapping({ ...csvMapping, customerName: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile Number */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Mobile Number (WhatsApp) *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.mobile}
                    onChange={(e) => setCsvMapping({ ...csvMapping, mobile: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Number */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Invoice / Bill Number *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.invoiceNumber}
                    onChange={(e) => setCsvMapping({ ...csvMapping, invoiceNumber: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Total Amount */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Total Bill Amount *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.amount}
                    onChange={(e) => setCsvMapping({ ...csvMapping, amount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Due Date *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.dueDate}
                    onChange={(e) => setCsvMapping({ ...csvMapping, dueDate: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Date */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Invoice Date *</label>
                    <span className="text-[10px] text-brand-600 font-bold">Required</span>
                  </div>
                  <select
                    value={csvMapping.invoiceDate}
                    onChange={(e) => setCsvMapping({ ...csvMapping, invoiceDate: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paid Amount */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Paid / Received Amount</label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <select
                    value={csvMapping.paidAmount}
                    onChange={(e) => setCsvMapping({ ...csvMapping, paidAmount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- None / Default 0 --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GSTIN */}
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">GSTIN / Tax ID</label>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </div>
                  <select
                    value={csvMapping.gstin}
                    onChange={(e) => setCsvMapping({ ...csvMapping, gstin: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleProceedToValidation}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-1.5"
                >
                  Validate & Preview Data
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & LIVE VALIDATION */}
          {csvStep === 3 && csvValidationResults && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Validation Results & Table Preview</h3>
                  <p className="text-xs text-slate-500">
                    Review parsed invoices and ensure all formatting requirements are met
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCsvStep(2)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Modify Mapping
                  </button>
                  {csvValidationResults.invalidCount > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Error Report ({csvValidationResults.invalidCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Rows</div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">
                    {csvValidationResults.rows.length}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-[10px] uppercase font-bold text-emerald-600">Valid Rows</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {csvValidationResults.validCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="text-[10px] uppercase font-bold text-rose-600">Invalid Rows</div>
                  <div className="text-base font-bold text-rose-700 mt-0.5">
                    {csvValidationResults.invalidCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-50 border border-brand-100">
                  <div className="text-[10px] uppercase font-bold text-brand-600">Total Value</div>
                  <div className="text-base font-bold text-brand-800 mt-0.5">
                    ₹{csvValidationResults.totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Interactive Validation Table */}
              <div className="border border-slate-100 rounded-xl overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Mobile</th>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 px-3">Validation Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvValidationResults.rows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/70'}
                      >
                        <td className="py-2.5 px-3">
                          {row.isValid ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">
                              ✕
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {row.parsedRecord?.customerName || row.raw[csvMapping.customerName] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {row.parsedRecord?.mobile || row.raw[csvMapping.mobile] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          {row.parsedRecord?.invoiceNumber || row.raw[csvMapping.invoiceNumber] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.parsedRecord?.dueDate || row.raw[csvMapping.dueDate] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {row.parsedRecord
                            ? `₹${row.parsedRecord.amount.toLocaleString('en-IN')}`
                            : row.raw[csvMapping.amount] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {row.parsedRecord
                            ? `₹${row.parsedRecord.balance.toLocaleString('en-IN')}`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.isValid ? (
                            <span className="text-emerald-700 font-medium text-[11px]">Valid</span>
                          ) : (
                            <div className="text-rose-600 text-[11px] font-semibold">
                              {row.errors.join('; ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteCsvIngestion}
                  disabled={importingCsv || csvValidationResults.validCount === 0}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  {importingCsv
                    ? 'Ingesting Records...'
                    : `Ingest ${csvValidationResults.validCount} Valid Records`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: INGESTION COMPLETE & REPORT */}
          {csvStep === 4 && lastCsvReport && (
            <div className="space-y-5 text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Batch Ingestion Completed Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Customer profiles and invoices have been upserted into CollectFlow and recalculations executed
                </p>
              </div>

              <div className="max-w-md mx-auto grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Customers</div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">
                    +{lastCsvReport.customersUpserted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-[10px] uppercase font-bold text-emerald-600">Invoices</div>
                  <div className="text-base font-bold text-emerald-800 mt-0.5">
                    +{lastCsvReport.invoicesUpserted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Time</div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">
                    {lastCsvReport.completedAt - lastCsvReport.startedAt}ms
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  onClick={() => {
                    setCsvStep(1);
                    setRawCsvText('');
                    setCsvValidationResults(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Upload Another Spreadsheet
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-md shadow-brand-600/20"
                >
                  View Ingestion History
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GOOGLE SHEETS INTEGRATION */}
      {/* ========================================================================= */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100 shadow-inner">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Google Sheets Direct Synchronization</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sheetsConfig?.status === 'CONNECTED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {sheetsConfig?.status || 'DISCONNECTED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect online Google Spreadsheets to ingest receivables and schedule background polling
                  </p>
                </div>
              </div>

              {sheetsConfig?.status === 'CONNECTED' && (
                <button
                  onClick={handleSyncGoogleSheets}
                  disabled={syncingSheets}
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
                  {syncingSheets ? 'Syncing...' : 'Sync Sheet Now'}
                </button>
              )}
            </div>

            {/* Connection Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Google Spreadsheet URL or ID *
                </label>
                <input
                  type="text"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sheet / Tab Name</label>
                <input
                  type="text"
                  value={sheetNameInput}
                  onChange={(e) => setSheetNameInput(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Automated Polling Schedule
                </label>
                <select
                  value={sheetSyncInterval}
                  onChange={(e: any) => setSheetSyncInterval(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="NONE">Manual Sync Only</option>
                  <option value="HOURLY">Hourly Sync (Every 60 min)</option>
                  <option value="DAILY">Daily Sync (Every 24 hours)</option>
                  <option value="WEEKLY">Weekly Sync (Every 7 days)</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  onClick={handleTestGoogleSheets}
                  disabled={fetchingSheets || !sheetUrlInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Link className="w-3.5 h-3.5" />
                  {fetchingSheets ? 'Connecting...' : 'Connect & Discover Headers'}
                </button>
              </div>
            </div>

            {/* Discovered Headers & Status */}
            {sheetHeaders.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Discovered Sheet Headers ({sheetHeaders.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sheetHeaders.map((header) => (
                    <span
                      key={header}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px] font-medium"
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INGESTION HISTORY & AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ingestion History & Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Log of all automated and manual synchronization batches across Zoho, Excel, and Google Sheets
              </p>
            </div>
            <button
              onClick={loadConfigs}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {historyReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No ingestion batches recorded yet. Run a Zoho sync or upload a CSV spreadsheet to start.
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-3">Batch / Source</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3 text-center">Processed</th>
                    <th className="py-3 px-3 text-center">Customers</th>
                    <th className="py-3 px-3 text-center">Invoices</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyReports.map((report) => (
                    <tr key={report.jobId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{report.sourceTitle}</div>
                        <div className="text-[10px] font-mono text-slate-400">{report.jobId}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {new Date(report.startedAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">
                        {report.totalProcessed}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        +{report.customersUpserted}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        +{report.invoicesUpserted}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            report.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : report.status === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {report.errors && report.errors.length > 0 && (
                          <button
                            onClick={() => setSelectedErrorReport(report)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px] hover:bg-rose-100"
                          >
                            View Errors ({report.errors.length})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ZOHO OAUTH CONNECT */}
      {/* ========================================================================= */}
      {showZohoConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                ZB
              </div>
              <h3 className="text-base font-bold text-slate-900">Connect Zoho Books</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Enter your Zoho Books API credentials to establish secure OAuth 2.0 connectivity
            </p>

            <form onSubmit={handleConnectZoho} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Zoho Organization ID *
                </label>
                <input
                  type="text"
                  required
                  value={zohoOrgId}
                  onChange={(e) => setZohoOrgId(e.target.value)}
                  placeholder="e.g. 60012345678"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Organization Display Name
                </label>
                <input
                  type="text"
                  value={zohoOrgName}
                  onChange={(e) => setZohoOrgName(e.target.value)}
                  placeholder="e.g. Apex Steel Zoho Books"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Client ID (Zoho Developer Console) *
                </label>
                <input
                  type="text"
                  required
                  value={zohoClientId}
                  onChange={(e) => setZohoClientId(e.target.value)}
                  placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Client Secret *
                </label>
                <input
                  type="password"
                  required
                  value={zohoClientSecret}
                  onChange={(e) => setZohoClientSecret(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowZohoConnectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition"
                >
                  {loading ? 'Authorizing...' : 'Authorize OAuth 2.0'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ERROR REPORT DETAILS */}
      {/* ========================================================================= */}
      {selectedErrorReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ingestion Errors Report</h3>
                <p className="text-xs text-slate-400">Batch ID: {selectedErrorReport.jobId}</p>
              </div>
              <button
                onClick={() => setSelectedErrorReport(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {selectedErrorReport.errors.map((err, idx) => (
                <div key={idx} className="p-3 text-xs">
                  {err.row && <span className="font-bold text-slate-700 mr-2">Row #{err.row}:</span>}
                  <span className="text-rose-600">{err.message}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedErrorReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
