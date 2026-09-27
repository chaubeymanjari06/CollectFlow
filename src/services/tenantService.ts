import { dbService } from './dbService';
import { Tenant, TenantMembership, UserRole } from '../types';

export function getDefaultPermissions(role: UserRole): TenantMembership['permissions'] {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return {
        readInvoices: true,
        writeInvoices: true,
        sendMessages: true,
        createPTP: true,
        approveReconciliation: true,
        manageIntegrations: true,
        manageBilling: true,
        manageUsers: true,
      };
    case 'MANAGER':
      return {
        readInvoices: true,
        writeInvoices: true,
        sendMessages: true,
        createPTP: true,
        approveReconciliation: true,
        manageIntegrations: false,
        manageBilling: false,
        manageUsers: false,
      };
    case 'EXECUTIVE':
      return {
        readInvoices: true,
        writeInvoices: false,
        sendMessages: true,
        createPTP: true,
        approveReconciliation: false,
        manageIntegrations: false,
        manageBilling: false,
        manageUsers: false,
      };
    case 'PARTNER':
    case 'VIEWER':
    default:
      return {
        readInvoices: true,
        writeInvoices: false,
        sendMessages: false,
        createPTP: false,
        approveReconciliation: false,
        manageIntegrations: false,
        manageBilling: false,
        manageUsers: false,
      };
  }
}

