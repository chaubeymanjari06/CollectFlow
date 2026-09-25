import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PilotPage } from '../../pages/pilot/PilotPage';
import { dbService } from '../../services/dbService';

describe('PilotPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
  });

  it('should render header banner, KPI metrics and pipeline tab', async () => {
    render(<PilotPage />);

    // Header banner
    expect(screen.getByText(/Phase 18 — Pilot Launch/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilot Operations & Cohort Hub/i)).toBeInTheDocument();

    // KPIs
    await waitFor(() => {
      expect(screen.getByText(/Active MSMEs/i)).toBeInTheDocument();
      expect(screen.getByText(/CA Partners/i)).toBeInTheDocument();
      expect(screen.getByText(/Sync Reliability/i)).toBeInTheDocument();
    });

    // Pipeline tab active by default
    expect(screen.getByText(/8-Step Pilot Pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Vardhaman Synthetics LLP/i)).toBeInTheDocument();
  });

  it('should switch to Controlled 10-Account Guardrail tab and toggle throttle', async () => {
    render(<PilotPage />);

    await waitFor(() => {
      expect(screen.getByText(/Controlled 10-Account Guardrail/i)).toBeInTheDocument();
    });

    // Click Guardrail tab
    fireEvent.click(screen.getByText(/Controlled 10-Account Guardrail/i));

    // Guardrail explanation & accounts table
    await waitFor(() => {
      expect(screen.getByText(/Controlled 10-Account Staged Rollout Guardrail/i)).toBeInTheDocument();
      expect(screen.getByText(/Shree Krishna Fabrics Pvt Ltd/i)).toBeInTheDocument();
    });

    // Toggle safety throttle
    const throttleButton = screen.getByRole('button', { name: /GUARDRAIL ACTIVE/i });
    expect(throttleButton).toBeInTheDocument();
    fireEvent.click(throttleButton);

    await waitFor(() => {
      expect(screen.getByText(/Controlled Throttle DISABLED/i)).toBeInTheDocument();
    });
  });

  it('should simulate safe test reminder to a controlled debtor account', async () => {
    render(<PilotPage />);

    // Switch to Guardrail tab
    await waitFor(() => {
      expect(screen.getByText(/Controlled 10-Account Guardrail/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Controlled 10-Account Guardrail/i));

    await waitFor(() => {
      expect(screen.getByText(/Shree Krishna Fabrics Pvt Ltd/i)).toBeInTheDocument();
    });

    const sendTestButtons = screen.getAllByRole('button', { name: /Send Test WhatsApp/i });
    expect(sendTestButtons.length).toBeGreaterThan(0);
    fireEvent.click(sendTestButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Safe test reminder delivered/i)).toBeInTheDocument();
    });
  });

  it('should switch to Industrial Clusters tab and display all 3 clusters', async () => {
    render(<PilotPage />);

    await waitFor(() => {
      expect(screen.getByText(/Industrial Clusters \(3\)/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Industrial Clusters \(3\)/i));

    await waitFor(() => {
      expect(screen.getByText(/Surat Textile Hub/i)).toBeInTheDocument();
      expect(screen.getByText(/Ludhiana Auto Component Cluster/i)).toBeInTheDocument();
      expect(screen.getByText(/Peenya Industrial Machinery Hub/i)).toBeInTheDocument();
    });
  });

  it('should switch to 30-Day Velocity & Analytics tab and display trajectory', async () => {
    render(<PilotPage />);

    await waitFor(() => {
      expect(screen.getByText(/30-Day Velocity & Analytics/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/30-Day Velocity & Analytics/i));

    await waitFor(() => {
      expect(screen.getByText(/30-Day Pilot Measurement Trajectory/i)).toBeInTheDocument();
      expect(screen.getByText(/Day 28 of 30/i)).toBeInTheDocument();
      expect(screen.getByText('Day 1')).toBeInTheDocument();
    });
  });

  it('should switch to Graduation Readiness Scorecard tab and show 6 criteria', async () => {
    render(<PilotPage />);

    await waitFor(() => {
      expect(screen.getByText(/Graduation Readiness Scorecard/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Graduation Readiness Scorecard/i));

    await waitFor(() => {
      expect(screen.getByText(/6-Point Production Readiness Gates/i)).toBeInTheDocument();
      expect(screen.getByText(/Tally Connector Sync Reliability/i)).toBeInTheDocument();
      expect(screen.getByText(/Ledger Parity & Data Validation/i)).toBeInTheDocument();
      expect(screen.getByText(/Promise-to-Pay \(PTP\) Fulfillment/i)).toBeInTheDocument();
    });
  });

  it('should switch to Support & Diagnostics tab, render tickets and resolve', async () => {
    render(<PilotPage />);

    await waitFor(() => {
      const ticketsTab = screen.getByRole('button', { name: /Support & Diagnostics/i });
      expect(ticketsTab).toBeInTheDocument();
      fireEvent.click(ticketsTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Pilot Support & Integration Queue/i)).toBeInTheDocument();
      expect(screen.getByText(/PILOT-TCK-101/i)).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByRole('button', { name: /Mark Resolved/i });
    if (resolveButtons.length > 0) {
      fireEvent.click(resolveButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/resolved successfully/i)).toBeInTheDocument();
      });
    }
  });
});
