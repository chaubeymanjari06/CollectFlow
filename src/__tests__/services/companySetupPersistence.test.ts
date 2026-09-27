import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantService } from '../../services/tenantService';
import { dbService } from '../../services/dbService';
import { Tenant, UserProfile } from '../../types';

describe('Owner Company Setup Database Persistence & Multi-Session Login Re-use', () => {
  const userId = 'user_owner_001';
  const tenantId = 'ten_shree_enterprises_123';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'set').mockResolvedValue();
    vi.spyOn(dbService, 'update').mockResolvedValue();
    vi.spyOn(dbService, 'remove').mockResolvedValue();
    vi.spyOn(dbService, 'push').mockResolvedValue('mock_push_id');
  });

  describe('Single-Save Company Setup Persistence to Database', () => {
    it('should save company into database, assign OWNER role, and update user profile on setup', async () => {
      const recordedSets: Record<string, any> = {};
      const recordedUpdates: Record<string, any> = {};

      vi.spyOn(dbService, 'set').mockImplementation(async (path: string, data: any) => {
        recordedSets[path] = data;
      });

      vi.spyOn(dbService, 'update').mockImplementation(async (path: string, data: any) => {
        recordedUpdates[path] = data;
      });

      const { tenant, membership } = await tenantService.createTenant(userId, {
        name: 'Shree Balaji Steels',
        legalName: 'Shree Balaji Steels Pvt Ltd',
        gstin: '27AABCS1429B1Z',
        email: 'accounts@balajisteels.com',
        mobile: '+919820012345',
        currency: 'INR',
        defaultPaymentTermsDays: 45,
      });

      // 1. Verify tenant object saved in database under tenants/{tenantId}
      expect(tenant.name).toBe('Shree Balaji Steels');
      expect(tenant.legalName).toBe('Shree Balaji Steels Pvt Ltd');
      expect(tenant.gstin).toBe('27AABCS1429B1Z');
      expect(tenant.settings.defaultPaymentTermsDays).toBe(45);
      expect(recordedSets[`tenants/${tenant.tenantId}`]).toBeDefined();
      expect(recordedSets[`tenants/${tenant.tenantId}`].name).toBe('Shree Balaji Steels');

      // 2. Verify membership saved under memberships/{tenantId}/{userId}
      expect(membership.role).toBe('OWNER');
      expect(membership.permissions.manageUsers).toBe(true);
      expect(membership.permissions.manageBilling).toBe(true);
      expect(recordedSets[`memberships/${tenant.tenantId}/${userId}`]).toBeDefined();

      // 3. Verify user's direct tenant link stored in users/{userId}/tenants/{tenantId}
      expect(recordedSets[`users/${userId}/tenants/${tenant.tenantId}`]).toBeDefined();
      expect(recordedSets[`users/${userId}/tenants/${tenant.tenantId}`].role).toBe('OWNER');

      // 4. Verify userTenants index saved in userTenants/{userId}/{tenantId}
      expect(recordedSets[`userTenants/${userId}/${tenant.tenantId}`]).toBeDefined();
      expect(recordedSets[`userTenants/${userId}/${tenant.tenantId}`].status).toBe('ACTIVE');

      // 5. Verify user profile updated with defaultTenantId and companySetupCompleted: true
      expect(recordedUpdates[`users/${userId}`]).toBeDefined();
      expect(recordedUpdates[`users/${userId}`].defaultTenantId).toBe(tenant.tenantId);
      expect(recordedUpdates[`users/${userId}`].companySetupCompleted).toBe(true);
      expect(recordedUpdates[`users/${userId}`].companySetupDate).toBeDefined();
    });
  });

  describe('Re-using Saved Company on Subsequent / Further Logins', () => {
    it('should retrieve saved company directly from user profile on subsequent login without reading root memberships', async () => {
      const mockUserProfile: Partial<UserProfile> = {
        userId,
        name: 'Sethji Agarwal',
        email: 'sethji@balajisteels.com',
        defaultTenantId: tenantId,
        companySetupCompleted: true,
        tenants: {
          [tenantId]: {
            tenantId,
            role: 'OWNER',
            name: 'Shree Balaji Steels',
            status: 'ACTIVE',
            createdAt: Date.now() - 86400000,
          },
        },
      };

      const mockTenant: Tenant = {
        tenantId,
        name: 'Shree Balaji Steels',
        legalName: 'Shree Balaji Steels Pvt Ltd',
        gstin: '27AABCS1429B1Z',
        email: 'accounts@balajisteels.com',
        mobile: '+919820012345',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        planId: 'growth_monthly',
        status: 'ACTIVE',
        tallyConnected: true,
        settings: {
          defaultPaymentTermsDays: 45,
          autoReconcileThreshold: 95,
          sendPreDueReminders: true,
          sendDueReminders: true,
          sendOverdueReminders: true,
          reminderChannel: 'WHATSAPP',
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        // When querying user profile upon login
        if (path === `users/${userId}`) return mockUserProfile;
        // When loading the saved tenant from database
        if (path === `tenants/${tenantId}`) return mockTenant;
        // When querying direct membership
        if (path === `memberships/${tenantId}/${userId}`) {
          return {
            tenantId,
            userId,
            role: 'OWNER',
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
            status: 'ACTIVE',
            createdAt: mockTenant.createdAt,
            updatedAt: mockTenant.updatedAt,
          };
        }
        // Root memberships access rejected by RTDB security rules
        if (path === 'memberships') {
          throw new Error('Permission denied: /memberships root read restricted');
        }
        return null;
      });

      // 1. Execute membership resolution upon login
      const memberships = await tenantService.getUserMemberships(userId);
      expect(memberships.length).toBe(1);
      expect(memberships[0].tenantId).toBe(tenantId);
      expect(memberships[0].role).toBe('OWNER');

      // 2. Fetch the tenant company from database
      const loadedTenant = await tenantService.getTenant(memberships[0].tenantId);
      expect(loadedTenant).not.toBeNull();
      expect(loadedTenant!.name).toBe('Shree Balaji Steels');
      expect(loadedTenant!.gstin).toBe('27AABCS1429B1Z');
    });

    it('should resolve company via userTenants index if user profile tenants map is absent', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `users/${userId}`) {
          return {
            userId,
            defaultTenantId: null,
          };
        }
        if (path === `userTenants/${userId}`) {
          return {
            [tenantId]: {
              tenantId,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          };
        }
        if (path === `tenants/${tenantId}`) {
          return {
            tenantId,
            name: 'Recovered Enterprise',
          };
        }
        return null;
      });

      const memberships = await tenantService.getUserMemberships(userId);
      expect(memberships.length).toBe(1);
      expect(memberships[0].tenantId).toBe(tenantId);
      expect(memberships[0].role).toBe('OWNER');
    });
  });

  describe('Continuous Database Updates for Existing Company', () => {
    it('should update company in database via updateTenant', async () => {
      const existingTenant: Tenant = {
        tenantId,
        name: 'Original Company Name',
        legalName: 'Original Legal Name',
        email: 'info@original.com',
        mobile: '+919999999999',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        planId: 'trial_free',
        status: 'ACTIVE',
        tallyConnected: false,
        settings: {
          defaultPaymentTermsDays: 30,
          autoReconcileThreshold: 95,
          sendPreDueReminders: true,
          sendDueReminders: true,
          sendOverdueReminders: true,
          reminderChannel: 'WHATSAPP',
        },
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 100000,
      };

      let updatedRecord: any = null;
      vi.spyOn(dbService, 'update').mockImplementation(async (path: string, data: any) => {
        if (path === `tenants/${tenantId}`) {
          updatedRecord = { ...existingTenant, ...data };
        }
      });

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === `tenants/${tenantId}`) return updatedRecord;
        return null;
      });

      const updated = await tenantService.updateTenant(tenantId, {
        name: 'Updated Company Name',
        legalName: 'Updated Company Private Limited',
        gstin: '24AAACC1206D1ZM',
        settings: {
          ...existingTenant.settings,
          defaultPaymentTermsDays: 60,
        },
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Company Name');
      expect(updated!.legalName).toBe('Updated Company Private Limited');
      expect(updated!.gstin).toBe('24AAACC1206D1ZM');
      expect(updated!.settings.defaultPaymentTermsDays).toBe(60);
      expect(updated!.updatedAt).toBeGreaterThan(existingTenant.updatedAt!);
    });
  });
});
