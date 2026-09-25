import { describe, it, expect, vi, beforeEach } from 'vitest';
import { observabilityService, STANDARD_ERROR_CODES } from '../../services/observabilityService';
import { dbService } from '../../services/dbService';
import { syncService } from '../../services/syncService';

describe('Phase 16: Observability & Operations Service', () => {
  const tenantId = 'ten_test_corp';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
    vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
  });

  // =========================================================================
  // 1. ERROR CODES CATALOG
  // =========================================================================
  describe('Standard Error Codes Catalog', () => {
    it('should return complete catalog of standard error codes', () => {
      const catalog = observabilityService.getErrorCodesCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(8);
      const codes = catalog.map((c) => c.code);
      expect(codes).toContain('ERR_TALLY_ODBC_REFUSED');
      expect(codes).toContain('ERR_TALLY_AGENT_OFFLINE');
      expect(codes).toContain('ERR_WA_TEMPLATE_REJECTED');
      expect(codes).toContain('ERR_PAYMENT_WEBHOOK_SIG_INVALID');
      expect(codes).toContain('ERR_RECON_AMBIGUOUS_MATCH');
    });

    it('should retrieve detailed documentation for a specific error code', () => {
      const details = observabilityService.getErrorCodeDetails('ERR_TALLY_ODBC_REFUSED');
      expect(details).toBeDefined();
      expect(details?.category).toBe('TALLY');
      expect(details?.severity).toBe('CRITICAL');
      expect(details?.suggestedRemediation).toContain('port 9000');

      const nonExistent = observabilityService.getErrorCodeDetails('ERR_UNKNOWN_CODE');
      expect(nonExistent).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. OBSERVABILITY METRICS & HEALTH SCORING
  // =========================================================================
  describe('Observability Metrics & Health Score', () => {
    it('should compute health score and comprehensive system metrics', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `devices/${tenantId}`) {
          return {
            d1: {
              deviceId: 'd1',
              status: 'ONLINE',
              lastHeartbeat: Date.now() - 30000,
            },
          };
        }
        if (path === `systemAlerts/${tenantId}`) {
          return {
            a1: { alertId: 'a1', severity: 'WARNING', resolved: false },
          };
        }
        if (path === `syncJobs/${tenantId}`) {
          return {
            j1: { syncJobId: 'j1', status: 'SUCCESS' },
            j2: { syncJobId: 'j2', status: 'SUCCESS' },
          };
        }
        if (path === `functionLogs/${tenantId}`) {
          return {
            l1: { logId: 'l1', level: 'INFO' },
            l2: { logId: 'l2', level: 'ERROR' },
          };
        }
        return null;
      });

      const metrics = await observabilityService.getObservabilityMetrics(tenantId);

      // Has active device (no -20), 1 unresolved warning (-5) -> 95%
      expect(metrics.healthScore).toBe(95);
      expect(metrics.apiHealth.p95LatencyMs).toBe(148);
      expect(metrics.whatsAppDelivery.deliveryRatePct).toBe(97.5);
      expect(metrics.paymentWebhooks.processedCount).toBe(83);
      expect(metrics.databaseUsage.totalNodes).toBe(1240);
      expect(metrics.cloudFunctions.errorCount).toBe(1);
    });

    it('should reduce health score when agent is offline or critical alerts exist', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `devices/${tenantId}`) {
          return {
            d1: { deviceId: 'd1', status: 'OFFLINE', lastHeartbeat: Date.now() - 3600000 },
          };
        }
        if (path === `systemAlerts/${tenantId}`) {
          return {
            c1: { alertId: 'c1', severity: 'CRITICAL', resolved: false },
            c2: { alertId: 'c2', severity: 'CRITICAL', resolved: false },
          };
        }
        return null;
      });

      const metrics = await observabilityService.getObservabilityMetrics(tenantId);
      // 100 - 20 (no active device) - 30 (2 critical alerts * 15) = 50%
      expect(metrics.healthScore).toBe(50);
    });
  });

  // =========================================================================
  // 3. AGENT DIAGNOSTICS & TELEMETRY PROBES
  // =========================================================================
  describe('Agent Diagnostics & Self-Test', () => {
    it('should return fallback probe when no devices are registered', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);

      const probes = await observabilityService.getAgentDiagnostics(tenantId);
      expect(probes).toHaveLength(1);
      expect(probes[0].deviceName).toBe('ACCOUNTS-PC-PRIMARY');
      expect(probes[0].status).toBe('ONLINE');
      expect(probes[0].odbcConnection).toBe(true);
    });

    it('should return live diagnostics for registered devices', async () => {
      const now = Date.now();
      vi.spyOn(dbService, 'get').mockResolvedValue({
        dev_01: {
          deviceId: 'dev_01',
          deviceName: 'DESKTOP-BILLING-01',
          tallyHost: '192.168.1.100:9000',
          status: 'ONLINE',
          lastHeartbeat: now - 30000,
          activeCompany: 'Shree Enterprises',
          agentVersion: 'v2.4.1',
          osVersion: 'Windows 10 Pro',
        },
      });

      const probes = await observabilityService.getAgentDiagnostics(tenantId);
      expect(probes).toHaveLength(1);
      expect(probes[0].deviceId).toBe('dev_01');
      expect(probes[0].status).toBe('ONLINE');
      expect(probes[0].odbcConnection).toBe(true);
      expect(probes[0].activeCompany).toBe('Shree Enterprises');
    });

    it('should execute agent diagnostic self-test probe and update heartbeat', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        dev_01: {
          deviceId: 'dev_01',
          tallyHost: 'localhost:9000',
          activeCompany: 'Apex Steel',
        },
      });
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const res = await observabilityService.runAgentDiagnosticSelfTest(tenantId, 'dev_01');
      expect(res.success).toBe(true);
      expect(res.tests).toHaveLength(5);
      expect(res.tests.every((t) => t.status === 'PASSED')).toBe(true);
      expect(res.latencyMs).toBeGreaterThan(0);

      expect(updateSpy).toHaveBeenCalledWith(
        `devices/${tenantId}/dev_01`,
        expect.objectContaining({ status: 'ONLINE' })
      );
    });
  });

  // =========================================================================
  // 4. CLOUD FUNCTIONS LOGS EXPLORER
  // =========================================================================
  describe('Cloud Functions Logs Explorer', () => {
    it('should record a new function execution log', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const log = await observabilityService.logFunctionExecution(tenantId, {
        functionName: 'onTallySyncBatch',
        executionId: 'exec_test_01',
        tenantId,
        level: 'INFO',
        message: 'Batch sync test execution succeeded.',
        durationMs: 340,
        memoryUsageMB: 112,
      });

      expect(log.logId).toMatch(/^flog_/);
      expect(log.functionName).toBe('onTallySyncBatch');
      expect(log.durationMs).toBe(340);
      expect(setSpy).toHaveBeenCalledWith(
        `functionLogs/${tenantId}/${log.logId}`,
        log
      );
    });

    it('should filter logs by function name, level, and limit', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        l1: { logId: 'l1', functionName: 'onTallySyncBatch', level: 'INFO', timestamp: 1000 },
        l2: { logId: 'l2', functionName: 'sendWhatsAppReminder', level: 'WARN', timestamp: 2000 },
        l3: { logId: 'l3', functionName: 'onTallySyncBatch', level: 'ERROR', timestamp: 3000 },
      });

      const syncOnly = await observabilityService.getFunctionLogs(tenantId, {
        functionName: 'onTallySyncBatch',
      });
      expect(syncOnly).toHaveLength(2);

      const errorOnly = await observabilityService.getFunctionLogs(tenantId, {
        level: 'ERROR',
      });
      expect(errorOnly).toHaveLength(1);
      expect(errorOnly[0].logId).toBe('l3');

      const limited = await observabilityService.getFunctionLogs(tenantId, { limit: 1 });
      expect(limited).toHaveLength(1);
      expect(limited[0].logId).toBe('l3'); // Most recent first
    });
  });

  // =========================================================================
  // 5. SYSTEM FAILURE ALERTS
  // =========================================================================
  describe('System Failure Alerts', () => {
    it('should create a new system alert', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const alert = await observabilityService.createAlert(tenantId, {
        tenantId,
        source: 'TALLY_AGENT',
        severity: 'CRITICAL',
        title: 'ODBC Connection Down',
        message: 'Port 9000 unreachable',
        errorCode: 'ERR_TALLY_ODBC_REFUSED',
      });

      expect(alert.alertId).toMatch(/^alt_/);
      expect(alert.resolved).toBe(false);
      expect(alert.severity).toBe('CRITICAL');
      expect(setSpy).toHaveBeenCalledWith(
        `systemAlerts/${tenantId}/${alert.alertId}`,
        alert
      );
    });

    it('should resolve an existing alert', async () => {
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      await observabilityService.resolveAlert(tenantId, 'alt_123');

      expect(updateSpy).toHaveBeenCalledWith(
        `systemAlerts/${tenantId}/alt_123`,
        expect.objectContaining({ resolved: true })
      );
    });
  });

  // =========================================================================
  // 6. OPERATIONAL RETRY CONTROLS
  // =========================================================================
  describe('Operational Retry Controls', () => {
    it('should trigger retryFailedSync and log execution', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        tenantId,
        name: 'Apex Steel',
      });
      vi.spyOn(syncService, 'runSimulatedTallySync').mockResolvedValue({
        syncJobId: 'sync_retried',
        recordsUpserted: 48,
        status: 'SUCCESS',
      } as any);
      const logSpy = vi.spyOn(observabilityService, 'logFunctionExecution').mockResolvedValue({} as any);

      const res = await observabilityService.retryFailedSync(tenantId, 'sync_failed_01');

      expect(res.success).toBe(true);
      expect(res.syncJob.recordsUpserted).toBe(48);
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ functionName: 'onTallySyncBatch' })
      );
    });

    it('should re-dispatch payment webhook on retry', async () => {
      const logSpy = vi.spyOn(observabilityService, 'logFunctionExecution').mockResolvedValue({} as any);

      const res = await observabilityService.retryPaymentWebhook(tenantId, 'wh_failed_02');
      expect(res.success).toBe(true);
      expect(res.message).toContain('re-dispatched');
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ functionName: 'processPaymentWebhook' })
      );
    });

    it('should retry failed WhatsApp message delivery', async () => {
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      const logSpy = vi.spyOn(observabilityService, 'logFunctionExecution').mockResolvedValue({} as any);

      const res = await observabilityService.retryFailedWhatsAppMessage(tenantId, 'msg_01');
      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        `messages/${tenantId}/msg_01`,
        expect.objectContaining({ status: 'DELIVERED' })
      );
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ functionName: 'sendWhatsAppReminder' })
      );
    });
  });

  // =========================================================================
  // 7. EXPORT DIAGNOSTIC BUNDLE
  // =========================================================================
  describe('Export Diagnostic Bundle', () => {
    it('should assemble a complete diagnostic bundle for support escalation', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `tenants/${tenantId}`) return { tenantId, name: 'Apex Steel Pvt Ltd' };
        if (path === `syncJobs/${tenantId}`) return { j1: { syncJobId: 'j1', startedAt: 1000 } };
        return null;
      });

      const bundle = await observabilityService.generateDiagnosticBundle(tenantId);

      expect(bundle.tenantId).toBe(tenantId);
      expect(bundle.tenantName).toBe('Apex Steel Pvt Ltd');
      expect(bundle.healthScore).toBeGreaterThanOrEqual(0);
      expect(bundle.agentStatus).toBeDefined();
      expect(bundle.systemMetrics).toBeDefined();
      expect(bundle.exportedAt).toBeDefined();
    });
  });
});
