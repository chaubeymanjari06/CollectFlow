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

    // Update user default tenant if empty
    const userProfile = await dbService.get<{ defaultTenantId?: string }>(`users/${userId}`);
    if (!userProfile?.defaultTenantId) {
      await dbService.update(`users/${userId}`, { defaultTenantId: tenantId });
    }

    return { tenant, membership };
  },

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return await dbService.get<Tenant>(`tenants/${tenantId}`);
  },

  async getUserMemberships(userId: string): Promise<TenantMembership[]> {
    // In RTDB, query memberships node for user memberships
    const allMemberships = await dbService.get<Record<string, Record<string, TenantMembership>>>('memberships');
    if (!allMemberships) return [];

    const userMemberships: TenantMembership[] = [];
    Object.entries(allMemberships).forEach(([tenantId, usersMap]) => {
      if (usersMap && usersMap[userId] && usersMap[userId].status === 'ACTIVE') {
        userMemberships.push({
          ...usersMap[userId],
          tenantId,
        });
      }
    });

    return userMemberships;
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
