import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { CompanySetupPage } from './pages/tenant/CompanySetupPage';
import { TeamManagementPage } from './pages/tenant/TeamManagementPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InvoicesPage } from './pages/invoices/InvoicesPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { ReconciliationPage } from './pages/reconciliation/ReconciliationPage';
import { RemindersPage } from './pages/reminders/RemindersPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { CopilotPage } from './pages/copilot/CopilotPage';
import { IntegrationsPage } from './pages/integrations/IntegrationsPage';
import { PartnerPortalPage } from './pages/partner/PartnerPortalPage';
import { BillingPage } from './pages/billing/BillingPage';
import { ObservabilityPage } from './pages/observability/ObservabilityPage';
import { SecurityPage } from './pages/security/SecurityPage';
import { PilotPage } from './pages/pilot/PilotPage';
import { SettingsPage } from './pages/settings/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <TenantProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected Onboarding Route */}
              <Route
                path="/company-setup"
                element={
                  <ProtectedRoute>
                    <RoleGuard allowedRoles={['OWNER', 'ADMIN']} areaName="Company Setup">
                      <CompanySetupPage />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              {/* Protected App Routes with Strict Role-Based Menu Area Access */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route
                  path="invoices"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER']}
                      areaName="Invoices & Aging"
                    >
                      <InvoicesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="customers"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER']}
                      areaName="Customers 360"
                    >
                      <CustomersPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="payments"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER']}
                      areaName="Payments & UPI"
                    >
                      <PaymentsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="reconciliation"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER', 'PARTNER']}
                      areaName="Reconciliation"
                    >
                      <ReconciliationPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="reminders"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE']}
                      areaName="WhatsApp Reminders"
                    >
                      <RemindersPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER']}
                      areaName="Collection Intelligence"
                    >
                      <AnalyticsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="copilot"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER']}
                      areaName="AI Copilot"
                    >
                      <CopilotPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="integrations"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER']}
                      areaName="Integrations & Import"
                    >
                      <IntegrationsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="partner"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'PARTNER']}
                      areaName="CA / Partner Portal"
                    >
                      <PartnerPortalPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="billing"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN']}
                      areaName="Billing & Plans"
                    >
                      <BillingPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="observability"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN']}
                      areaName="Operations & Health"
                    >
                      <ObservabilityPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="security"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'PARTNER']}
                      areaName="Security & Compliance"
                    >
                      <SecurityPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="pilot"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN']}
                      areaName="Pilot Operations"
                    >
                      <PilotPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="team"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN']}
                      areaName="Team & Roles"
                    >
                      <TeamManagementPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RoleGuard
                      allowedRoles={['OWNER', 'ADMIN', 'MANAGER']}
                      areaName="Settings & Sync"
                    >
                      <SettingsPage />
                    </RoleGuard>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

export default App;
