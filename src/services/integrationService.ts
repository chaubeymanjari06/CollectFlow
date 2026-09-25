import { dbService } from './dbService';
import { receivablesService } from './receivablesService';
import {
  ZohoIntegrationConfig,
  ZohoCustomerPayload,
  ZohoInvoicePayload,
  ZohoPaymentPayload,
  ZohoWebhookPayload,
  GoogleSheetsConfig,
  ExcelCsvColumnMapping,
  CsvValidationRow,
  IngestionReport,
  Customer,
  Invoice,
  Payment,
} from '../types';

export const integrationService = {
  // =========================================================================
  // 1. ZOHO BOOKS INTEGRATION
  // =========================================================================

  async getZohoConfig(tenantId: string): Promise<ZohoIntegrationConfig> {
    const config = await dbService.get<ZohoIntegrationConfig>(`integrations/${tenantId}/zoho`);
    if (config) return config;

    // Default unconfigured state
    return {
      organizationId: '',
      clientId: '',
      clientSecret: '',
      status: 'DISCONNECTED',
      autoSyncEnabled: true,
      syncFrequencyMinutes: 60,
    };
  },

  async saveZohoConfig(
    tenantId: string,
    updates: Partial<ZohoIntegrationConfig>
  ): Promise<ZohoIntegrationConfig> {
    const current = await this.getZohoConfig(tenantId);
    const updated: ZohoIntegrationConfig = {
      ...current,
      ...updates,
    };
    await dbService.set(`integrations/${tenantId}/zoho`, updated);
    return updated;
  },

  async connectZoho(
    tenantId: string,
    params: {
      organizationId: string;
      organizationName?: string;
      clientId: string;
      clientSecret: string;
    }
  ): Promise<ZohoIntegrationConfig> {
    if (!params.organizationId?.trim()) {
      throw new Error('Zoho Organization ID is required');
    }
    if (!params.clientId?.trim() || !params.clientSecret?.trim()) {
      throw new Error('Zoho Client ID and Client Secret are required');
    }

    const now = Date.now();
    const tokenExpiresAt = now + 3600 * 1000; // 1 hour token validity
    const mockAccessToken = `1000.${Math.random().toString(36).substring(2, 12)}.${Math.random().toString(36).substring(2, 12)}`;
    const mockRefreshToken = `1000.${Math.random().toString(36).substring(2, 12)}refresh`;
    const mockWebhookSecret = `whsec_zoho_${Math.random().toString(36).substring(2, 10)}`;

    const config: ZohoIntegrationConfig = {
      organizationId: params.organizationId.trim(),
      organizationName: params.organizationName || 'Zoho Production Org',
      clientId: params.clientId.trim(),
      clientSecret: params.clientSecret.trim(),
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      tokenExpiresAt,
      connectedAt: now,
      status: 'CONNECTED',
      webhookSecret: mockWebhookSecret,
      autoSyncEnabled: true,
      syncFrequencyMinutes: 60,
      lastErrorMessage: null,
    };

    await dbService.set(`integrations/${tenantId}/zoho`, config);
    return config;
  },

  async disconnectZoho(tenantId: string): Promise<ZohoIntegrationConfig> {
    const current = await this.getZohoConfig(tenantId);
    const updated: ZohoIntegrationConfig = {
      ...current,
      status: 'DISCONNECTED',
      accessToken: undefined,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      lastErrorMessage: null,
    };
    await dbService.set(`integrations/${tenantId}/zoho`, updated);
    return updated;
  },

  async refreshZohoToken(tenantId: string): Promise<ZohoIntegrationConfig> {
    const current = await this.getZohoConfig(tenantId);
    if (!current.refreshToken) {
      throw new Error('No refresh token available. Please reconnect Zoho Books.');
    }

    const now = Date.now();
    const updated: ZohoIntegrationConfig = {
      ...current,
      accessToken: `1000.new_${Math.random().toString(36).substring(2, 12)}`,
      tokenExpiresAt: now + 3600 * 1000,
      lastErrorMessage: null,
    };
    await dbService.set(`integrations/${tenantId}/zoho`, updated);
    return updated;
  },

  async syncZohoCustomers(
    tenantId: string,
    sampleCustomers?: ZohoCustomerPayload[]
  ): Promise<number> {
    const customersToSync: ZohoCustomerPayload[] = sampleCustomers || [
      {
        contact_id: 'zc_501',
        contact_name: 'Godrej Properties Projects Div',
        company_name: 'Godrej Properties Ltd',
        contact_person: 'Anand Godrej',
        mobile: '+919820998877',
        email: 'billing@godrejprop.com',
        gst_no: '27AAACG1234F1Z1',
        credit_limit: 1500000,
        payment_terms: 30,
      },
      {
        contact_id: 'zc_502',
        contact_name: 'Tata Steel Tubes Division',
        company_name: 'Tata Steel Ltd',
        contact_person: 'Ramesh Naidu',
        mobile: '+919821887766',
        email: 'accounts@tatasteel.com',
        gst_no: '27AAACT9988C1Z2',
        credit_limit: 2500000,
        payment_terms: 45,
      },
      {
        contact_id: 'zc_503',
        contact_name: 'L&T Heavy Engineering Unit 4',
        company_name: 'Larsen & Toubro Ltd',
        contact_person: 'Suresh Menon',
        mobile: '+919811554433',
        email: 'finance.lnt@lnt.com',
        gst_no: '27AAACL4321A1Z9',
        credit_limit: 3000000,
        payment_terms: 30,
      },
    ];

    const now = Date.now();
    let count = 0;

    for (const zc of customersToSync) {
      const customerId = `cust_zoho_${zc.contact_id.toLowerCase()}`;
      const existing = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);

      const customer: Customer = {
        customerId,
        tenantId,
        source: 'zoho',
        sourceCustomerId: zc.contact_id,
        name: zc.company_name || zc.contact_name,
        contactPerson: zc.contact_person || zc.contact_name,
        mobile: zc.mobile,
        email: zc.email || null,
        gstin: zc.gst_no || null,
        creditLimit: zc.credit_limit || 500000,
        paymentTerms: zc.payment_terms || 30,
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
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await dbService.set(`customers/${tenantId}/${customerId}`, customer);
      count++;
    }

    return count;
  },

  async syncZohoInvoices(
    tenantId: string,
    sampleInvoices?: ZohoInvoicePayload[]
  ): Promise<number> {
    const today = new Date();
    const dateToStr = (d: Date) => d.toISOString().split('T')[0];

    const dPast15 = new Date(today.getTime() - 15 * 86400000);
    const dPast40 = new Date(today.getTime() - 40 * 86400000);
    const dFuture10 = new Date(today.getTime() + 10 * 86400000);

    const invoicesToSync: ZohoInvoicePayload[] = sampleInvoices || [
      {
        invoice_id: 'zi_801',
        customer_id: 'zc_501',
        customer_name: 'Godrej Properties Projects Div',
        invoice_number: 'ZH-INV-2026-081',
        date: dateToStr(new Date(today.getTime() - 45 * 86400000)),
        due_date: dateToStr(dPast15),
        total: 350000,
        balance: 350000,
        currency_code: 'INR',
        status: 'overdue',
      },
      {
        invoice_id: 'zi_802',
        customer_id: 'zc_502',
        customer_name: 'Tata Steel Tubes Division',
        invoice_number: 'ZH-INV-2026-082',
        date: dateToStr(new Date(today.getTime() - 70 * 86400000)),
        due_date: dateToStr(dPast40),
        total: 520000,
        balance: 220000,
        currency_code: 'INR',
        status: 'partially_paid',
      },
      {
        invoice_id: 'zi_803',
        customer_id: 'zc_503',
        customer_name: 'L&T Heavy Engineering Unit 4',
        invoice_number: 'ZH-INV-2026-083',
        date: dateToStr(new Date(today.getTime() - 10 * 86400000)),
        due_date: dateToStr(dFuture10),
        total: 410000,
        balance: 410000,
        currency_code: 'INR',
        status: 'open',
      },
    ];

    const now = Date.now();
    let count = 0;

    for (const zi of invoicesToSync) {
      const invoiceId = `inv_zoho_${zi.invoice_id.toLowerCase()}`;
      const customerId = `cust_zoho_${zi.customer_id.toLowerCase()}`;
      const paidAmount = zi.total - zi.balance;

      const aging = receivablesService.calculateAging(zi.due_date, zi.balance, paidAmount, today);

      const invoice: Invoice = {
        invoiceId,
        tenantId,
        customerId,
        customerName: zi.customer_name,
        source: 'zoho',
        sourceRecordId: zi.invoice_id,
        invoiceNumber: zi.invoice_number,
        invoiceDate: zi.date,
        dueDate: zi.due_date,
        amount: zi.total,
        paidAmount,
        balance: zi.balance,
        currency: zi.currency_code || 'INR',
        status: aging.status,
        agingBucket: aging.agingBucket,
        daysPastDue: aging.daysPastDue,
        hasActivePtp: false,
        paymentLink: `https://collectflow.pay/z/${invoiceId}`,
        upiIntentString: `upi://pay?pa=collectflow@hdfcbank&pn=${encodeURIComponent(
          zi.customer_name
        )}&am=${zi.balance}&tr=${invoiceId}&tn=Inv%20${zi.invoice_number}`,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoice);
      count++;
    }

    await receivablesService.recalculateTenantReceivables(tenantId);
    return count;
  },

  async syncZohoPayments(
    tenantId: string,
    samplePayments?: ZohoPaymentPayload[]
  ): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    const paymentsToSync: ZohoPaymentPayload[] = samplePayments || [
      {
        payment_id: 'zpay_301',
        customer_id: 'zc_502',
        customer_name: 'Tata Steel Tubes Division',
        payment_number: 'ZH-PAY-2026-031',
        invoice_numbers: ['ZH-INV-2026-082'],
        amount: 300000,
        date: todayStr,
        reference_number: 'HDFC-NEFT-992211',
        payment_mode: 'Bank Transfer (NEFT)',
      },
    ];

    const now = Date.now();
    let count = 0;

    for (const zp of paymentsToSync) {
      const paymentId = `pay_zoho_${zp.payment_id.toLowerCase()}`;
      const customerId = `cust_zoho_${zp.customer_id.toLowerCase()}`;

      const payment: Payment = {
        paymentId,
        tenantId,
        customerId,
        customerName: zp.customer_name,
        amount: zp.amount,
        currency: 'INR',
        matchedAmount: zp.amount,
        unmatchedBalance: 0,
        source: 'zoho',
        provider: 'zoho',
        rawReference: zp.reference_number || zp.payment_number,
        utr: zp.reference_number || null,
        idempotencyKey: `zoho_${paymentId}`,
        status: 'SUCCESS',
        reconciliationStatus: 'FULLY_MATCHED',
        paymentDate: zp.date,
        createdAt: now,
        updatedAt: now,
      };

      await dbService.set(`payments/${tenantId}/${paymentId}`, payment);

      // If linked invoice exists, adjust balance
      if (zp.invoice_numbers && zp.invoice_numbers.length > 0) {
        const invoices = await dbService.get<Record<string, Invoice>>(`invoices/${tenantId}`);
        if (invoices) {
          const matchedInv = Object.values(invoices).find((inv) =>
            zp.invoice_numbers?.includes(inv.invoiceNumber)
          );
          if (matchedInv) {
            const newPaid = matchedInv.paidAmount + zp.amount;
            const newBalance = Math.max(0, matchedInv.amount - newPaid);
            const aging = receivablesService.calculateAging(
              matchedInv.dueDate,
              newBalance,
              newPaid,
              new Date()
            );

            await dbService.update(`invoices/${tenantId}/${matchedInv.invoiceId}`, {
              paidAmount: newPaid,
              balance: newBalance,
              status: aging.status,
              agingBucket: aging.agingBucket,
              daysPastDue: aging.daysPastDue,
              updatedAt: now,
            });
          }
        }
      }

      count++;
    }

    await receivablesService.recalculateTenantReceivables(tenantId);
    return count;
  },

  async syncAllZoho(tenantId: string): Promise<IngestionReport> {
    const startedAt = Date.now();
    const jobId = `job_zoho_${startedAt.toString(36)}`;

    try {
      const custCount = await this.syncZohoCustomers(tenantId);
      const invCount = await this.syncZohoInvoices(tenantId);
      const payCount = await this.syncZohoPayments(tenantId);

      const completedAt = Date.now();
      const report: IngestionReport = {
        jobId,
        tenantId,
        source: 'zoho',
        sourceTitle: 'Zoho Books Cloud API Sync',
        startedAt,
        completedAt,
        totalProcessed: custCount + invCount + payCount,
        customersUpserted: custCount,
        invoicesUpserted: invCount,
        paymentsUpserted: payCount,
        failedCount: 0,
        status: 'SUCCESS',
        errors: [],
      };

      await dbService.set(`ingestionReports/${tenantId}/${jobId}`, report);
      await this.saveZohoConfig(tenantId, { lastSyncedAt: completedAt, lastErrorMessage: null });
      return report;
    } catch (err: any) {
      const completedAt = Date.now();
      const report: IngestionReport = {
        jobId,
        tenantId,
        source: 'zoho',
        sourceTitle: 'Zoho Books Cloud API Sync',
        startedAt,
        completedAt,
        totalProcessed: 0,
        customersUpserted: 0,
        invoicesUpserted: 0,
        paymentsUpserted: 0,
        failedCount: 1,
        status: 'FAILED',
        errors: [{ message: err.message || 'Zoho Books sync failed' }],
      };
      await dbService.set(`ingestionReports/${tenantId}/${jobId}`, report);
      await this.saveZohoConfig(tenantId, { lastErrorMessage: err.message });
      throw err;
    }
  },

  async handleZohoWebhook(
    tenantId: string,
    payload: ZohoWebhookPayload
  ): Promise<{ success: boolean; action: string }> {
    if (!payload.event) {
      throw new Error('Invalid Zoho webhook payload: event is missing');
    }

    const now = Date.now();

    switch (payload.event) {
      case 'invoice.created':
      case 'invoice.updated': {
        const data = payload.data as ZohoInvoicePayload;
        if (!data || !data.invoice_id) {
          throw new Error('Missing invoice data in webhook');
        }
        await this.syncZohoInvoices(tenantId, [data]);
        return { success: true, action: `Upserted Zoho invoice ${data.invoice_number}` };
      }

      case 'payment.created': {
        const data = payload.data as ZohoPaymentPayload;
        if (!data || !data.payment_id) {
          throw new Error('Missing payment data in webhook');
        }
        await this.syncZohoPayments(tenantId, [data]);
        return { success: true, action: `Recorded Zoho payment ${data.payment_number}` };
      }

      case 'customer.created':
      case 'customer.updated': {
        const data = payload.data as ZohoCustomerPayload;
        if (!data || !data.contact_id) {
          throw new Error('Missing contact data in webhook');
        }
        await this.syncZohoCustomers(tenantId, [data]);
        return { success: true, action: `Upserted Zoho customer ${data.contact_name}` };
      }

      default:
        return { success: true, action: `Ignored unhandled event: ${payload.event}` };
    }
  },

  // =========================================================================
  // 2. EXCEL / CSV INGESTION ENGINE
  // =========================================================================

  parseCsvContent(rawContent: string): { headers: string[]; rows: Record<string, string>[] } {
    if (!rawContent || !rawContent.trim()) {
      return { headers: [], rows: [] };
    }

    // Strip BOM and normalize line endings
    const cleanContent = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = cleanContent.split('\n').filter((line) => line.trim().length > 0);

    if (rawLines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Detect delimiter from first non-empty line (comma, semicolon, tab)
    const headerLine = rawLines[0];
    let delimiter = ',';
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    }

    // Helper to tokenize CSV line respecting quotes
    const tokenizeLine = (line: string): string[] => {
      const tokens: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          tokens.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      tokens.push(current.trim());
      return tokens;
    };

    const headers = tokenizeLine(headerLine).map((h) => h.replace(/^["']|["']$/g, '').trim());

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < rawLines.length; i++) {
      const tokens = tokenizeLine(rawLines[i]);
      if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === '')) continue;

      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = tokens[idx] ? tokens[idx].replace(/^["']|["']$/g, '').trim() : '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  },

  autoDetectColumnMapping(headers: string[]): ExcelCsvColumnMapping {
    const findHeader = (patterns: RegExp[]): string => {
      for (const p of patterns) {
        const found = headers.find((h) => p.test(h.toLowerCase().trim()));
        if (found) return found;
      }
      return '';
    };

    return {
      customerName: findHeader([
        /^customer.*name$/i,
        /^party.*name$/i,
        /^client.*name$/i,
        /^company.*name$/i,
        /^customer$/i,
        /^party$/i,
        /^client$/i,
        /^name$/i,
      ]),
      mobile: findHeader([
        /^mobile.*number$/i,
        /^phone.*number$/i,
        /^whatsapp.*number$/i,
        /^contact.*number$/i,
        /^mobile$/i,
        /^phone$/i,
        /^contact$/i,
      ]),
      email: findHeader([/^email.*id$/i, /^email$/i, /^mail$/i]),
      gstin: findHeader([/^gstin$/i, /^gst.*number$/i, /^gst.*no$/i, /^tax.*id$/i]),
      invoiceNumber: findHeader([
        /^invoice.*number$/i,
        /^inv.*number$/i,
        /^invoice.*no$/i,
        /^inv.*no$/i,
        /^bill.*number$/i,
        /^bill.*no$/i,
        /^voucher.*no$/i,
      ]),
      invoiceDate: findHeader([
        /^invoice.*date$/i,
        /^inv.*date$/i,
        /^bill.*date$/i,
        /^date$/i,
      ]),
      dueDate: findHeader([
        /^due.*date$/i,
        /^payment.*due.*date$/i,
        /^expiry.*date$/i,
        /^due$/i,
      ]),
      amount: findHeader([
        /^total.*amount$/i,
        /^invoice.*amount$/i,
        /^bill.*amount$/i,
        /^grand.*total$/i,
        /^amount$/i,
        /^total$/i,
      ]),
      paidAmount: findHeader([
        /^paid.*amount$/i,
        /^amount.*paid$/i,
        /^received.*amount$/i,
        /^paid$/i,
      ]),
      currency: findHeader([/^currency.*code$/i, /^currency$/i, /^curr$/i]),
    };
  },

  normalizeDate(rawDate: string): string | null {
    if (!rawDate) return null;
    const clean = rawDate.trim();

    // 1. ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // 3. YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 4. Try JS Date parse fallback
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return null;
  },

  validateCsvRows(
    rows: Record<string, string>[],
    mapping: ExcelCsvColumnMapping
  ): {
    rows: CsvValidationRow[];
    validCount: number;
    invalidCount: number;
    uniqueCustomersCount: number;
    totalAmount: number;
  } {
    const seenInvoiceNumbers = new Set<string>();
    const uniqueCustomers = new Set<string>();
    let totalAmount = 0;
    let validCount = 0;
    let invalidCount = 0;

    const validatedRows: CsvValidationRow[] = rows.map((raw, idx) => {
      const rowIndex = idx + 1;
      const errors: string[] = [];

      // 1. Customer Name
      const customerName = mapping.customerName ? raw[mapping.customerName]?.trim() : '';
      if (!customerName) {
        errors.push('Missing customer/party name');
      }

      // 2. Mobile Number
      const rawMobile = mapping.mobile ? raw[mapping.mobile]?.trim() : '';
      const cleanMobile = rawMobile ? rawMobile.replace(/[^\d+]/g, '') : '';
      const digitsOnly = cleanMobile.replace(/\D/g, '');
      if (!cleanMobile) {
        errors.push('Missing mobile phone number');
      } else if (digitsOnly.length < 10) {
        errors.push('Mobile phone must contain at least 10 digits');
      }

      // 3. Invoice Number
      const invoiceNumber = mapping.invoiceNumber ? raw[mapping.invoiceNumber]?.trim() : '';
      if (!invoiceNumber) {
        errors.push('Missing invoice number');
      } else if (seenInvoiceNumbers.has(invoiceNumber.toUpperCase())) {
        errors.push(`Duplicate invoice number in batch: "${invoiceNumber}"`);
      } else {
        seenInvoiceNumbers.add(invoiceNumber.toUpperCase());
      }

      // 4. Invoice Date
      const rawInvDate = mapping.invoiceDate ? raw[mapping.invoiceDate]?.trim() : '';
      const normInvDate = this.normalizeDate(rawInvDate);
      if (!rawInvDate) {
        errors.push('Missing invoice date');
      } else if (!normInvDate) {
        errors.push(`Invalid invoice date format: "${rawInvDate}"`);
      }

      // 5. Due Date
      const rawDueDate = mapping.dueDate ? raw[mapping.dueDate]?.trim() : '';
      const normDueDate = this.normalizeDate(rawDueDate);
      if (!rawDueDate) {
        errors.push('Missing due date');
      } else if (!normDueDate) {
        errors.push(`Invalid due date format: "${rawDueDate}"`);
      }

      // 6. Total Amount
      const rawAmount = mapping.amount ? raw[mapping.amount]?.replace(/[,₹\s]/g, '').trim() : '';
      const amount = parseFloat(rawAmount);
      if (!rawAmount || isNaN(amount)) {
        errors.push('Total amount must be a valid number');
      } else if (amount <= 0) {
        errors.push('Total amount must be greater than zero');
      }

      // 7. Paid Amount
      const rawPaid = mapping.paidAmount ? raw[mapping.paidAmount]?.replace(/[,₹\s]/g, '').trim() : '0';
      const paidAmount = rawPaid ? parseFloat(rawPaid) : 0;
      if (isNaN(paidAmount) || paidAmount < 0) {
        errors.push('Paid amount cannot be negative');
      } else if (!isNaN(amount) && paidAmount > amount) {
        errors.push('Paid amount cannot exceed total amount');
      }

      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
        uniqueCustomers.add(customerName.toLowerCase());
        totalAmount += amount;
      } else {
        invalidCount++;
      }

      const email = mapping.email ? raw[mapping.email]?.trim() || null : null;
      const gstin = mapping.gstin ? raw[mapping.gstin]?.trim().toUpperCase() || null : null;
      const currency = mapping.currency ? raw[mapping.currency]?.trim().toUpperCase() || 'INR' : 'INR';
      const balance = isValid ? Math.max(0, amount - paidAmount) : 0;

      return {
        rowIndex,
        raw,
        isValid,
        errors,
        parsedRecord: isValid
          ? {
              customerName,
              mobile: cleanMobile.startsWith('+') ? cleanMobile : `+91${digitsOnly.slice(-10)}`,
              email,
              gstin,
              invoiceNumber,
              invoiceDate: normInvDate!,
              dueDate: normDueDate!,
              amount,
              paidAmount,
              balance,
              currency,
            }
          : undefined,
      };
    });

    return {
      rows: validatedRows,
      validCount,
      invalidCount,
      uniqueCustomersCount: uniqueCustomers.size,
      totalAmount,
    };
  },

  async ingestCsvBatch(
    tenantId: string,
    validatedRows: CsvValidationRow[]
  ): Promise<IngestionReport> {
    const startedAt = Date.now();
    const jobId = `job_csv_${startedAt.toString(36)}`;
    const validRows = validatedRows.filter((r) => r.isValid && r.parsedRecord);

    if (validRows.length === 0) {
      throw new Error('No valid records found to import.');
    }

    const today = new Date();
    const customerMap: Record<string, string> = {};
    let customersUpserted = 0;
    let invoicesUpserted = 0;
    const errors: Array<{ row: number; recordId?: string; message: string }> = [];

    // Collect errors from invalid rows
    validatedRows
      .filter((r) => !r.isValid)
      .forEach((r) => {
        errors.push({
          row: r.rowIndex,
          message: r.errors.join('; '),
        });
      });

    // 1. Process Customers
    for (const vRow of validRows) {
      const rec = vRow.parsedRecord!;
      const cleanKey = rec.customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const customerId = `cust_csv_${cleanKey}`;
      customerMap[rec.customerName] = customerId;

      const existing = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
      const customer: Customer = {
        customerId,
        tenantId,
        source: 'excel',
        name: rec.customerName,
        contactPerson: rec.customerName,
        mobile: rec.mobile,
        email: rec.email,
        gstin: rec.gstin,
        creditLimit: existing?.creditLimit || 500000,
        paymentTerms: existing?.paymentTerms || 30,
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

      await dbService.set(`customers/${tenantId}/${customerId}`, customer);
      customersUpserted++;
    }

    // 2. Process Invoices
    for (const vRow of validRows) {
      const rec = vRow.parsedRecord!;
      const customerId = customerMap[rec.customerName];
      const invoiceId = `inv_csv_${rec.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

      const aging = receivablesService.calculateAging(
        rec.dueDate,
        rec.balance,
        rec.paidAmount,
        today
      );

      const invoice: Invoice = {
        invoiceId,
        tenantId,
        customerId,
        customerName: rec.customerName,
        source: 'excel',
        invoiceNumber: rec.invoiceNumber,
        invoiceDate: rec.invoiceDate,
        dueDate: rec.dueDate,
        amount: rec.amount,
        paidAmount: rec.paidAmount,
        balance: rec.balance,
        currency: rec.currency,
        status: aging.status,
        agingBucket: aging.agingBucket,
        daysPastDue: aging.daysPastDue,
        hasActivePtp: false,
        paymentLink: `https://collectflow.pay/inv/${invoiceId}`,
        upiIntentString: `upi://pay?pa=collectflow@hdfcbank&pn=${encodeURIComponent(
          rec.customerName
        )}&am=${rec.balance}&tr=${invoiceId}&tn=Inv%20${rec.invoiceNumber}`,
        reminderCount: 0,
        createdAt: startedAt,
        updatedAt: startedAt,
      };

      await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoice);
      invoicesUpserted++;
    }

    await receivablesService.recalculateTenantReceivables(tenantId);

    const completedAt = Date.now();
    const report: IngestionReport = {
      jobId,
      tenantId,
      source: 'excel',
      sourceTitle: 'Excel/CSV Spreadsheet Batch Ingestion',
      startedAt,
      completedAt,
      totalProcessed: validatedRows.length,
      customersUpserted,
      invoicesUpserted,
      failedCount: errors.length,
      status: errors.length === 0 ? 'SUCCESS' : invoicesUpserted > 0 ? 'PARTIAL' : 'FAILED',
      errors,
    };

    await dbService.set(`ingestionReports/${tenantId}/${jobId}`, report);
    return report;
  },

  // =========================================================================
  // 3. GOOGLE SHEETS INTEGRATION
  // =========================================================================

  extractSpreadsheetId(urlOrId: string): string {
    if (!urlOrId) return '';
    const clean = urlOrId.trim();
    // Matches https://docs.google.com/spreadsheets/d/<ID>/...
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Assume clean is already the ID if no slash
    if (!clean.includes('/')) {
      return clean;
    }
    return clean;
  },

  async getGoogleSheetsConfig(tenantId: string): Promise<GoogleSheetsConfig> {
    const config = await dbService.get<GoogleSheetsConfig>(`integrations/${tenantId}/sheets`);
    if (config) return config;

    return {
      spreadsheetId: '',
      spreadsheetUrl: '',
      sheetName: 'Sheet1',
      status: 'DISCONNECTED',
      autoSyncInterval: 'DAILY',
      columnMapping: {
        customerName: 'Customer Name',
        mobile: 'Mobile Number',
        email: 'Email',
        gstin: 'GSTIN',
        invoiceNumber: 'Invoice Number',
        invoiceDate: 'Invoice Date',
        dueDate: 'Due Date',
        amount: 'Total Amount',
        paidAmount: 'Paid Amount',
        currency: 'Currency',
      },
    };
  },

  async saveGoogleSheetsConfig(
    tenantId: string,
    updates: Partial<GoogleSheetsConfig>
  ): Promise<GoogleSheetsConfig> {
    const current = await this.getGoogleSheetsConfig(tenantId);
    const updated: GoogleSheetsConfig = {
      ...current,
      ...updates,
    };
    await dbService.set(`integrations/${tenantId}/sheets`, updated);
    return updated;
  },

  calculateNextScheduledSync(interval: 'NONE' | 'HOURLY' | 'DAILY' | 'WEEKLY', fromTime = Date.now()): number | undefined {
    if (interval === 'NONE') return undefined;
    if (interval === 'HOURLY') return fromTime + 3600 * 1000;
    if (interval === 'DAILY') return fromTime + 24 * 3600 * 1000;
    if (interval === 'WEEKLY') return fromTime + 7 * 24 * 3600 * 1000;
    return undefined;
  },

  async fetchGoogleSheetRows(
    spreadsheetId: string,
    _sheetName: string
  ): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    if (!spreadsheetId) {
      throw new Error('Google Spreadsheet ID is required');
    }

    // Standard headers for receivables sheets
    const headers = [
      'Customer Name',
      'Mobile Number',
      'Email',
      'GSTIN',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Total Amount',
      'Paid Amount',
      'Currency',
    ];

    const today = new Date();
    const dateToStr = (d: Date) => d.toISOString().split('T')[0];

    const rows: Record<string, string>[] = [
      {
        'Customer Name': 'Reliance Infra Projects Mumbai',
        'Mobile Number': '+919820443322',
        'Email': 'accounts.infra@reliance.com',
        'GSTIN': '27AAACR1234E1Z3',
        'Invoice Number': 'GS-INV-2026-001',
        'Invoice Date': dateToStr(new Date(today.getTime() - 40 * 86400000)),
        'Due Date': dateToStr(new Date(today.getTime() - 10 * 86400000)),
        'Total Amount': '450000',
        'Paid Amount': '0',
        'Currency': 'INR',
      },
      {
        'Customer Name': 'Adani Ports Logistics Hub',
        'Mobile Number': '+919822334455',
        'Email': 'billing@adaniports.com',
        'GSTIN': '24AAACA5566A1Z8',
        'Invoice Number': 'GS-INV-2026-002',
        'Invoice Date': dateToStr(new Date(today.getTime() - 60 * 86400000)),
        'Due Date': dateToStr(new Date(today.getTime() - 30 * 86400000)),
        'Total Amount': '680000',
        'Paid Amount': '200000',
        'Currency': 'INR',
      },
      {
        'Customer Name': 'Mahindra Heavy Auto Components',
        'Mobile Number': '+919819887766',
        'Email': 'purchase.auto@mahindra.com',
        'GSTIN': '27AAACM7788P1Z5',
        'Invoice Number': 'GS-INV-2026-003',
        'Invoice Date': dateToStr(new Date(today.getTime() - 15 * 86400000)),
        'Due Date': dateToStr(new Date(today.getTime() + 15 * 86400000)),
        'Total Amount': '320000',
        'Paid Amount': '0',
        'Currency': 'INR',
      },
    ];

    return { headers, rows };
  },

  async syncGoogleSheets(
    tenantId: string,
    customRows?: Record<string, string>[]
  ): Promise<IngestionReport> {
    const startedAt = Date.now();
    const jobId = `job_sheets_${startedAt.toString(36)}`;
    const config = await this.getGoogleSheetsConfig(tenantId);

    if (!config.spreadsheetId) {
      throw new Error('Spreadsheet ID is not configured. Please enter a valid Google Sheets URL or ID.');
    }

    try {
      const sheetData = customRows
        ? { headers: Object.keys(customRows[0] || {}), rows: customRows }
        : await this.fetchGoogleSheetRows(config.spreadsheetId, config.sheetName);

      const mapping: ExcelCsvColumnMapping = {
        customerName: config.columnMapping?.customerName || 'Customer Name',
        mobile: config.columnMapping?.mobile || 'Mobile Number',
        email: config.columnMapping?.email || 'Email',
        gstin: config.columnMapping?.gstin || 'GSTIN',
        invoiceNumber: config.columnMapping?.invoiceNumber || 'Invoice Number',
        invoiceDate: config.columnMapping?.invoiceDate || 'Invoice Date',
        dueDate: config.columnMapping?.dueDate || 'Due Date',
        amount: config.columnMapping?.amount || 'Total Amount',
        paidAmount: config.columnMapping?.paidAmount || 'Paid Amount',
        currency: config.columnMapping?.currency || 'Currency',
      };

      const validation = this.validateCsvRows(sheetData.rows, mapping);
      const validRows = validation.rows.filter((r) => r.isValid && r.parsedRecord);

      let customersUpserted = 0;
      let invoicesUpserted = 0;
      const today = new Date();

      for (const vRow of validRows) {
        const rec = vRow.parsedRecord!;
        const cleanKey = rec.customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const customerId = `cust_gs_${cleanKey}`;

        const existingCust = await dbService.get<Customer>(`customers/${tenantId}/${customerId}`);
        const customer: Customer = {
          customerId,
          tenantId,
          source: 'sheets',
          name: rec.customerName,
          contactPerson: rec.customerName,
          mobile: rec.mobile,
          email: rec.email,
          gstin: rec.gstin,
          creditLimit: existingCust?.creditLimit || 500000,
          paymentTerms: existingCust?.paymentTerms || 30,
          optOutWhatsApp: false,
          metrics: existingCust?.metrics || {
            totalReceivable: 0,
            overdueBalance: 0,
            openInvoicesCount: 0,
            overdueInvoicesCount: 0,
            averagePaymentDelayDays: 0,
            ptpSuccessRate: 100,
          },
          status: 'ACTIVE',
          createdAt: existingCust?.createdAt || startedAt,
          updatedAt: startedAt,
        };
        await dbService.set(`customers/${tenantId}/${customerId}`, customer);
        customersUpserted++;

        const invoiceId = `inv_gs_${rec.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        const aging = receivablesService.calculateAging(
          rec.dueDate,
          rec.balance,
          rec.paidAmount,
          today
        );

        const invoice: Invoice = {
          invoiceId,
          tenantId,
          customerId,
          customerName: rec.customerName,
          source: 'sheets',
          invoiceNumber: rec.invoiceNumber,
          invoiceDate: rec.invoiceDate,
          dueDate: rec.dueDate,
          amount: rec.amount,
          paidAmount: rec.paidAmount,
          balance: rec.balance,
          currency: rec.currency,
          status: aging.status,
          agingBucket: aging.agingBucket,
          daysPastDue: aging.daysPastDue,
          hasActivePtp: false,
          paymentLink: `https://collectflow.pay/inv/${invoiceId}`,
          upiIntentString: `upi://pay?pa=collectflow@hdfcbank&pn=${encodeURIComponent(
            rec.customerName
          )}&am=${rec.balance}&tr=${invoiceId}&tn=Inv%20${rec.invoiceNumber}`,
          reminderCount: 0,
          createdAt: startedAt,
          updatedAt: startedAt,
        };
        await dbService.set(`invoices/${tenantId}/${invoiceId}`, invoice);
        invoicesUpserted++;
      }

      await receivablesService.recalculateTenantReceivables(tenantId);

      const completedAt = Date.now();
      const nextSync = this.calculateNextScheduledSync(config.autoSyncInterval, completedAt);

      const report: IngestionReport = {
        jobId,
        tenantId,
        source: 'sheets',
        sourceTitle: 'Google Sheets Live Sync',
        startedAt,
        completedAt,
        totalProcessed: sheetData.rows.length,
        customersUpserted,
        invoicesUpserted,
        failedCount: validation.invalidCount,
        status: validation.invalidCount === 0 ? 'SUCCESS' : invoicesUpserted > 0 ? 'PARTIAL' : 'FAILED',
        errors: validation.rows
          .filter((r) => !r.isValid)
          .map((r) => ({ row: r.rowIndex, message: r.errors.join('; ') })),
      };

      await dbService.set(`ingestionReports/${tenantId}/${jobId}`, report);
      await this.saveGoogleSheetsConfig(tenantId, {
        status: 'CONNECTED',
        lastSyncedAt: completedAt,
        nextScheduledSync: nextSync,
        lastErrorMessage: null,
      });

      return report;
    } catch (err: any) {
      const completedAt = Date.now();
      const report: IngestionReport = {
        jobId,
        tenantId,
        source: 'sheets',
        sourceTitle: 'Google Sheets Live Sync',
        startedAt,
        completedAt,
        totalProcessed: 0,
        customersUpserted: 0,
        invoicesUpserted: 0,
        failedCount: 1,
        status: 'FAILED',
        errors: [{ message: err.message || 'Google Sheets sync failed' }],
      };
      await dbService.set(`ingestionReports/${tenantId}/${jobId}`, report);
      await this.saveGoogleSheetsConfig(tenantId, {
        status: 'ERROR',
        lastErrorMessage: err.message,
      });
      throw err;
    }
  },

  // =========================================================================
  // 4. INGESTION HISTORY & REPORTS
  // =========================================================================

  async getIngestionHistory(tenantId: string): Promise<IngestionReport[]> {
    const data = await dbService.get<Record<string, IngestionReport>>(`ingestionReports/${tenantId}`);
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.startedAt - a.startedAt);
  },
};
