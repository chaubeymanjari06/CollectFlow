import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDefaultPermissions, tenantService } from '../../services/tenantService';
import { dbService } from '../../services/dbService';

describe('Tenant Service & RBAC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should grant full permissions to OWNER and ADMIN roles', () => {
    const ownerPerms = getDefaultPermissions('OWNER');
    expect(ownerPerms.manageBilling).toBe(true);
    expect(ownerPerms.manageUsers).toBe(true);
    expect(ownerPerms.approveReconciliation).toBe(true);
    expect(ownerPerms.writeInvoices).toBe(true);

    const adminPerms = getDefaultPermissions('ADMIN');
    expect(adminPerms.manageBilling).toBe(true);
    expect(adminPerms.manageUsers).toBe(true);
    expect(adminPerms.writeInvoices).toBe(true);
  });

  it('should restrict financial write operations for EXECUTIVE role', () => {
    const execPerms = getDefaultPermissions('EXECUTIVE');
    expect(execPerms.readInvoices).toBe(true);
    expect(execPerms.sendMessages).toBe(true);
    expect(execPerms.createPTP).toBe(true);
    expect(execPerms.writeInvoices).toBe(false);
    expect(execPerms.approveReconciliation).toBe(false);
    expect(execPerms.manageBilling).toBe(false);
  });

  it('should grant only read-only access to VIEWER and PARTNER roles', () => {
    const viewerPerms = getDefaultPermissions('VIEWER');
    expect(viewerPerms.readInvoices).toBe(true);
    expect(viewerPerms.sendMessages).toBe(false);
    expect(viewerPerms.createPTP).toBe(false);
    expect(viewerPerms.manageBilling).toBe(false);

    const partnerPerms = getDefaultPermissions('PARTNER');
    expect(partnerPerms.readInvoices).toBe(true);
    expect(partnerPerms.sendMessages).toBe(false);
  });

  it('should create tenant with isolated database node and OWNER membership', async () => {
    const mockSet = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
    const mockGet = vi.spyOn(dbService, 'get').mockResolvedValue(null);
    const mockUpdate = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

    const result = await tenantService.createTenant('usr_123', {
      name: 'Test Enterprises',
      email: 'test@enterprises.com',
      mobile: '+919876543210',
      currency: 'INR',
      defaultPaymentTermsDays: 45,
    });

    expect(result.tenant.name).toBe('Test Enterprises');
    expect(result.tenant.tenantId).toMatch(/^ten_/);
    expect(result.tenant.settings.defaultPaymentTermsDays).toBe(45);
    expect(result.membership.role).toBe('OWNER');
    expect(result.membership.userId).toBe('usr_123');

    // Verified database paths written
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('tenants/ten_'),
      expect.objectContaining({ name: 'Test Enterprises' })
    );
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('memberships/ten_'),
      expect.objectContaining({ role: 'OWNER' })
    );
  });
});
