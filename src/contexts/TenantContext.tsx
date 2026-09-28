import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { tenantService } from '../services/tenantService';
import { Tenant, TenantMembership, UserRole } from '../types';

export interface TenantContextType {
  activeTenant: Tenant | null;
  activeMembership: TenantMembership | null;
  availableTenants: Tenant[];
  loadingTenants: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  isPartner: boolean;
  isViewer: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  createCompany: (data: {
    name: string;
    legalName?: string;
    gstin?: string;
    email: string;
    mobile: string;
    currency?: string;
    defaultPaymentTermsDays?: number;
  }) => Promise<Tenant>;
  updateCompany?: (data: Partial<Tenant>) => Promise<Tenant | null>;
  refreshTenantData: () => Promise<void>;
  hasPermission: (permissionKey: keyof TenantMembership['permissions']) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeMembership, setActiveMembership] = useState<TenantMembership | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const loadTenants = async () => {
    if (!currentUser) {
      setActiveTenant(null);
      setActiveMembership(null);
      setAvailableTenants([]);
      setLoadingTenants(false);
      return;
    }

    setLoadingTenants(true);
    try {
      const memberships = await tenantService.getUserMemberships(currentUser.uid);
      const tenantPromises = memberships.map((m) => tenantService.getTenant(m.tenantId));
      let tenantsList = (await Promise.all(tenantPromises)).filter((t): t is Tenant => t !== null);

      // Direct fallback: If user profile has saved defaultTenantId not yet in list, load directly
      const savedTenantId = userProfile?.defaultTenantId;
      if (savedTenantId && !tenantsList.some((t) => t.tenantId === savedTenantId)) {
        const directTenant = await tenantService.getTenant(savedTenantId);
        if (directTenant) {
          tenantsList = [directTenant, ...tenantsList];
        }
      }

      setAvailableTenants(tenantsList);

      // Determine active tenant: stored in profile or first available
      const initialTenant = (savedTenantId && tenantsList.find((t) => t.tenantId === savedTenantId)) || tenantsList[0] || null;

      if (initialTenant) {
        setActiveTenant(initialTenant);
        const mem = memberships.find((m) => m.tenantId === initialTenant.tenantId) || {
          tenantId: initialTenant.tenantId,
          userId: currentUser.uid,
          role: 'OWNER' as UserRole,
          permissions: {
            readInvoices: true,
            writeInvoices: true,
            sendMessages: true,
            createPTP: true,
            approveReconciliation: true,
            manageIntegrations: true,
            manageBilling: true,
            manageUsers: true,
          },
          status: 'ACTIVE' as const,
          createdAt: initialTenant.createdAt,
          updatedAt: initialTenant.updatedAt,
        };
        setActiveMembership(mem);
      } else {
        setActiveTenant(null);
        setActiveMembership(null);
      }
    } catch (err) {
      console.error('Failed to load user tenants:', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [currentUser, userProfile?.defaultTenantId]);

  const switchTenant = async (tenantId: string) => {
    const target = availableTenants.find((t) => t.tenantId === tenantId);
    if (!target || !currentUser) return;

    setActiveTenant(target);
    const memberships = await tenantService.getUserMemberships(currentUser.uid);
    const mem = memberships.find((m) => m.tenantId === target.tenantId) || null;
    setActiveMembership(mem);
  };

  const createCompany = async (data: {
    name: string;
    legalName?: string;
    gstin?: string;
    email: string;
    mobile: string;
    currency?: string;
    defaultPaymentTermsDays?: number;
  }) => {
    if (!currentUser) throw new Error('Must be logged in to create a company');
    const { tenant, membership } = await tenantService.createTenant(currentUser.uid, data);
    setAvailableTenants((prev) => [...prev.filter((t) => t.tenantId !== tenant.tenantId), tenant]);
    setActiveTenant(tenant);
    setActiveMembership(membership);
    if (refreshProfile) {
      try {
        await refreshProfile();
      } catch (e) {
        console.warn('Profile refresh notice:', e);
      }
    }
    return tenant;
  };

  const updateCompany = async (data: Partial<Tenant>): Promise<Tenant | null> => {
    if (!activeTenant) throw new Error('No active company to update');
    const updated = await tenantService.updateTenant(activeTenant.tenantId, data);
    if (updated) {
      setActiveTenant(updated);
      setAvailableTenants((prev) => prev.map((t) => (t.tenantId === updated.tenantId ? updated : t)));
    }
    return updated;
  };

  const refreshTenantData = async () => {
    await loadTenants();
  };

  const role = activeMembership?.role || null;
  const isOwner = role === 'OWNER';
  const isAdmin = isOwner || role === 'ADMIN';
  const isManager = isAdmin || role === 'MANAGER';
  const isExecutive = isManager || role === 'EXECUTIVE';
  const isPartner = role === 'PARTNER';
  const isViewer = role === 'VIEWER';

  const hasPermission = (permissionKey: keyof TenantMembership['permissions']): boolean => {
    if (isOwner) return true;
    if (!activeMembership?.permissions) return false;
    return !!activeMembership.permissions[permissionKey];
  };

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        activeMembership,
        availableTenants,
        loadingTenants,
        role,
        isOwner,
        isAdmin,
        isManager,
        isExecutive,
        isPartner,
        isViewer,
        switchTenant,
        createCompany,
        updateCompany,
        refreshTenantData,
        hasPermission,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
