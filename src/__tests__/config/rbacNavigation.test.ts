import { describe, it, expect } from 'vitest';
import {
  ALL_NAV_ITEMS,
  getAllowedNavItems,
  getRoleMeta,
} from '../../config/rbacNavigation';
import { UserRole } from '../../types';

describe('RBAC Navigation Configuration (rbacNavigation)', () => {
  it('should have all 16 navigation tools defined in master catalog', () => {
    expect(ALL_NAV_ITEMS.length).toBe(16);
    const ids = ALL_NAV_ITEMS.map((item) => item.id);
    expect(ids).toContain('dashboard');
    expect(ids).toContain('invoices');
    expect(ids).toContain('customers');
    expect(ids).toContain('payments');
    expect(ids).toContain('reconciliation');
    expect(ids).toContain('reminders');
    expect(ids).toContain('analytics');
    expect(ids).toContain('copilot');
    expect(ids).toContain('integrations');
    expect(ids).toContain('partner');
    expect(ids).toContain('billing');
    expect(ids).toContain('team');
    expect(ids).toContain('settings');
    expect(ids).toContain('observability');
    expect(ids).toContain('security');
    expect(ids).toContain('pilot');
  });

  describe('Strict Role-Based Item Permissions', () => {
    it('OWNER should have access to all 16 navigation areas', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('OWNER', true);
      const total = coreItems.length + diagnosticItems.length;
      expect(total).toBe(16);
      expect(diagnosticItems.length).toBe(3);
      expect(diagnosticItems.map((d) => d.id)).toEqual(['observability', 'security', 'pilot']);
    });

    it('should give ADMIN access to all 16 navigation tools (including all diagnostics)', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('ADMIN', false);
      const total = coreItems.length + diagnosticItems.length;
      expect(total).toBe(16);
      expect(diagnosticItems.length).toBe(3);
      const coreIds = coreItems.map((c) => c.id);
      expect(coreIds).toContain('billing');
      expect(coreIds).toContain('team');
      expect(coreIds).toContain('integrations');
      expect(coreIds).toContain('settings');
    });

    it('MANAGER (Munimji) should only access 10 core items and NO diagnostics or admin areas', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('MANAGER', false);
      const coreIds = coreItems.map((c) => c.id);

      expect(coreItems.length).toBe(10);
      expect(diagnosticItems.length).toBe(0);

      // Allowed
      expect(coreIds).toContain('dashboard');
      expect(coreIds).toContain('invoices');
      expect(coreIds).toContain('customers');
      expect(coreIds).toContain('payments');
      expect(coreIds).toContain('reconciliation');
      expect(coreIds).toContain('reminders');
      expect(coreIds).toContain('analytics');
      expect(coreIds).toContain('copilot');
      expect(coreIds).toContain('integrations');
      expect(coreIds).toContain('settings');

      // Strictly Blocked
      expect(coreIds).not.toContain('billing');
      expect(coreIds).not.toContain('team');
      expect(coreIds).not.toContain('partner');
      expect(diagnosticItems.map((d) => d.id)).not.toContain('observability');
      expect(diagnosticItems.map((d) => d.id)).not.toContain('security');
      expect(diagnosticItems.map((d) => d.id)).not.toContain('pilot');
    });

    it('EXECUTIVE (Collection Clerk) should only access 5 chase items and NO finance/admin tools', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('EXECUTIVE', false);
      const coreIds = coreItems.map((c) => c.id);

      expect(coreItems.length).toBe(5);
      expect(diagnosticItems.length).toBe(0);

      // Permitted
      expect(coreIds).toEqual(['dashboard', 'invoices', 'customers', 'payments', 'reminders']);

      // Strictly Blocked
      expect(coreIds).not.toContain('reconciliation');
      expect(coreIds).not.toContain('analytics');
      expect(coreIds).not.toContain('copilot');
      expect(coreIds).not.toContain('integrations');
      expect(coreIds).not.toContain('billing');
      expect(coreIds).not.toContain('team');
      expect(coreIds).not.toContain('settings');
    });

    it('PARTNER (CA / Auditor) should only access 6 audit items + security compliance (7 total)', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('PARTNER', false);
      const coreIds = coreItems.map((c) => c.id);

      expect(coreItems.length).toBe(6);
      expect(diagnosticItems.length).toBe(1);
      expect(diagnosticItems[0].id).toBe('security');

      // Permitted
      expect(coreIds).toContain('dashboard');
      expect(coreIds).toContain('invoices');
      expect(coreIds).toContain('customers');
      expect(coreIds).toContain('payments');
      expect(coreIds).toContain('reconciliation');
      expect(coreIds).toContain('partner');

      // Strictly Blocked
      expect(coreIds).not.toContain('reminders');
      expect(coreIds).not.toContain('billing');
      expect(coreIds).not.toContain('team');
      expect(coreIds).not.toContain('settings');
      expect(coreIds).not.toContain('copilot');
    });

    it('VIEWER (Read-Only) should only access 3 view items', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems('VIEWER', false);
      const coreIds = coreItems.map((c) => c.id);

      expect(coreItems.length).toBe(3);
      expect(diagnosticItems.length).toBe(0);
      expect(coreIds).toEqual(['dashboard', 'invoices', 'customers']);

      // Blocked from all operational actions
      expect(coreIds).not.toContain('payments');
      expect(coreIds).not.toContain('reconciliation');
      expect(coreIds).not.toContain('reminders');
      expect(coreIds).not.toContain('billing');
    });

    it('should return empty lists when role is null or undefined', () => {
      const { coreItems, diagnosticItems } = getAllowedNavItems(null, false);
      expect(coreItems.length).toBe(0);
      expect(diagnosticItems.length).toBe(0);
    });
  });

  describe('Role Metadata (getRoleMeta)', () => {
    const roles: UserRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER'];

    roles.forEach((role) => {
      it(`should return valid title and badge class for ${role}`, () => {
        const meta = getRoleMeta(role);
        expect(meta.title).toBeTruthy();
        expect(meta.subtitle).toBeTruthy();
        expect(meta.badgeClass).toContain('border-');
      });
    });
  });
});
