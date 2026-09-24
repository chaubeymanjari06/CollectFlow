import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from '../../pages/analytics/AnalyticsPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { collectionIntelligenceService } from '../../services/collectionIntelligenceService';

describe('AnalyticsPage Component (Phase 11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render DSO, collection efficiency, and prioritized follow-up queue', async () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'ten_1', name: 'Alpha Traders', currency: 'INR' } as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'MANAGER',
      isOwner: false,
      isAdmin: false,
      isManager: true,
      isExecutive: true,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn(),
      hasPermission: vi.fn(),
    });

    vi.spyOn(collectionIntelligenceService, 'getCollectionIntelligence').mockResolvedValue({
      dso: 38,
      collectionEfficiencyPct: 82,
      overduePercentage: 24,
      totalReceivables: 500000,
      totalOverdue: 120000,
      atRiskCapital: 45000,
      riskBreakdown: {
        low: 8,
        medium: 3,
        high: 2,
        critical: 1,
      },
      agingDistribution: {
        current: 300000,
        days1_30: 80000,
        days31_60: 75000,
        days61_90: 30000,
        days90Plus: 15000,
      },
      priorityQueue: [
        {
          customerId: 'cust_pri_1',
          customerName: 'Shree Krishna Logistics',
          mobile: '+919988112233',
          overdueBalance: 120000,
          totalReceivable: 150000,
          maxOverdueDays: 45,
          brokenPtpCount: 1,
          priorityScore: 78,
          urgency: 'CRITICAL',
          contributingFactors: [
            'Overdue balance of ₹1,20,000',
            'Oldest bill past due by 45 days',
            '1 unfulfilled Promise-to-Pay (PTP) commitment(s)',
          ],
          recommendedAction: 'Immediate phone escalation by Accounts Manager',
        },
      ],
    });

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Collection Intelligence & Priority Engine')).toBeInTheDocument();
    expect(screen.getByText('Days Sales Outstanding (DSO)')).toBeInTheDocument();
    expect(screen.getByText('Collection Efficiency (CEI)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('38 Days')).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
      expect(screen.getByText('Shree Krishna Logistics')).toBeInTheDocument();
      expect(screen.getByText(/Priority Score: 78/)).toBeInTheDocument();
      expect(screen.getByText('• Overdue balance of ₹1,20,000')).toBeInTheDocument();
      expect(screen.getByText('Immediate phone escalation by Accounts Manager')).toBeInTheDocument();
    });
  });
});
