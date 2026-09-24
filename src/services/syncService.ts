import { dbService } from './dbService';
import { receivablesService } from './receivablesService';
import { Device, SyncJob, Customer, Invoice } from '../types';

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
      agentVersion: '1.2.0',
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

    // Map to lookup customerId by sourceCustomerId
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
          currency: 'INR',
          status,
          agingBucket,
          daysPastDue,
          hasActivePtp: false,
          paymentLink: null,
          upiIntentString: null,
          lastReminderSentAt: null,
          reminderCount: 0,
          createdAt: startedAt,
          updatedAt: startedAt,
        };

        await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoiceData);
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
      status: errors.length > 0 && upsertedCount === 0 ? 'FAILED' : 'COMPLETED',
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

  async runSimulatedTallySync(tenantId: string, companyName: string): Promise<SyncJob> {
    // 1. Ensure a device exists
    let devices = await this.getDevices(tenantId);
    let device = devices[0];
    if (!device) {
      device = await this.registerDevice(tenantId, {
        deviceName: 'TALLY-WORKSTATION-01',
        tallyHost: 'localhost:9000',
        activeCompany: companyName,
      });
    }

    // 2. Realistic sample dataset for Indian MSMEs
    const today = new Date();
    const formatDate = (daysOffset: number) => {
      const d = new Date(today.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    };

    const sampleCustomers: TallyCustomerPayload[] = [
      {
        sourceCustomerId: 'LEDG_001',
        name: 'Sharma Electricals & Hardware',
        contactPerson: 'Anand Sharma',
        mobile: '+919820112233',
        email: 'billing@sharmaelectricals.in',
        creditLimit: 300000,
        paymentTerms: 30,
        gstin: '27AABCS1429B1Z',
      },
      {
        sourceCustomerId: 'LEDG_002',
        name: 'Apex Precision Engineering',
        contactPerson: 'Sanjay Deshmukh',
        mobile: '+919819445566',
        email: 'accounts@apexprecision.com',
        creditLimit: 750000,
        paymentTerms: 45,
        gstin: '27AABCA5566C1Z',
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
        dueDate: formatDate(-15), // Overdue by 15 days (1-30 bucket)
        amount: 84500,
        paidAmount: 0,
      },
      {
        sourceRecordId: 'VOUCH_102',
        sourceCustomerId: 'LEDG_001',
        customerName: 'Sharma Electricals & Hardware',
        invoiceNumber: 'INV-2026-092',
        invoiceDate: formatDate(-10),
        dueDate: formatDate(20), // Current
        amount: 32000,
        paidAmount: 0,
      },
      {
        sourceRecordId: 'VOUCH_103',
        sourceCustomerId: 'LEDG_002',
        customerName: 'Apex Precision Engineering',
        invoiceNumber: 'INV-2026-064',
        invoiceDate: formatDate(-80),
        dueDate: formatDate(-35), // Overdue by 35 days (31-60 bucket)
        amount: 145000,
        paidAmount: 25000, // Partially paid
      },
      {
        sourceRecordId: 'VOUCH_104',
        sourceCustomerId: 'LEDG_003',
        customerName: 'Om Sai Trading Corporation',
        invoiceNumber: 'INV-2026-105',
        invoiceDate: formatDate(-14),
        dueDate: formatDate(1), // Due Soon
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
