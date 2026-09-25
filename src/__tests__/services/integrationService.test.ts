import { describe, it, expect, vi, beforeEach } from 'vitest';
import { integrationService } from '../../services/integrationService';
import { dbService } from '../../services/dbService';
import { receivablesService } from '../../services/receivablesService';

describe('Phase 13: Integration Service (Zoho Books, Excel/CSV, Google Sheets)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ZOHO BOOKS INTEGRATION TESTS
  // =========================================================================
  describe('Zoho Books Integration', () => {
    it('should return default disconnected config if not configured in RTDB', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const config = await integrationService.getZohoConfig('ten_test');

      expect(config.status).toBe('DISCONNECTED');
      expect(config.organizationId).toBe('');
      expect(config.autoSyncEnabled).toBe(true);
    });

    it('should connect to Zoho Books with valid credentials and generate OAuth tokens', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const config = await integrationService.connectZoho('ten_test', {
        organizationId: '60098765432',
        organizationName: 'Apex Steel Zoho Org',
        clientId: '1000.ABCDEF123456',
        clientSecret: 'secret_xyz789',
      });

      expect(config.status).toBe('CONNECTED');
      expect(config.organizationId).toBe('60098765432');
      expect(config.accessToken).toBeDefined();
      expect(config.refreshToken).toBeDefined();
      expect(config.tokenExpiresAt).toBeGreaterThan(Date.now());
      expect(setSpy).toHaveBeenCalledWith(
        'integrations/ten_test/zoho',
        expect.objectContaining({ status: 'CONNECTED', organizationId: '60098765432' })
      );
    });

    it('should throw error if required credentials are missing when connecting Zoho', async () => {
      await expect(
        integrationService.connectZoho('ten_test', {
          organizationId: '',
          clientId: 'id',
          clientSecret: 'secret',
        })
      ).rejects.toThrow('Zoho Organization ID is required');

      await expect(
        integrationService.connectZoho('ten_test', {
          organizationId: 'org_1',
          clientId: '',
          clientSecret: 'secret',
        })
      ).rejects.toThrow('Zoho Client ID and Client Secret are required');
    });

    it('should disconnect Zoho Books and clear access/refresh tokens', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        organizationId: '600123',
        clientId: 'id',
        clientSecret: 'sec',
        accessToken: 'tok_1',
        refreshToken: 'ref_1',
        status: 'CONNECTED',
      });
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const updated = await integrationService.disconnectZoho('ten_test');
      expect(updated.status).toBe('DISCONNECTED');
      expect(updated.accessToken).toBeUndefined();
      expect(updated.refreshToken).toBeUndefined();
      expect(setSpy).toHaveBeenCalledWith(
        'integrations/ten_test/zoho',
        expect.objectContaining({ status: 'DISCONNECTED' })
      );
    });

    it('should refresh Zoho OAuth access token', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        organizationId: '600123',
        clientId: 'id',
        clientSecret: 'sec',
        accessToken: 'old_tok',
        refreshToken: 'valid_refresh_token',
        status: 'CONNECTED',
      });
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const refreshed = await integrationService.refreshZohoToken('ten_test');
      expect(refreshed.accessToken).toContain('1000.new_');
      expect(refreshed.tokenExpiresAt).toBeGreaterThan(Date.now());
    });

    it('should sync Zoho customers into CollectFlow schema', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const count = await integrationService.syncZohoCustomers('ten_test', [
        {
          contact_id: 'zc_999',
          contact_name: 'Mahindra Auto Logistics',
          company_name: 'Mahindra Logistics Ltd',
          contact_person: 'Anil Kumble',
          mobile: '+919811223344',
          email: 'accounts@mahindra.com',
          gst_no: '27AAACM1234A1Z1',
          credit_limit: 1000000,
          payment_terms: 30,
        },
      ]);

      expect(count).toBe(1);
      expect(setSpy).toHaveBeenCalledWith(
        'customers/ten_test/cust_zoho_zc_999',
        expect.objectContaining({
          source: 'zoho',
          sourceCustomerId: 'zc_999',
          name: 'Mahindra Logistics Ltd',
          mobile: '+919811223344',
          gstin: '27AAACM1234A1Z1',
        })
      );
    });

    it('should sync Zoho invoices, compute aging, generate UPI links, and recalculate receivables', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recalcSpy = vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const count = await integrationService.syncZohoInvoices('ten_test', [
        {
          invoice_id: 'zi_777',
          customer_id: 'zc_999',
          customer_name: 'Mahindra Logistics Ltd',
          invoice_number: 'ZH-INV-777',
          date: '2026-08-01',
          due_date: '2026-09-01',
          total: 250000,
          balance: 250000,
          currency_code: 'INR',
          status: 'overdue',
        },
      ]);

      expect(count).toBe(1);
      expect(recalcSpy).toHaveBeenCalledWith('ten_test');
      expect(setSpy).toHaveBeenCalledWith(
        'invoices/ten_test/inv_zoho_zi_777',
        expect.objectContaining({
          source: 'zoho',
          invoiceNumber: 'ZH-INV-777',
          amount: 250000,
          balance: 250000,
          upiIntentString: expect.stringContaining('upi://pay?pa=collectflow@hdfcbank'),
        })
      );
    });

    it('should sync Zoho payment receipts, update matched invoice balances, and recalculate metrics', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_test') {
          return {
            inv_1: {
              invoiceId: 'inv_1',
              tenantId: 'ten_test',
              invoiceNumber: 'ZH-INV-777',
              amount: 250000,
              paidAmount: 0,
              balance: 250000,
              dueDate: '2026-09-01',
              status: 'OVERDUE',
            },
          };
        }
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      const recalcSpy = vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const count = await integrationService.syncZohoPayments('ten_test', [
        {
          payment_id: 'zpay_555',
          customer_id: 'zc_999',
          customer_name: 'Mahindra Logistics Ltd',
          payment_number: 'ZH-PAY-555',
          invoice_numbers: ['ZH-INV-777'],
          amount: 100000,
          date: '2026-09-20',
          reference_number: 'UTR-HDFC-999888',
        },
      ]);

      expect(count).toBe(1);
      expect(setSpy).toHaveBeenCalledWith(
        'payments/ten_test/pay_zoho_zpay_555',
        expect.objectContaining({
          amount: 100000,
          source: 'zoho',
          reconciliationStatus: 'FULLY_MATCHED',
        })
      );
      expect(updateSpy).toHaveBeenCalledWith(
        'invoices/ten_test/inv_1',
        expect.objectContaining({
          paidAmount: 100000,
          balance: 150000,
        })
      );
      expect(recalcSpy).toHaveBeenCalledWith('ten_test');
    });

    it('should handle incoming Zoho webhooks idempotently', async () => {
      const syncInvoiceSpy = vi.spyOn(integrationService, 'syncZohoInvoices').mockResolvedValue(1);

      const res = await integrationService.handleZohoWebhook('ten_test', {
        event: 'invoice.created',
        timestamp: Date.now(),
        organization_id: '600123',
        signature: 'hash_test',
        data: {
          invoice_id: 'zi_web_1',
          customer_id: 'zc_1',
          customer_name: 'Webhook Customer',
          invoice_number: 'INV-WEB-01',
          date: '2026-09-20',
          due_date: '2026-10-20',
          total: 80000,
          balance: 80000,
          status: 'open',
        },
      });

      expect(res.success).toBe(true);
      expect(res.action).toContain('INV-WEB-01');
      expect(syncInvoiceSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. EXCEL / CSV PARSING & VALIDATION ENGINE TESTS
  // =========================================================================
  describe('Excel / CSV Ingestion Engine', () => {
    it('should parse comma-separated CSV with headers and rows correctly', () => {
      const csv = `Customer Name,Mobile,Invoice Number,Due Date,Total Amount\nShree Cement,9820011221,INV-101,2026-10-01,150000\nBharat Infra,9820022332,INV-102,2026-10-15,220000`;
      const result = integrationService.parseCsvContent(csv);

      expect(result.headers).toEqual(['Customer Name', 'Mobile', 'Invoice Number', 'Due Date', 'Total Amount']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]['Customer Name']).toBe('Shree Cement');
      expect(result.rows[1]['Total Amount']).toBe('220000');
    });

    it('should support semicolon and tab-delimited formats with quotes', () => {
      const tsv = `Customer\tPhone\tBill No\tAmount\n"Apex Steel, Ltd"\t+919811223344\tINV-501\t500000`;
      const result = integrationService.parseCsvContent(tsv);

      expect(result.headers).toHaveLength(4);
      expect(result.rows[0]['Customer']).toBe('Apex Steel, Ltd');
      expect(result.rows[0]['Phone']).toBe('+919811223344');
    });

    it('should intelligently auto-detect column mapping', () => {
      const headers = [
        'Party Name',
        'Contact Number',
        'Voucher No',
        'Bill Date',
        'Payment Due Date',
        'Grand Total',
        'Amount Paid',
        'Tax ID',
      ];
      const mapping = integrationService.autoDetectColumnMapping(headers);

      expect(mapping.customerName).toBe('Party Name');
      expect(mapping.mobile).toBe('Contact Number');
      expect(mapping.invoiceNumber).toBe('Voucher No');
      expect(mapping.invoiceDate).toBe('Bill Date');
      expect(mapping.dueDate).toBe('Payment Due Date');
      expect(mapping.amount).toBe('Grand Total');
      expect(mapping.paidAmount).toBe('Amount Paid');
      expect(mapping.gstin).toBe('Tax ID');
    });

    it('should normalize various date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)', () => {
      expect(integrationService.normalizeDate('2026-10-25')).toBe('2026-10-25');
      expect(integrationService.normalizeDate('25/10/2026')).toBe('2026-10-25');
      expect(integrationService.normalizeDate('05-09-2026')).toBe('2026-09-05');
      expect(integrationService.normalizeDate('invalid-date')).toBeNull();
    });

    it('should validate CSV rows and accurately flag errors (missing mobile, negative amount, duplicate bill #)', () => {
      const rows = [
        {
          Cust: 'Good Customer',
          Phone: '9820011221',
          Inv: 'INV-VALID-01',
          Date: '2026-09-01',
          Due: '2026-10-01',
          Amt: '100000',
          Paid: '20000',
        },
        {
          Cust: 'Missing Phone Customer',
          Phone: '123', // Less than 10 digits
          Inv: 'INV-BAD-01',
          Date: '2026-09-01',
          Due: '2026-10-01',
          Amt: '50000',
          Paid: '0',
        },
        {
          Cust: 'Negative Amount Customer',
          Phone: '9820033445',
          Inv: 'INV-BAD-02',
          Date: '2026-09-01',
          Due: '2026-10-01',
          Amt: '-5000', // Invalid amount
          Paid: '0',
        },
        {
          Cust: 'Duplicate Invoice Customer',
          Phone: '9820055667',
          Inv: 'INV-VALID-01', // Duplicate of row 1
          Date: '2026-09-01',
          Due: '2026-10-01',
          Amt: '80000',
          Paid: '0',
        },
      ];

      const mapping = {
        customerName: 'Cust',
        mobile: 'Phone',
        invoiceNumber: 'Inv',
        invoiceDate: 'Date',
        dueDate: 'Due',
        amount: 'Amt',
        paidAmount: 'Paid',
      };

      const result = integrationService.validateCsvRows(rows, mapping);

      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(3);
      expect(result.rows[0].isValid).toBe(true);
      expect(result.rows[0].parsedRecord?.balance).toBe(80000);

      expect(result.rows[1].isValid).toBe(false);
      expect(result.rows[1].errors[0]).toContain('Mobile phone must contain at least 10 digits');

      expect(result.rows[2].isValid).toBe(false);
      expect(result.rows[2].errors[0]).toContain('Total amount must be greater than zero');

      expect(result.rows[3].isValid).toBe(false);
      expect(result.rows[3].errors[0]).toContain('Duplicate invoice number in batch');
    });

    it('should ingest validated CSV batch into RTDB and generate IngestionReport', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recalcSpy = vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const rows = [
        {
          rowIndex: 1,
          raw: {},
          isValid: true,
          errors: [],
          parsedRecord: {
            customerName: 'Tata Motors Industrial',
            mobile: '+919820011223',
            email: 'billing@tatamotors.com',
            gstin: '27AAACT1234A1Z5',
            invoiceNumber: 'INV-TM-01',
            invoiceDate: '2026-08-15',
            dueDate: '2026-09-15',
            amount: 500000,
            paidAmount: 100000,
            balance: 400000,
            currency: 'INR',
          },
        },
      ];

      const report = await integrationService.ingestCsvBatch('ten_test', rows);

      expect(report.status).toBe('SUCCESS');
      expect(report.customersUpserted).toBe(1);
      expect(report.invoicesUpserted).toBe(1);
      expect(recalcSpy).toHaveBeenCalledWith('ten_test');
      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('invoices/ten_test/inv_csv_inv_tm_01'),
        expect.objectContaining({
          source: 'excel',
          invoiceNumber: 'INV-TM-01',
          balance: 400000,
        })
      );
    });
  });

  // =========================================================================
  // 3. GOOGLE SHEETS INTEGRATION TESTS
  // =========================================================================
  describe('Google Sheets Integration', () => {
    it('should extract spreadsheet ID correctly from full Google Sheets URL or raw ID', () => {
      const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
      expect(integrationService.extractSpreadsheetId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

      const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      expect(integrationService.extractSpreadsheetId(rawId)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('should compute next scheduled sync interval properly', () => {
      const base = 1758760000000;
      expect(integrationService.calculateNextScheduledSync('NONE', base)).toBeUndefined();
      expect(integrationService.calculateNextScheduledSync('HOURLY', base)).toBe(base + 3600 * 1000);
      expect(integrationService.calculateNextScheduledSync('DAILY', base)).toBe(base + 24 * 3600 * 1000);
      expect(integrationService.calculateNextScheduledSync('WEEKLY', base)).toBe(base + 7 * 24 * 3600 * 1000);
    });

    it('should fetch and sync rows from Google Sheets, updating schedule and metrics', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'integrations/ten_test/sheets') {
          return {
            spreadsheetId: 'sheet_demo_123',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_demo_123',
            sheetName: 'Sheet1',
            status: 'CONNECTED',
            autoSyncInterval: 'DAILY',
            columnMapping: {
              customerName: 'Customer Name',
              mobile: 'Mobile Number',
              invoiceNumber: 'Invoice Number',
              invoiceDate: 'Invoice Date',
              dueDate: 'Due Date',
              amount: 'Total Amount',
              paidAmount: 'Paid Amount',
            },
          };
        }
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recalcSpy = vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const report = await integrationService.syncGoogleSheets('ten_test', [
        {
          'Customer Name': 'Larsen & Toubro EPC',
          'Mobile Number': '+919820099887',
          'Email': 'billing@lnt.com',
          'Invoice Number': 'GS-INV-999',
          'Invoice Date': '2026-08-01',
          'Due Date': '2026-09-01',
          'Total Amount': '750000',
          'Paid Amount': '0',
          'Currency': 'INR',
        },
      ]);

      expect(report.source).toBe('sheets');
      expect(report.customersUpserted).toBe(1);
      expect(report.invoicesUpserted).toBe(1);
      expect(recalcSpy).toHaveBeenCalledWith('ten_test');
      expect(setSpy).toHaveBeenCalledWith(
        'invoices/ten_test/inv_gs_gs_inv_999',
        expect.objectContaining({
          source: 'sheets',
          invoiceNumber: 'GS-INV-999',
          amount: 750000,
        })
      );
    });
  });

  // =========================================================================
  // 4. INGESTION HISTORY TESTS
  // =========================================================================
  describe('Ingestion History', () => {
    it('should retrieve ingestion history ordered by most recent first', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        rep_1: { jobId: 'rep_1', startedAt: 1000, source: 'zoho' },
        rep_2: { jobId: 'rep_2', startedAt: 3000, source: 'excel' },
        rep_3: { jobId: 'rep_3', startedAt: 2000, source: 'sheets' },
      });

      const history = await integrationService.getIngestionHistory('ten_test');
      expect(history).toHaveLength(3);
      expect(history[0].jobId).toBe('rep_2');
      expect(history[1].jobId).toBe('rep_3');
      expect(history[2].jobId).toBe('rep_1');
    });
  });
});
