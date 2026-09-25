import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SecurityPage } from '../../pages/security/SecurityPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { securityService } from '../../services/securityService';

describe('SecurityPage Component (Phase 17)', () => {
  const mockTenant = {
    tenantId: 'ten_demo_corp',
    name: 'Apex Steel & Industrial Supplies Pvt Ltd',
    currency: 'INR',
  };

  const mockSecrets = [
    {
      secretId: 'sec_01',
      tenantId: 'ten_demo_corp',
      type: 'TALLY_AGENT_AUTH_TOKEN' as const,
      name: 'Tally Windows Agent Mutual HMAC Key',
      maskedValue: 'cf_sec_tally_9a8f****************2b11',
      lastRotatedAt: Date.now() - 40 * 86400000,
      expiresAt: Date.now() + 50 * 86400000,
      status: 'ACTIVE' as const,
    },
    {
      secretId: 'sec_02',
      tenantId: 'ten_demo_corp',
      type: 'RAZORPAY_WEBHOOK_SECRET' as const,
      name: 'Razorpay AutoPay Inbound Webhook Signing Secret',
      maskedValue: 'cf_sec_razor_12ce****************8f99',
      lastRotatedAt: Date.now() - 30 * 86400000,
      expiresAt: Date.now() + 60 * 86400000,
      status: 'ACTIVE' as const,
    },
  ];

  const mockRateLimits = [
    {
      endpoint: '/api/v1/sync/tally-batch',
      maxRequestsPerMinute: 60,
      currentRequests: 14,
      blockedRequestsCount: 0,
      windowSeconds: 60,
      status: 'HEALTHY' as const,
    },
    {
      endpoint: '/api/v1/webhooks/payment',
      maxRequestsPerMinute: 300,
      currentRequests: 42,
      blockedRequestsCount: 0,
      windowSeconds: 60,
      status: 'HEALTHY' as const,
    },
  ];

  const mockAuditLogs = [
    {
      auditLogId: 'sec_aud_01',
      tenantId: 'ten_demo_corp',
      actorId: 'usr_admin',
      actorEmail: 'admin@apexsteel.com',
      action: 'LOGIN_MFA_SUCCESS' as const,
      resourceType: 'TENANT' as const,
      resourceId: 'ten_demo_corp',
      ipAddress: '103.21.124.8',
      timestamp: Date.now() - 60 * 60000,
    },
    {
      auditLogId: 'sec_aud_02',
      tenantId: 'ten_demo_corp',
      actorId: 'usr_system',
      actorEmail: 'system@collectflow.io',
      action: 'SECRET_ROTATED' as const,
      resourceType: 'SECRET' as const,
      resourceId: 'sec_01',
      ipAddress: '10.0.4.12',
      timestamp: Date.now() - 120 * 60000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

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

    vi.spyOn(securityService, 'getRotatableSecrets').mockResolvedValue(mockSecrets);
    vi.spyOn(securityService, 'getRateLimitStatus').mockResolvedValue(mockRateLimits);
    vi.spyOn(securityService, 'getSecurityAuditLogs').mockResolvedValue(mockAuditLogs);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <SecurityPage />
      </MemoryRouter>
    );

  it('should render the Security & Compliance page with posture strip and threat matrix', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Security, Governance & Compliance')).toBeInTheDocument();
      expect(screen.getByText('Phase 17 Hardening')).toBeInTheDocument();
    });

    // Check posture strip
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Grade A+ Hardened')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument(); // Tenant isolation
    expect(screen.getByText('Compliant')).toBeInTheDocument(); // DPDP Act 2023
  });

  it('should run automated multi-tenant boundary isolation probe', async () => {
    const probeSpy = vi.spyOn(securityService, 'verifyTenantIsolation').mockResolvedValue({
      passed: true,
      executedAt: Date.now(),
      checks: [
        { name: 'Cross-Tenant Read Isolation Probe', status: 'PASSED', details: 'Access Denied 403.' },
        { name: 'Cross-Tenant Write Mutation Barrier', status: 'PASSED', details: 'Write Blocked 403.' },
      ],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Run Isolation Probe')).toBeInTheDocument();
    });

    const probeBtn = screen.getByText('Run Isolation Probe');
    fireEvent.click(probeBtn);

    await waitFor(() => {
      expect(probeSpy).toHaveBeenCalledWith('ten_demo_corp', 'ten_external_target_99', 'usr_admin');
      expect(screen.getByText(/Multi-Tenant Boundary Isolation Self-Test Output/i)).toBeInTheDocument();
    });
  });

  it('should switch to Secrets tab and trigger cryptographic secret rotation', async () => {
    const rotateSpy = vi.spyOn(securityService, 'rotateSecret').mockResolvedValue({
      secretId: 'sec_01',
      tenantId: 'ten_demo_corp',
      type: 'TALLY_AGENT_AUTH_TOKEN',
      name: 'Tally Windows Agent Mutual HMAC Key',
      maskedValue: 'cf_sec_tally_new_key****************9988',
      lastRotatedAt: Date.now(),
      expiresAt: Date.now() + 90 * 86400000,
      status: 'ACTIVE',
    });

    renderComponent();

    const secretsTabBtn = await screen.findByRole('button', { name: /Secrets & Token Rotation/i });
    fireEvent.click(secretsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Tally Windows Agent Mutual HMAC Key')).toBeInTheDocument();
      expect(screen.getByText('Razorpay AutoPay Inbound Webhook Signing Secret')).toBeInTheDocument();
    });

    const rotateBtns = screen.getAllByText('Rotate Secret');
    fireEvent.click(rotateBtns[0]);

    await waitFor(() => {
      expect(rotateSpy).toHaveBeenCalledWith('ten_demo_corp', 'TALLY_AGENT_AUTH_TOKEN', 'usr_admin', 'admin@apexsteel.com');
      expect(screen.getByText(/rotated successfully/i)).toBeInTheDocument();
    });
  });

  it('should switch to Rate Limiting tab and display endpoint consumption', async () => {
    renderComponent();

    const rateTabBtn = await screen.findByRole('button', { name: /Rate Limiting & Anti-Abuse/i });
    fireEvent.click(rateTabBtn);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/sync/tally-batch')).toBeInTheDocument();
      expect(screen.getByText('/api/v1/webhooks/payment')).toBeInTheDocument();
      expect(screen.getAllByText('HEALTHY').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should switch to Audit Trail tab and filter logs', async () => {
    renderComponent();

    const auditTabBtn = await screen.findByRole('button', { name: /Audit Trail/i });
    fireEvent.click(auditTabBtn);

    await waitFor(() => {
      expect(screen.getByText('LOGIN_MFA_SUCCESS')).toBeInTheDocument();
      expect(screen.getByText('SECRET_ROTATED')).toBeInTheDocument();
    });

    // Test search filter
    const searchInput = screen.getByPlaceholderText('Search audit trail...');
    fireEvent.change(searchInput, { target: { value: 'MFA' } });

    await waitFor(() => {
      expect(screen.getByText('LOGIN_MFA_SUCCESS')).toBeInTheDocument();
      expect(screen.queryByText('SECRET_ROTATED')).not.toBeInTheDocument();
    });
  });

  it('should open Takeout Data Export modal and generate export request', async () => {
    const exportSpy = vi.spyOn(securityService, 'requestDataExport').mockResolvedValue({
      requestId: 'exp_991',
      tenantId: 'ten_demo_corp',
      requestedBy: 'admin@apexsteel.com',
      format: 'JSON',
      status: 'READY',
      downloadUrl: 'https://download-mock.com/takeout.zip',
      fileSizeBytes: 4821040,
      expiresAt: Date.now() + 7 * 86400000,
      createdAt: Date.now(),
    });

    renderComponent();

    const takeoutBtn = await screen.findByText('Data Takeout (Export)');
    fireEvent.click(takeoutBtn);

    await waitFor(() => {
      expect(screen.getByText('Request Data Takeout')).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Generate Takeout Archive');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith('ten_demo_corp', 'JSON', 'admin@apexsteel.com');
      expect(screen.getByText(/Takeout data export package ready/i)).toBeInTheDocument();
    });
  });

  it('should switch to Legal & DPA Policies tab and display policy documents', async () => {
    renderComponent();

    const legalTabBtn = await screen.findByRole('button', { name: /Legal & DPA Policies/i });
    fireEvent.click(legalTabBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Privacy Policy & Digital Personal Data Protection/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Terms of Service & SaaS Master Subscription Agreement/i)).toBeInTheDocument();
    });
  });
});