export const tenantService = {
  async createTenant(
    userId: string,
    data: {
      name: string;
      legalName?: string;
      gstin?: string;
      email: string;
      mobile: string;
      currency?: string;
      defaultPaymentTermsDays?: number;
    }
  ): Promise<{ tenant: Tenant; membership: TenantMembership }> {
    const now = Date.now();
    // Unique tenant ID
    const tenantId = `ten_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

    const tenant: Tenant = {
      tenantId,
      name: data.name,
      legalName: data.legalName || data.name,
      gstin: data.gstin || null,
      email: data.email,
      mobile: data.mobile,
      currency: data.currency || 'INR',
      timezone: 'Asia/Kolkata',
      planId: 'trial_free',
      status: 'ACTIVE',
      tallyConnected: false,
      settings: {
        defaultPaymentTermsDays: data.defaultPaymentTermsDays || 30,
        autoReconcileThreshold: 95,
        sendPreDueReminders: true,
        sendDueReminders: true,
        sendOverdueReminders: true,
        reminderChannel: 'WHATSAPP',
      },
      createdAt: now,
      updatedAt: now,
    };

    const membership: TenantMembership = {
      tenantId,
      userId,
      role: 'OWNER',
      permissions: getDefaultPermissions('OWNER'),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    // Save tenant and membership
    await dbService.set(`tenants/${tenantId}`, tenant);
    await dbService.set(`memberships/${tenantId}/${userId}`, membership);

    // Initial empty dashboard metrics
    await dbService.set(`dashboard/${tenantId}`, {
      totalReceivables: 0,
      overdueAmount: 0,
      dueTodayAmount: 0,
      dueThisWeekAmount: 0,
      collectedThisMonth: 0,
      openInvoicesCount: 0,
      overdueInvoicesCount: 0,
      activePtpCount: 0,
      brokenPtpCount: 0,
      dso: 0,
      agingBuckets: {
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
      },
      topOverdueCustomers: [],
      updatedAt: now,
    });

    // Save company into owner user profile and direct index for further logins
    await dbService.set(`users/${userId}/tenants/${tenantId}`, {
      tenantId,
      role: 'OWNER',
      name: data.name,
      createdAt: now,
    });

    await dbService.set(`userTenants/${userId}/${tenantId}`, {
      tenantId,
      role: 'OWNER',
      name: data.name,
      status: 'ACTIVE',
      createdAt: now,
    });

    await dbService.update(`users/${userId}`, {
      defaultTenantId: tenantId,
      companySetupCompleted: true,
      companySetupDate: now,
      updatedAt: now,
    });

    return { tenant, membership };
  },

  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant | null> {
    await dbService.update(`tenants/${tenantId}`, {
      ...data,
      updatedAt: Date.now(),
    });
    return await dbService.get<Tenant>(`tenants/${tenantId}`);
  },

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return await dbService.get<Tenant>(`tenants/${tenantId}`);
  },

  async getUserMemberships(userId: string): Promise<TenantMembership[]> {
    const membershipsMap: Record<string, TenantMembership> = {};

    // 1. Direct index lookup on user profile (avoids reading restricted global /memberships node)
    try {
      const userProfile = await dbService.get<{
        defaultTenantId?: string | null;
        tenants?: Record<string, { tenantId: string; role?: UserRole; name?: string; status?: string }>;
      }>(`users/${userId}`);

      if (userProfile?.tenants) {
        for (const [tId, tData] of Object.entries(userProfile.tenants)) {
          const directMem = await dbService.get<TenantMembership>(`memberships/${tId}/${userId}`);
          if (directMem && directMem.status === 'ACTIVE') {
            membershipsMap[tId] = { ...directMem, tenantId: tId };
          } else {
            const role = tData?.role || 'OWNER';
            membershipsMap[tId] = {
              tenantId: tId,
              userId,
              role,
              permissions: getDefaultPermissions(role),
              status: 'ACTIVE',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          }
        }
      }

      if (userProfile?.defaultTenantId && !membershipsMap[userProfile.defaultTenantId]) {
        const defId = userProfile.defaultTenantId;
        const directMem = await dbService.get<TenantMembership>(`memberships/${defId}/${userId}`);
        if (directMem && directMem.status === 'ACTIVE') {
          membershipsMap[defId] = { ...directMem, tenantId: defId };
        } else {
          membershipsMap[defId] = {
            tenantId: defId,
            userId,
            role: 'OWNER',
            permissions: getDefaultPermissions('OWNER'),
            status: 'ACTIVE',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        }
      }
    } catch (err) {
      console.warn('Direct user profile tenant lookup warning:', err);
    }

    // 2. Direct lookup on userTenants node
    try {
      const userTenantsIndex = await dbService.get<Record<string, { role?: UserRole; status?: string }>>(
        `userTenants/${userId}`
      );
      if (userTenantsIndex) {
        for (const [tId, tData] of Object.entries(userTenantsIndex)) {
          if (!membershipsMap[tId]) {
            const directMem = await dbService.get<TenantMembership>(`memberships/${tId}/${userId}`);
            if (directMem && directMem.status === 'ACTIVE') {
              membershipsMap[tId] = { ...directMem, tenantId: tId };
            } else {
              const role = tData?.role || 'OWNER';
              membershipsMap[tId] = {
                tenantId: tId,
                userId,
                role,
                permissions: getDefaultPermissions(role),
                status: 'ACTIVE',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('userTenants index lookup warning:', err);
    }

    // 3. Fallback: Query root memberships node if allowed (e.g. mock unit tests / admin context)
    try {
      const allMemberships = await dbService.get<Record<string, Record<string, TenantMembership>>>('memberships');
      if (allMemberships) {
        Object.entries(allMemberships).forEach(([tenantId, usersMap]) => {
          if (usersMap && usersMap[userId] && usersMap[userId].status === 'ACTIVE') {
            membershipsMap[tenantId] = {
              ...usersMap[userId],
              tenantId,
            };
          }
        });
      }
    } catch {
      // Expected when root /memberships node read is restricted by security rules
    }

    return Object.values(membershipsMap);
  },

  async inviteUser(
    tenantId: string,
    invitedByUserId: string,
    targetUserId: string,
    role: UserRole
  ): Promise<TenantMembership> {
    const now = Date.now();
    const membership: TenantMembership = {
      tenantId,
      userId: targetUserId,
      role,
      permissions: getDefaultPermissions(role),
      status: 'ACTIVE',
      invitedBy: invitedByUserId,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`memberships/${tenantId}/${targetUserId}`, membership);
    return membership;
  },

  async updateMemberRole(tenantId: string, userId: string, newRole: UserRole): Promise<void> {
    await dbService.update(`memberships/${tenantId}/${userId}`, {
      role: newRole,
      permissions: getDefaultPermissions(newRole),
      updatedAt: Date.now(),
    });
  },

  async removeMember(tenantId: string, userId: string): Promise<void> {
    await dbService.remove(`memberships/${tenantId}/${userId}`);
  }
};
