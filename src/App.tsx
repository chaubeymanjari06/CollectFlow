import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
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
import { SettingsPage } from './pages/settings/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
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
                  <CompanySetupPage />
                </ProtectedRoute>
              }
            />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="copilot" element={<CopilotPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="team" element={<TeamManagementPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
