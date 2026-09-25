import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntegrationsPage } from '../../pages/integrations/IntegrationsPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { integrationService } from '../../services/integrationService';

describe('IntegrationsPage Component (Phase 13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: {
        tenantId: 'ten_demo_corp',
        name: 'Apex Steel & Industrial Supplies Pvt Ltd',
        currency: 'INR',
        tallyConnected: true,
      } as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'ADMIN',
      isOwner: false,
      isAdmin: true,
      isManager: true,
      isExecutive: true,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn().mockReturnValue(true),
    });

    vi.spyOn(integrationService, 'getZohoConfig').mockResolvedValue({
      organizationId: '60012345678',
      organizationName: 'Apex Steel Zoho Books',
      clientId: '1000.CLIENT_ID_TEST',
      clientSecret: 'secret_test',
      status: 'CONNECTED',
      autoSyncEnabled: true,
      syncFrequencyMinutes: 60,
      lastSyncedAt: Date.now() - 3600000,
    });

    vi.spyOn(integrationService, 'getGoogleSheetsConfig').mockResolvedValue({
      spreadsheetId: 'sheet_demo_id',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_demo_id/edit',
      sheetName: 'Sheet1',
      status: 'CONNECTED',
      autoSyncInterval: 'DAILY',
      columnMapping: {},
    });

    vi.spyOn(integrationService, 'getIngestionHistory').mockResolvedValue([
      {
        jobId: 'job_test_01',
        tenantId: 'ten_demo_corp',
        source: 'zoho',
        sourceTitle: 'Zoho Books Cloud API Sync',
        startedAt: Date.now() - 7200000,
        completedAt: Date.now() - 7195000,
        totalProcessed: 15,
        customersUpserted: 5,
        invoicesUpserted: 8,
        paymentsUpserted: 2,
        failedCount: 0,
        status: 'SUCCESS',
        errors: [],
      },
    ]);
  });

  it('should render header, source badges, and tabs', async () => {
    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Integrations & Data Sources')).toBeInTheDocument();
    expect(screen.getByText('Phase 13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Zoho Books$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel \/ CSV Ingestion/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google Sheets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingestion History/i })).toBeInTheDocument();
  });

  it('should display Zoho Books status and granular sync endpoints when connected', async () => {
    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Zoho Books Cloud Integration')).toBeInTheDocument();
    });

    expect(screen.getByText('60012345678')).toBeInTheDocument();
    expect(screen.getByText('Sync Customers')).toBeInTheDocument();
    expect(screen.getByText('Sync Invoices')).toBeInTheDocument();
    expect(screen.getByText('Sync Payments')).toBeInTheDocument();
    expect(screen.getByText('Sync All Zoho Data')).toBeInTheDocument();
  });

  it('should trigger Zoho granular sync and show success alert', async () => {
    const syncInvoicesSpy = vi.spyOn(integrationService, 'syncZohoInvoices').mockResolvedValue(3);

    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sync Invoices')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sync Invoices'));

    await waitFor(() => {
      expect(syncInvoicesSpy).toHaveBeenCalledWith('ten_demo_corp');
      expect(screen.getByText(/Synced 3 invoices from Zoho Books/i)).toBeInTheDocument();
    });
  });

  it('should navigate through Excel/CSV Ingestion wizard', async () => {
    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    // Switch to CSV tab
    fireEvent.click(screen.getByRole('button', { name: /Excel \/ CSV Ingestion/i }));

    expect(screen.getByText('Upload Receivables Spreadsheet')).toBeInTheDocument();
    expect(screen.getByText('Load Sample MSME Dataset')).toBeInTheDocument();

    // Click Load Sample MSME Dataset
    fireEvent.click(screen.getByText('Load Sample MSME Dataset'));

    // Should transition to Step 2: Map Columns
    await waitFor(() => {
      expect(screen.getByText('Map Spreadsheet Columns to Schema')).toBeInTheDocument();
    });

    // Proceed to validation
    fireEvent.click(screen.getByText(/Validate & Preview Data/i));

    // Should transition to Step 3: Validate & Preview
    await waitFor(() => {
      expect(screen.getByText('Validation Results & Table Preview')).toBeInTheDocument();
      expect(screen.getByText(/Total Rows/i)).toBeInTheDocument();
    });
  });

  it('should switch to Google Sheets tab and allow configuration', async () => {
    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Google Sheets/i }));

    expect(screen.getByText('Google Sheets Direct Synchronization')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/docs.google.com\/spreadsheets/i)).toBeInTheDocument();
    expect(screen.getByText('Connect & Discover Headers')).toBeInTheDocument();
  });

  it('should display Ingestion History table with batch logs and status badges', async () => {
    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Ingestion History/i }));

    await waitFor(() => {
      expect(screen.getByText('Zoho Books Cloud API Sync')).toBeInTheDocument();
      expect(screen.getByText('job_test_01')).toBeInTheDocument();
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    });
  });
});
