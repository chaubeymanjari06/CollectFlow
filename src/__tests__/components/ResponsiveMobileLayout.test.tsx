import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Sidebar } from '../../components/layout/Sidebar';
import { AppLayout } from '../../components/layout/AppLayout';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import * as LanguageContextModule from '../../contexts/LanguageContext';

describe('Responsive Mobile Layout & Navigation Tests', () => {
  const createMockTenantContext = () => ({
    activeTenant: {
      tenantId: 'ten_demo',
      name: 'Shree Balaji Enterprises',
      tallyConnected: true,
      currency: 'INR',
    } as any,
    activeMembership: null,
    availableTenants: [
      { tenantId: 'ten_demo', name: 'Shree Balaji Enterprises', gstin: '24AAACB1234C1Z1' } as any,
    ],
    loadingTenants: false,
    role: 'OWNER' as any,
    isOwner: true,
    isAdmin: true,
    isManager: true,
    isExecutive: true,
    isPartner: false,
    isViewer: false,
    switchTenant: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),
    refreshTenantData: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
  });

  const createMockAuthContext = () => ({
    currentUser: { uid: 'user_1', email: 'owner@balaji.com' } as any,
    userProfile: { name: 'Ramesh Patel', email: 'owner@balaji.com', role: 'OWNER' } as any,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    refreshProfile: vi.fn(),
    loading: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(createMockTenantContext());
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(createMockAuthContext());
  });

  it('Navbar renders mobile hamburger toggle and executes onToggleMobileMenu', () => {
    const handleToggle = vi.fn();
    render(
      <MemoryRouter>
        <Navbar onToggleMobileMenu={handleToggle} />
      </MemoryRouter>
    );

    const hamburgerBtn = screen.getByTestId('navbar-mobile-menu-btn');
    expect(hamburgerBtn).toBeInTheDocument();
    fireEvent.click(hamburgerBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('Navbar renders responsive vernacular language switcher with compact mobile labels', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    // Checks that English/EN, Hindi/HI, Gujarati/GU are present
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('HI')).toBeInTheDocument();
    expect(screen.getByText('ગુજરાતી')).toBeInTheDocument();
    expect(screen.getByText('GU')).toBeInTheDocument();
  });

  it('Sidebar renders close button on mobile view when onClose is provided', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar onClose={handleClose} />
      </MemoryRouter>
    );

    const closeBtn = screen.getByTestId('sidebar-close-btn');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Sidebar fires onNavigate callback when clicking a navigation link', () => {
    const handleNavigate = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar onNavigate={handleNavigate} />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText('Dashboard');
    fireEvent.click(dashboardLink);
    expect(handleNavigate).toHaveBeenCalled();
  });

  it('AppLayout opens mobile drawer when hamburger is tapped and closes on backdrop click', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div data-testid="dashboard-content">Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Backdrop should not be present initially
    expect(screen.queryByTestId('sidebar-mobile-backdrop')).not.toBeInTheDocument();

    // Open mobile menu via hamburger button
    const hamburgerBtn = screen.getByTestId('navbar-mobile-menu-btn');
    fireEvent.click(hamburgerBtn);

    // Backdrop should now be visible
    const backdrop = screen.getByTestId('sidebar-mobile-backdrop');
    expect(backdrop).toBeInTheDocument();

    // Clicking the backdrop should close the drawer
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('sidebar-mobile-backdrop')).not.toBeInTheDocument();
  });
});
