import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncService } from '../../services/syncService';
import { dbService } from '../../services/dbService';
import { receivablesService } from '../../services/receivablesService';

describe('Tally Windows Agent & Data Sync Engine (Phase 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register a new workstation device and mark tallyConnected on tenant', async () => {
    const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

    const device = await syncService.registerDevice('ten_1', {
      deviceName: 'ACCOUNTS-DESKTOP-01',
      tallyHost: 'localhost:9000',
      activeCompany: 'Shree Enterprises 2026-27',
    });

    expect(device.deviceId).toMatch(/^dev_/);
    expect(device.deviceName).toBe('ACCOUNTS-DESKTOP-01');
    expect(device.status).toBe('ONLINE');

    expect(setSpy).toHaveBeenCalledWith(
      expect.stringContaining('devices/ten_1/dev_'),
      expect.objectContaining({ deviceName: 'ACCOUNTS-DESKTOP-01' })
    );

    expect(updateSpy).toHaveBeenCalledWith('tenants/ten_1', { tallyConnected: true });
  });

  it('should ingest sync batch, upsert records, recalculate receivables, and log sync job', async () => {
    vi.spyOn(dbService, 'get').mockResolvedValue(null);
    const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
    vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
    const recalcSpy = vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

    const job = await syncService.ingestSyncBatch('ten_1', 'dev_123', {
      syncType: 'INCREMENTAL',
      customers: [
        {
          sourceCustomerId: 'LEDG_100',
          name: 'Acme Traders',
          mobile: '+919876543210',
          creditLimit: 200000,
          paymentTerms: 30,
        },
      ],
      invoices: [
        {
          sourceRecordId: 'VOUCH_900',
          sourceCustomerId: 'LEDG_100',
          customerName: 'Acme Traders',
          invoiceNumber: 'INV-900',
          invoiceDate: '2026-09-01',
          dueDate: '2026-10-01',
          amount: 55000,
        },
      ],
    });

    expect(job.status).toBe('COMPLETED');
    expect(job.recordsUpserted).toBe(2);
    expect(recalcSpy).toHaveBeenCalledWith('ten_1');
    expect(setSpy).toHaveBeenCalledWith(
      expect.stringContaining('syncJobs/ten_1/job_'),
      expect.objectContaining({ recordsUpserted: 2 })
    );
  });
});
