import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ObservabilityPage } from '../../pages/observability/ObservabilityPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { observabilityService } from '../../services/observabilityService';

describe('ObservabilityPage Component (Phase 16)', () => {
  const mockTenant = {
    tenantId: 'ten_demo_corp',
    name: 'Apex Steel & Industrial Supplies Pvt Ltd',
    currency: 'INR',
  };

  const mockMetrics = {
    healthScore: 98,
    apiHealth: {
      requestsLast24h: 1845,
      errorRate4xxPct: 0.8,
      errorRate5xxPct: 0.12,
      p50LatencyMs: 42,
      p95LatencyMs: 148,
      p99LatencyMs: 310,
    },
    whatsAppDelivery: {
      totalDispatched: 320,
      deliveredCount: 312,
      deliveryRatePct: 97.5,
      readCount: 268,
      failedCount: 6,
      bouncedCount: 2,
      templateRejections: 0,
    },
    paymentWebhooks: {
      totalReceived: 84,
      processedCount: 83,
      failedSignatures: 0,
      duplicateDropped: 1,
      avgProcessingMs: 68,
    },
    reconciliationHealth: {
      autoMatchedCount: 76,
      pendingReviewCount: 7,
      unmatchedCount: 1,
      failureExceptionsCount: 0,
    },
    databaseUsage: {
      totalNodes: 1240,
      estimatedSizeMB: 18.4,
      connectionsActive: 4,
      readsPerSec: 14.2,
      writesPerSec: 2.8,
    },
    cloudFunctions: {
      invocationsCount: 48,
      avgExecutionDurationMs: 124,
      errorCount: 0,
      errorRatePct: 0.4,
      coldStartsCount: 3,
    },
  };

  const mockAgents = [
    {
      deviceId: 'dev_test_01',
      deviceName: 'ACCOUNTS-PC-PRIMARY',
      tallyHost: 'localhost:9000',
      status: 'ONLINE' as const,
      lastHeartbeat: Date.now() - 30000,
      latencyMs: 38,
      odbcConnection: true,
      xmlEndpointStatus: 'OK' as const,
      activeCompany: 'Apex Steel & Industrial Supplies Pvt Ltd',
      agentVersion: 'v2.4.1',
      osPlatform: 'Windows 11 Pro',
      memoryUsagePct: 24,
      cpuUsagePct: 3.2,
      queueDepth: 0,
    },
  ];

  const mockLogs = [
    {
      logId: 'flog_01',
      functionName: 'onTallySyncBatch' as const,
      executionId: 'exec_sync_101',
      tenantId: 'ten_demo_corp',
      level: 'INFO' as const,
      message: 'Successfully ingested 42 customer ledgers and 88 open vouchers from Tally.',
      durationMs: 412,
      memoryUsageMB: 142,
      timestamp: Date.now() - 5 * 60000,
    },
    {
      logId: 'flog_02',
      functionName: 'sendWhatsAppReminder' as const,
      executionId: 'exec_wa_204',
      tenantId: 'ten_demo_corp',
      level: 'WARN' as const,
      message: 'High latency detected in Meta WhatsApp Cloud API response (840ms).',
      durationMs: 840,
      memoryUsageMB: 92,
      timestamp: Date.now() - 15 * 60000,
    },
  ];

  const mockAlerts = [
    {
      alertId: 'alt_01',
      tenantId: 'ten_demo_corp',
      source: 'TALLY_AGENT' as const,
      severity: 'WARNING' as const,
      title: 'Tally ODBC High Latency Detected',
      message: 'Workstation ACCOUNTS-PC-PRIMARY query latency exceeded 1,000ms threshold.',
      errorCode: 'ERR_TALLY_ODBC_REFUSED',
      resolved: false,
      createdAt: Date.now() - 60 * 60000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock URL object methods for download
    window.URL.createObjectURL = vi.fn().mockReturnValue('mock-blob-url');
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: { uid: 'usr_admin', email: 'admin@apexsteel.com' } as any,
      userProfile: { userId: 'usr_admin', name: 'Rajesh Sharma', email: 'admin@apexsteel.com' } as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: mockTenant as any,
      activeMembership: null,
      availableTenants: [mockTenant as any],
      loadingTenants: false,
      role: 'OWNER',
      isOwner: true,
      isAdmin: false,
      isManager: false,
      isExecutive: false,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn().mockReturnValue(true),
    });

    vi.spyOn(observabilityService, 'getObservabilityMetrics').mockResolvedValue(mockMetrics);
    vi.spyOn(observabilityService, 'getAgentDiagnostics').mockResolvedValue(mockAgents);
    vi.spyOn(observabilityService, 'getFunctionLogs').mockResolvedValue(mockLogs);
    vi.spyOn(observabilityService, 'getSystemAlerts').mockResolvedValue(mockAlerts);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <ObservabilityPage />
      </MemoryRouter>
    );

  it('should render the Observability page with header, health score, and metric counters', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Observability & Operations')).toBeInTheDocument();
      expect(screen.getByText('Phase 16 Mission Control')).toBeInTheDocument();
    });

    // Check health strip
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('System Health Score')).toBeInTheDocument();
    expect(screen.getByText('148ms')).toBeInTheDocument(); // API p95
    expect(screen.getAllByText('97.5%').length).toBeGreaterThanOrEqual(1); // WhatsApp delivery
    expect(screen.getByText('1 Unresolved')).toBeInTheDocument(); // Alerts count
  });

  it('should display overview telemetry cards and trigger force resync', async () => {
    const retrySyncSpy = vi.spyOn(observabilityService, 'retryFailedSync').mockResolvedValue({
      success: true,
      message: 'Sync batch retried successfully. Upserted 52 records.',
      syncJob: {} as any,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('WhatsApp Delivery Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Payment Webhooks Verification')).toBeInTheDocument();
      expect(screen.getByText('Realtime Database & Storage')).toBeInTheDocument();
    });

    const resyncBtn = screen.getByText('Force Resync Tally');
    fireEvent.click(resyncBtn);

    await waitFor(() => {
      expect(retrySyncSpy).toHaveBeenCalledWith('ten_demo_corp', 'job_manual_retry');
    });
  });

  it('should switch to Agent Diagnostics tab and run agent self-test', async () => {
    const selfTestSpy = vi.spyOn(observabilityService, 'runAgentDiagnosticSelfTest').mockResolvedValue({
      success: true,
      latencyMs: 32,
      tests: [
        { name: 'Tally ODBC Port Probe', status: 'PASSED', message: 'Socket connection established.' },
        { name: 'XML Envelope Ping', status: 'PASSED', message: 'Tally responded 200 OK.' },
        { name: 'Company Ledger Access', status: 'PASSED', message: 'Apex Steel company verified open.' },
        { name: 'Outbound HTTPS Telemetry', status: 'PASSED', message: 'Mutual TLS verified.' },
        { name: 'Windows Service Health', status: 'PASSED', message: 'Service running nominal.' },
      ],
    });

    renderComponent();

    const agentTabBtn = await screen.findByRole('button', { name: /Agent Diagnostics/i });
    fireEvent.click(agentTabBtn);

    await waitFor(() => {
      expect(screen.getByText('ACCOUNTS-PC-PRIMARY')).toBeInTheDocument();
      expect(screen.getByText('Connected (Port 9000)')).toBeInTheDocument();
    });

    // Click Run Agent Self-Test
    const selfTestBtn = screen.getByText('Run Agent Self-Test');
    fireEvent.click(selfTestBtn);

    await waitFor(() => {
      expect(selfTestSpy).toHaveBeenCalledWith('ten_demo_corp', 'dev_test_01');
      expect(screen.getByText(/Agent Connectivity Self-Test Output/i)).toBeInTheDocument();
    });
  });

  it('should switch to Cloud Functions Logs tab and filter logs', async () => {
    renderComponent();

    const logsTabBtn = await screen.findByRole('button', { name: /Cloud Functions Logs/i });
    fireEvent.click(logsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Successfully ingested 42 customer ledgers and 88 open vouchers from Tally.')).toBeInTheDocument();
      expect(screen.getByText('High latency detected in Meta WhatsApp Cloud API response (840ms).')).toBeInTheDocument();
    });

    // Test search filter
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'WhatsApp' } });

    await waitFor(() => {
      expect(screen.getByText('High latency detected in Meta WhatsApp Cloud API response (840ms).')).toBeInTheDocument();
      expect(screen.queryByText('Successfully ingested 42 customer ledgers and 88 open vouchers from Tally.')).not.toBeInTheDocument();
    });
  });

  it('should switch to Alerts tab and resolve active alert', async () => {
    const resolveSpy = vi.spyOn(observabilityService, 'resolveAlert').mockResolvedValue(undefined);

    renderComponent();

    const alertsTabBtn = await screen.findByRole('button', { name: /Alerts & Retry Controls/i });
    fireEvent.click(alertsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Tally ODBC High Latency Detected')).toBeInTheDocument();
      expect(screen.getByText('ERR_TALLY_ODBC_REFUSED')).toBeInTheDocument();
    });

    const resolveBtn = screen.getByText('Resolve');
    fireEvent.click(resolveBtn);

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith('ten_demo_corp', 'alt_01');
    });
  });

  it('should switch to Error Codes & Resolution tab and search catalog', async () => {
    renderComponent();

    const errorsTabBtn = await screen.findByRole('button', { name: /Error Codes & Resolution/i });
    fireEvent.click(errorsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Standard Error Codes & Remediation Directory')).toBeInTheDocument();
      expect(screen.getByText('Tally ODBC Connection Refused')).toBeInTheDocument();
    });

    // Search for WA
    const searchInput = screen.getByPlaceholderText('Search error codes...');
    fireEvent.change(searchInput, { target: { value: 'WA_TEMPLATE' } });

    await waitFor(() => {
      expect(screen.getByText('ERR_WA_TEMPLATE_REJECTED')).toBeInTheDocument();
      expect(screen.queryByText('ERR_TALLY_ODBC_REFUSED')).not.toBeInTheDocument();
    });
  });

  it('should trigger Export Diagnostics download bundle', async () => {
    const bundleSpy = vi.spyOn(observabilityService, 'generateDiagnosticBundle').mockResolvedValue({
      exportedAt: new Date().toISOString(),
      tenantId: 'ten_demo_corp',
      tenantName: 'Apex Steel Pvt Ltd',
      healthScore: 98,
      agentStatus: mockAgents,
      recentAlerts: mockAlerts,
      recentSyncHistory: [],
      recentFunctionLogs: mockLogs,
      systemMetrics: mockMetrics,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Export Diagnostics')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText('Export Diagnostics');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(bundleSpy).toHaveBeenCalledWith('ten_demo_corp');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
