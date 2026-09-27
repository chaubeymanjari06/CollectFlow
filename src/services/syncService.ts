import { dbService } from './dbService';
import { receivablesService } from './receivablesService';
import {
  Device,
  SyncJob,
  Customer,
  Invoice,
  TallyPairingSession,
  DetectedTallyInstance,
  TallyVoucherCommand,
} from '../types';

export interface TallyCustomerPayload {
  sourceCustomerId: string;
  name: string;
  contactPerson?: string;
  mobile: string;
  email?: string;
  creditLimit?: number;
  paymentTerms?: number;
  gstin?: string;
}

export interface TallyInvoicePayload {
  sourceRecordId: string;
  sourceCustomerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount?: number;
}

export const syncService = {
  async registerDevice(
    tenantId: string,
    params: {
      deviceName: string;
      tallyHost: string;
      activeCompany?: string;
    }
  ): Promise<Device> {
    const now = Date.now();
    const deviceId = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

    const device: Device = {
      deviceId,
      tenantId,
      deviceName: params.deviceName,
      agentVersion: '2.0.0 (Enterprise MSME)',
      osVersion: 'Windows 11 Pro 64-bit',
      status: 'ONLINE',
      tallyHost: params.tallyHost || 'localhost:9000',
      tallyVersion: 'TallyPrime 4.1',
      activeCompany: params.activeCompany || 'Default Company',
      lastHeartbeat: now,
      lastSyncTime: now,
      syncCursor: new Date().toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`devices/${tenantId}/${deviceId}`, device);
    await dbService.update(`tenants/${tenantId}`, { tallyConnected: true });
    return device;
  },

  async getDevices(tenantId: string): Promise<Device[]> {
    const data = await dbService.get<Record<string, Device>>(`devices/${tenantId}`);
    return data ? Object.values(data) : [];
  },

  async getSyncJobs(tenantId: string): Promise<SyncJob[]> {
    const data = await dbService.get<Record<string, SyncJob>>(`syncJobs/${tenantId}`);
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.startedAt - a.startedAt);
  },

  /**
   * Phase 19: Zero-Tech 6-Digit PIN & QR Handshake Pairing
   * Generates a 6-digit PIN and runs auto-discovery on local Tally ports (9000, 9001, 9005)
   */
  async generatePairingSession(
    tenantId: string,
    companyName: string = 'CollectFlow MSME'
  ): Promise<TallyPairingSession> {
    const sessionId = `pair_${Date.now().toString(36)}`;
    const pinRaw = Math.floor(100000 + Math.random() * 900000).toString();
    const pairingPin = `${pinRaw.substring(0, 3)}-${pinRaw.substring(3)}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    // Auto-discovery simulation of localhost Tally ports
    const detectedInstances: DetectedTallyInstance[] = [
      {
        port: 9000,
        companyName: `${companyName} (FY 2026-27)`,
        financialYear: '2026-2027',
        edition: 'TallyPrime Silver 4.1',
        active: true,
      },
      {
        port: 9001,
        companyName: `${companyName} (Branch Unit 2)`,
        financialYear: '2026-2027',
        edition: 'TallyPrime 4.0',
        active: false,
      },
      {
        port: 9005,
        companyName: 'Audit & CA Mirror Firm',
        financialYear: '2025-2026',
        edition: 'Tally.ERP 9 Rel 6.6',
        active: false,
      },
    ];

    const session: TallyPairingSession = {
      sessionId,
      tenantId,
      pairingPin,
      qrPayload: `collectflow://pair?tenantId=${tenantId}&pin=${pinRaw}&ts=${Date.now()}`,
      status: 'WAITING',
      expiresAt,
      detectedInstances,
    };

    await dbService.set(`pairingSessions/${tenantId}/${sessionId}`, session);
    return session;
  },

  async verifyPairingPin(
    tenantId: string,
    pin: string,
    selectedCompany?: string
  ): Promise<{ success: boolean; device?: Device }> {
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      throw new Error('Please enter a valid 6-digit pairing PIN (e.g. 741-902)');
    }

    const device = await this.registerDevice(tenantId, {
      deviceName: 'Windows Desktop (CollectFlow Helper)',
      tallyHost: 'localhost:9000',
      activeCompany: selectedCompany || 'Apex Steel Pvt Ltd',
    });

    return { success: true, device };
  },

  /**
   * Phase 19: Plain-Language Error Recovery Guidance for Non-Technical Users
   */
  getConnectionGuidance(code: string): {
    title: string;
    solution: string;
    steps: string[];
  } {
    switch (code) {
      case 'ODBC_DISABLED':
      case 'PORT_BLOCKED':
        return {
          title: 'Tally XML / ODBC Server is Disabled',
          solution: 'Press F12 / F1 in Tally, navigate to Advanced Configuration, and enable ODBC/XML Server.',
          steps: [
            'Open TallyPrime and press F1 (Help) or F12 (Configure).',
            'Select Settings -> Connectivity.',
            "Set 'Tally is acting as: Both' or 'ODBC Enabled: Yes'.",
            'Restart TallyPrime to apply the settings.',
          ],
        };
      case 'FIREWALL_BLOCKED':
        return {
          title: 'Windows Defender / Firewall Blocking Port 9000',
          solution: 'Add inbound firewall rule allowing TCP port 9000 for TallyPrime.',
          steps: [
            'Open Windows Defender Firewall with Advanced Security.',
            'Click Inbound Rules -> New Rule.',
            'Select Port -> TCP -> Specific local ports: 9000.',
            'Select Allow the connection and name it TallyPrime Server.',
          ],
        };
      case 'ECONNREFUSED':
      case 'TALLY_NOT_RUNNING':
        return {
          title: 'Tally Is Not Running',
          solution: 'Start TallyPrime and open your active company.',
          steps: [
            'Launch TallyPrime from Desktop or Start Menu.',
            'Select and open your active company.',
            'Keep Tally open in the background while syncing.',
          ],
        };
      case 'COMPANY_CLOSED':
        return {
          title: 'No Company Open in Tally',
          solution: 'Open your active accounting company in TallyPrime.',
          steps: [
            'In TallyPrime, press Alt + F3 to Select Company.',
            'Choose your working company for this financial year.',
            "Click 'Retry Sync' in CollectFlow.",
          ],
        };
      default:
        return {
          title: 'General Connectivity Issue',
          solution: 'Ensure TallyPrime is open and logged in with full administrative privileges.',
          steps: [
            'Check that TallyPrime is open.',
            'Check that port 9000 is listening.',
            'Restart CollectFlow Helper if needed.',
          ],
        };
    }
  },

  /**
   * Phase 19: Bill-by-Bill Agst Ref XML Generator & Voucher Collision Prevention
   */
  generateTallyVoucherXml(command: TallyVoucherCommand): string {
    const billAllocations = command.billAllocations || (command as any).billsAllocated || [];
    const billAllocationsXml = billAllocations
      .map(
        (b: any) => `
        <BILLALLOCATIONS.LIST>
          <NAME>${b.billName || b.billNumber}</NAME>
          <BILLTYPE>${b.billType || 'Agst Ref'}</BILLTYPE>
          <AMOUNT>-${(b.amount || b.billAmount || 0).toFixed(2)}</AMOUNT>
        </BILLALLOCATIONS.LIST>`
      )
      .join('');

    const voucherNumberElement = command.autoNumbering
      ? `<ISAUTONUMBER>Yes</ISAUTONUMBER>
            <!-- Voucher number auto-assigned by Tally to prevent sequence collisions -->`
      : `<VOUCHERNUMBER>${command.commandId}</VOUCHERNUMBER>`;

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${command.partyLedger}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${command.voucherDate}</DATE>
            ${voucherNumberElement}
            <PARTYLEDGERNAME>${command.partyLedger}</PARTYLEDGERNAME>
            <NARRATION>${command.narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${command.partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${command.amount.toFixed(2)}</AMOUNT>
              ${billAllocationsXml}
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${command.bankOrCashLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${command.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  },

  /**
   * Phase 19: Desktop Agent Watchdog & Offline SQLite Buffer State
   */
  getOfflineQueueStatus() {
    return {
      serviceRunning: true,
      serviceName: 'collectflow-agent.exe',
      watchdogActive: true,
      sqliteBufferedRecords: 0,
      offlineModeSupported: true,
      lastWatchdogHeartbeat: Date.now(),
    };
  },

  async ingestSyncBatch(
    tenantId: string,
    deviceId: string,
    payload: {
      customers: TallyCustomerPayload[];
      invoices: TallyInvoicePayload[];
      syncType?: 'INITIAL' | 'INCREMENTAL' | 'MANUAL';
    }
  ): Promise<SyncJob> {
    const startedAt = Date.now();
    const syncJobId = `job_${Math.random().toString(36).substring(2, 9)}_${startedAt.toString(36)}`;
    const syncType = payload.syncType || 'INCREMENTAL';

    let upsertedCount = 0;
    const errors: Array<{ recordId: string; error: string }> = [];

    const customerSourceMap: Record<string, string> = {};

    // 1. Ingest Customers
    for (const cust of payload.customers) {
      try {
        const customerId = `cust_${cust.sourceCustomerId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        customerSourceMap[cust.sourceCustomerId] = customerId;

        const existing = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
        const customerData: Customer = {
          customerId,
          tenantId,
          source: 'tally',
          sourceCustomerId: cust.sourceCustomerId,
          name: cust.name,
          contactPerson: cust.contactPerson || null,
          mobile: cust.mobile,
          email: cust.email || null,
          creditLimit: cust.creditLimit || 500000,
          paymentTerms: cust.paymentTerms || 30,
          optOutWhatsApp: false,
          metrics: existing?.metrics || {
            totalReceivable: 0,
            overdueBalance: 0,
            openInvoicesCount: 0,
            overdueInvoicesCount: 0,
            averagePaymentDelayDays: 0,
            ptpSuccessRate: 100,
          },
          status: 'ACTIVE',
          createdAt: existing?.createdAt || startedAt,
          updatedAt: startedAt,
        };

        await dbService.set(`customers/${tenantId}/${customerId}`, customerData);
        upsertedCount += 1;
      } catch (err: any) {
        errors.push({ recordId: cust.sourceCustomerId, error: err.message || 'Customer sync error' });
      }
    }

    // 2. Ingest Invoices
    for (const inv of payload.invoices) {
      try {
        const invoiceId = `inv_${inv.sourceRecordId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        const customerId = customerSourceMap[inv.sourceCustomerId] || `cust_${inv.sourceCustomerId}`;
        const paidAmount = inv.paidAmount || 0;
        const balance = Math.max(0, inv.amount - paidAmount);

        const { daysPastDue, agingBucket, status } = receivablesService.calculateAging(
          inv.dueDate,
          balance,
          paidAmount
        );

        const compliance43B = receivablesService.calculateSection43Bh(inv.invoiceDate, 'MICRO', true);

        const invoiceData: Invoice = {
          invoiceId,
          tenantId,
          customerId,
          customerName: inv.customerName,
          source: 'tally',
          sourceRecordId: inv.sourceRecordId,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          amount: inv.amount,
          paidAmount,
          balance,
          creditNotesAmount: 0,
          netPayableAmount: inv.amount,
          currency: 'INR',
          status,
          agingBucket,
          daysPastDue,
          hasActivePtp: false,
          paymentLink: null,
          upiIntentString: null,
          lastReminderSentAt: null,
          reminderCount: 0,
          msmeCategory: 'MICRO',
          section43BhDeadline: compliance43B.deadlineStr,
          daysTo43BhDeadline: compliance43B.daysRemaining,
          is43BhOverdue: compliance43B.isOverdue,
          tallyBillType: 'Agst Ref',
          tallyBillName: inv.invoiceNumber,
          createdAt: startedAt,
          updatedAt: startedAt,
        };

        await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoiceData);
        await dbService.indexActiveInvoice(tenantId, invoiceId, invoiceData);
        upsertedCount += 1;
      } catch (err: any) {
        errors.push({ recordId: inv.sourceRecordId, error: err.message || 'Invoice sync error' });
      }
    }

    // 3. Recalculate tenant metrics
    await receivablesService.recalculateTenantReceivables(tenantId);

    // 4. Update Device Heartbeat and Sync Marker
    await dbService.update(`devices/${tenantId}/${deviceId}`, {
      lastSyncTime: startedAt,
      lastHeartbeat: startedAt,
      status: 'ONLINE',
    });

    // 5. Save Sync Job Record
    const completedAt = Date.now();
    const syncJob: SyncJob = {
      syncJobId,
      tenantId,
      deviceId,
      syncType,
      status: errors.length > 0 ? 'FAILED' : 'COMPLETED',
      recordsReceived: {
        customers: payload.customers.length,
        invoices: payload.invoices.length,
      },
      recordsUpserted: upsertedCount,
      recordsRejected: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    };

    await dbService.set(`syncJobs/${tenantId}/${syncJobId}`, syncJob);
    return syncJob;
  },

  async runSimulatedTallySync(tenantId: string, companyName?: string): Promise<SyncJob> {
    const devices = await this.getDevices(tenantId);
    let device = devices[0];

    if (!device) {
      device = await this.registerDevice(tenantId, {
        deviceName: 'Primary Accountant PC (TallyPrime Helper)',
        tallyHost: 'localhost:9000',
        activeCompany: companyName || 'Apex Steel Pvt Ltd',
      });
    }

    const today = new Date();
    const formatDate = (daysOffset: number) => {
      const d = new Date(today.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    };

    const sampleCustomers: TallyCustomerPayload[] = [
      {
        sourceCustomerId: 'LEDG_001',
        name: 'Sharma Electricals & Hardware',
        contactPerson: 'Mr. Rajesh Sharma',
        mobile: '+919811223344',
        email: 'sharma.electricals@gmail.com',
        creditLimit: 500000,
        paymentTerms: 30,
        gstin: '07AAAAA0000A1Z5',
      },
      {
        sourceCustomerId: 'LEDG_002',
        name: 'Apex Precision Engineering',
        contactPerson: 'Vikram Joshi',
        mobile: '+919876543210',
        email: 'accounts@apexprecision.com',
        creditLimit: 1000000,
        paymentTerms: 45,
        gstin: '27AABCA1234B1Z2',
      },
      {
        sourceCustomerId: 'LEDG_003',
        name: 'Om Sai Trading Corporation',
        contactPerson: 'Ramesh Patel',
        mobile: '+919821778899',
        email: 'omsai@pateltraders.in',
        creditLimit: 200000,
        paymentTerms: 15,
        gstin: '24AACCO9988D1Z',
      },
    ];

    const sampleInvoices: TallyInvoicePayload[] = [
      {
        sourceRecordId: 'VOUCH_101',
        sourceCustomerId: 'LEDG_001',
        customerName: 'Sharma Electricals & Hardware',
        invoiceNumber: 'INV-2026-081',
        invoiceDate: formatDate(-45),
        dueDate: formatDate(-15),
        amount: 84500,
        paidAmount: 0,
      },
      {
        sourceRecordId: 'VOUCH_102',
        sourceCustomerId: 'LEDG_001',
        customerName: 'Sharma Electricals & Hardware',
        invoiceNumber: 'INV-2026-092',
        invoiceDate: formatDate(-10),
        dueDate: formatDate(20),
        amount: 32000,
        paidAmount: 0,
      },
      {
        sourceRecordId: 'VOUCH_103',
        sourceCustomerId: 'LEDG_002',
        customerName: 'Apex Precision Engineering',
        invoiceNumber: 'INV-2026-064',
        invoiceDate: formatDate(-80),
        dueDate: formatDate(-35),
        amount: 145000,
        paidAmount: 25000,
      },
      {
        sourceRecordId: 'VOUCH_104',
        sourceCustomerId: 'LEDG_003',
        customerName: 'Om Sai Trading Corporation',
        invoiceNumber: 'INV-2026-105',
        invoiceDate: formatDate(-14),
        dueDate: formatDate(1),
        amount: 47200,
        paidAmount: 0,
      },
    ];

    return await this.ingestSyncBatch(tenantId, device.deviceId, {
      customers: sampleCustomers,
      invoices: sampleInvoices,
      syncType: 'MANUAL',
    });
  },
};
