import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiCopilotService } from '../../services/aiCopilotService';
import { dbService } from '../../services/dbService';
import { customer360Service } from '../../services/customer360Service';
import { reminderPtpService } from '../../services/reminderPtpService';

describe('aiCopilotService (Phase 12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('diagnoseCustomerAccount', () => {
    it('should diagnose overdue root causes, credit limit breach, and recommend strategies', async () => {
      vi.spyOn(customer360Service, 'getCustomer360').mockResolvedValue({
        customer: {
          customerId: 'cust_overdue_1',
          tenantId: 'ten_test',
          name: 'Apex Construction',
          creditLimit: 100000,
          paymentTerms: 30,
          status: 'ACTIVE',
        } as any,
        metrics: {
          totalBilled: 500000,
          totalPaid: 350000,
          outstandingBalance: 150000,
          overdueBalance: 120000,
          creditLimit: 100000,
          creditUtilizationPct: 150,
          averagePaymentDelayDays: 25,
          ptpSuccessRate: 40,
          riskTier: 'CRITICAL',
        },
        invoices: [
          {
            invoiceId: 'inv_1',
            invoiceNumber: 'INV-2026-001',
            status: 'OVERDUE',
            balance: 120000,
            daysPastDue: 65,
          } as any,
        ],
        promises: [
          {
            promiseId: 'ptp_broken_1',
            status: 'BROKEN',
            amount: 50000,
          } as any,
          {
            promiseId: 'ptp_broken_2',
            status: 'BROKEN',
            amount: 50000,
          } as any,
        ],
        payments: [],
        messages: [],
        reconciliations: [],
        ledgerEntries: [],
      });

      const diagnosis = await aiCopilotService.diagnoseCustomerAccount('ten_test', 'cust_overdue_1');

      expect(diagnosis).not.toBeNull();
      expect(diagnosis?.customerName).toBe('Apex Construction');
      expect(diagnosis?.riskAssessment.defaultProbability).toBe('HIGH');
      expect(diagnosis?.riskAssessment.creditUtilizationPct).toBe(150);
      expect(diagnosis?.riskAssessment.overdueDays).toBe(65);

      // Verify root causes identified
      expect(diagnosis?.rootCauses.some((c) => c.includes('Severe payment delay'))).toBe(true);
      expect(diagnosis?.rootCauses.some((c) => c.includes('Credit Limit Breached'))).toBe(true);
      expect(diagnosis?.rootCauses.some((c) => c.includes('Broken Commitments'))).toBe(true);
      expect(diagnosis?.rootCauses.some((c) => c.includes('Chronic payment friction'))).toBe(true);

      // Verify recommended strategies
      expect(diagnosis?.recommendedStrategy.some((s) => s.includes('Temporary Credit Hold'))).toBe(true);
      expect(diagnosis?.recommendedStrategy.some((s) => s.includes('Executive Escalation'))).toBe(true);
    });

    it('should return low default risk and benign summary for healthy accounts', async () => {
      vi.spyOn(customer360Service, 'getCustomer360').mockResolvedValue({
        customer: {
          customerId: 'cust_good',
          tenantId: 'ten_test',
          name: 'Reliable Corp',
          creditLimit: 200000,
          paymentTerms: 30,
        } as any,
        metrics: {
          totalBilled: 200000,
          totalPaid: 150000,
          outstandingBalance: 50000,
          overdueBalance: 0,
          creditLimit: 200000,
          creditUtilizationPct: 25,
          averagePaymentDelayDays: 2,
          ptpSuccessRate: 100,
          riskTier: 'LOW',
        },
        invoices: [],
        promises: [],
        payments: [],
        messages: [],
        reconciliations: [],
        ledgerEntries: [],
      });

      const diagnosis = await aiCopilotService.diagnoseCustomerAccount('ten_test', 'cust_good');
      expect(diagnosis?.riskAssessment.defaultProbability).toBe('LOW');
      expect(diagnosis?.riskAssessment.overdueDays).toBe(0);
      expect(diagnosis?.recommendedStrategy[0]).toContain('Routine courtesy statement');
    });
  });

  describe('draftSmartCollectionMessage', () => {
    beforeEach(() => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'customers/ten_test/cust_1') {
          return {
            customerId: 'cust_1',
            name: 'Delta Engineering',
            contactPerson: 'Rahul Sharma',
            mobile: '+919876543210',
            gstin: '27AAAAA0000A1Z5',
          };
        }
        if (path === 'invoices/ten_test') {
          return {
            inv_1: {
              invoiceId: 'inv_1',
              customerId: 'cust_1',
              invoiceNumber: 'INV-2026-101',
              balance: 75000,
              paymentLink: 'upi://pay?pa=delta@bank&am=75000',
            },
          };
        }
        if (path === 'tenants/ten_test') {
          return {
            tenantId: 'ten_test',
            name: 'Acme Supplies Ltd',
            settings: {
              payeeName: 'Acme Supplies',
              upiVpa: 'acme@icici',
            },
          };
        }
        return null;
      });
    });

    it('should generate draft with courteous tone', async () => {
      const draft = await aiCopilotService.draftSmartCollectionMessage('ten_test', 'cust_1', 'courteous');
      expect(draft?.recipientName).toBe('Delta Engineering');
      expect(draft?.tone).toBe('courteous');
      expect(draft?.content).toContain('friendly reminder');
      expect(draft?.content).toContain('INV-2026-101');
      expect(draft?.totalAmount).toBe(75000);
    });

    it('should generate draft with urgent escalation tone', async () => {
      const draft = await aiCopilotService.draftSmartCollectionMessage('ten_test', 'cust_1', 'urgent');
      expect(draft?.tone).toBe('urgent');
      expect(draft?.content).toContain('URGENT PAYMENT NOTICE');
      expect(draft?.content).toContain('credit line');
    });

    it('should generate draft with final demand tone', async () => {
      const draft = await aiCopilotService.draftSmartCollectionMessage('ten_test', 'cust_1', 'final_notice');
      expect(draft?.tone).toBe('final_notice');
      expect(draft?.content).toContain('FINAL DEMAND FOR PAYMENT');
      expect(draft?.content).toContain('48 hours');
    });
  });

  describe('extractPtpFromMessage (NLP)', () => {
    it('should extract amount in thousands (50k) and relative date (tomorrow)', () => {
      const result = aiCopilotService.extractPtpFromMessage('Will transfer 50k tomorrow through RTGS');
      expect(result.extractedAmount).toBe(50000);
      expect(result.extractedDate).not.toBeNull();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(60);
      expect(result.customerIntent).toContain('Customer commits to pay');
    });

    it('should extract amount in lakhs and explicit ISO date', () => {
      const result = aiCopilotService.extractPtpFromMessage('We will clear 2.5 lakh by 2026-11-20 positively');
      expect(result.extractedAmount).toBe(250000);
      expect(result.extractedDate).toBe('2026-11-20');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    });

    it('should extract currency format Rs. 1,20,000 and date in DD-MM-YYYY format', () => {
      const result = aiCopilotService.extractPtpFromMessage('Cheque of Rs. 1,20,000 will be deposited on 15-10-2026');
      expect(result.extractedAmount).toBe(120000);
      expect(result.extractedDate).toBe('2026-10-15');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
    });

    it('should handle general inquiries without payment commitment gracefully', () => {
      const result = aiCopilotService.extractPtpFromMessage('Please send revised statement of accounts with credit note');
      expect(result.extractedAmount).toBeNull();
      expect(result.extractedDate).toBeNull();
      expect(result.confidenceScore).toBeLessThan(40);
      expect(result.customerIntent).toContain('no clear payment commitment');
    });
  });

  describe('forecastCashFlow', () => {
    it('should project expected, conservative, and optimistic inflows based on PTPs and due invoices', async () => {
      const now = Date.now();
      const inFiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const inTenDays = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'promises/ten_test') {
          return {
            ptp_1: {
              promiseId: 'ptp_1',
              status: 'PENDING',
              amount: 100000,
              promisedDate: inFiveDays,
            },
          };
        }
        if (path === 'invoices/ten_test') {
          return {
            inv_1: {
              invoiceId: 'inv_1',
              balance: 200000,
              dueDate: inTenDays,
            },
          };
        }
        return null;
      });

      const forecast = await aiCopilotService.forecastCashFlow('ten_test', 30);

      expect(forecast.periodDays).toBe(30);
      expect(forecast.ptpBackedInflow).toBe(100000);
      expect(forecast.dueInvoiceInflow).toBe(200000);
      // Expected = 100000 * 0.85 + 200000 * 0.65 = 85000 + 130000 = 215000
      expect(forecast.expectedInflow).toBe(215000);
      // Conservative = 100000 * 0.70 + 200000 * 0.40 = 70000 + 80000 = 150000
      expect(forecast.conservativeInflow).toBe(150000);
      // Optimistic = 100000 * 1.0 + 200000 * 0.90 = 100000 + 180000 = 280000
      expect(forecast.optimisticInflow).toBe(280000);
      expect(forecast.assumptions.length).toBe(4);
    });
  });

  describe('generateManagementSummary', () => {
    it('should aggregate portfolio statistics, overdue percentage, and generate executive narrative', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'tenants/ten_test') {
          return { name: 'Zenith Metals' };
        }
        if (path === 'dashboard/ten_test') {
          return {
            totalReceivables: 1000000,
            overdueAmount: 300000,
            overdueInvoicesCount: 8,
            dso: 46,
            topOverdueCustomers: [
              {
                customerId: 'c1',
                name: 'Kisan Fertilisers',
                overdueAmount: 180000,
                oldestDueDate: '2026-08-01',
              },
            ],
          };
        }
        if (path === 'customers/ten_test') {
          return {
            c1: {
              customerId: 'c1',
              metrics: { overdueBalance: 180000 },
              creditLimit: 100000,
            },
          };
        }
        return {};
      });

      const summary = await aiCopilotService.generateManagementSummary('ten_test');

      expect(summary.tenantName).toBe('Zenith Metals');
      expect(summary.totalReceivables).toBe(1000000);
      expect(summary.overduePercentage).toBe(30);
      expect(summary.dso).toBe(46);
      expect(summary.criticalAccountsCount).toBe(1);
      expect(summary.topOverdueAccounts.length).toBe(1);
      expect(summary.executiveNarrative).toContain('Zenith Metals currently holds ₹10,00,000');
      expect(summary.suggestedActionItems.length).toBeGreaterThan(0);
    });
  });

  describe('dispatchDraftedMessage and confirmExtractedPtp', () => {
    it('should dispatch drafted message and save to RTDB', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue();
      vi.spyOn(dbService, 'get').mockResolvedValue({
        name: 'Om Enterprises',
        mobile: '+919988776655',
      });

      const message = await aiCopilotService.dispatchDraftedMessage('ten_test', 'cust_om', {
        content: 'Payment reminder for invoice #101',
        invoicesReferenced: ['INV-101'],
      });

      expect(setSpy).toHaveBeenCalled();
      expect(message.channel).toBe('WHATSAPP');
      expect(message.customerName).toBe('Om Enterprises');
      expect(message.content).toBe('Payment reminder for invoice #101');
    });

    it('should confirm extracted PTP and call reminderPtpService', async () => {
      const createPtpSpy = vi
        .spyOn(reminderPtpService, 'createPromiseToPay')
        .mockResolvedValue({
          promiseId: 'ptp_created_1',
          amount: 50000,
          promisedDate: '2026-10-10',
        } as any);

      const ptp = await aiCopilotService.confirmExtractedPtp('ten_test', {
        customerId: 'cust_om',
        customerName: 'Om Enterprises',
        amount: 50000,
        promisedDate: '2026-10-10',
      });

      expect(createPtpSpy).toHaveBeenCalled();
      expect(ptp.amount).toBe(50000);
      expect(ptp.promisedDate).toBe('2026-10-10');
    });
  });
});
