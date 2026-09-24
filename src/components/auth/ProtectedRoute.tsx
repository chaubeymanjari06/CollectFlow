import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { activeTenant, loadingTenants } = useTenant();
  const location = useLocation();

  if (authLoading || (currentUser && loadingTenants)) {
    return <LoadingSpinner message="Authenticating session..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated but has no tenant, redirect to company onboarding
  if (!activeTenant && location.pathname !== '/company-setup') {
    return <Navigate to="/company-setup" replace />;
  }

  return <>{children}</>;
};
