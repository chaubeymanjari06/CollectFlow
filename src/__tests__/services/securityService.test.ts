import { describe, it, expect, vi, beforeEach } from 'vitest';
import { securityService, THREAT_MODEL_MATRIX, PENETRATION_TEST_FINDINGS, COMPLIANCE_POLICIES } from '../../services/securityService';
import { dbService } from '../../services/dbService';

describe('Phase 17: Security & Compliance Hardening Service', () => {
  const tenantId = 'ten_test_corp';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
    vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
  });

  // =========================================================================
  // 1. THREAT MODEL & COMPLIANCE POLICIES
  // =========================================================================
  describe('Threat Model & Compliance Policies', () => {
    it('should return complete STRIDE threat matrix covering all 6 categories', () => {
      const threats = securityService.getThreatModel();
      expect(threats.length).toBeGreaterThanOrEqual(6);
      const categories = threats.map((t) => t.category);
      expect(categories).toContain('SPOOFING');
      expect(categories).toContain('TAMPERING');
      expect(categories).toContain('REPUDIATION');
      expect(categories).toContain('INFORMATION_DISCLOSURE');
      expect(categories).toContain('DENIAL_OF_SERVICE');
      expect(categories).toContain('ELEVATION_OF_PRIVILEGE');
      expect(threats.every((t) => t.status === 'MITIGATED')).toBe(true);
    });

    it('should return penetration testing audit findings', () => {
      const findings = securityService.getPenetrationTestFindings();
      expect(findings.length).toBeGreaterThanOrEqual(4);
      expect(findings.some((f) => f.severity === 'CRITICAL')).toBe(true);
      expect(findings.every((f) => f.status === 'REMEDIATED' || f.status === 'VERIFIED')).toBe(true);
    });

    it('should return compliance policies including DPDP Act 2023 and Terms of Service', () => {
      const policies = securityService.getCompliancePolicies();
      expect(policies.length).toBeGreaterThanOrEqual(4);
      const policyIds = policies.map((p) => p.policyId);
      expect(policyIds).toContain('PRIVACY_POLICY');
      expect(policyIds).toContain('TERMS_OF_SERVICE');
      expect(policyIds).toContain('DPA_AGREEMENT');
      expect(policyIds).toContain('VENDOR_REVIEW');
    });
  });

  // =========================================================================
  // 2. AUTOMATED TENANT ISOLATION VALIDATION ENGINE
  // =========================================================================
  describe('Automated Tenant Isolation Verification', () => {
    it('should execute 5 tenant isolation boundary probes and log security event', async () => {
      const logSpy = vi.spyOn(securityService, 'logSecurityEvent').mockResolvedValue({} as any);

      const res = await securityService.verifyTenantIsolation(
        'ten_alpha',
        'ten_beta',
        'usr_intruder_01'
      );

      expect(res.passed).toBe(true);
      expect(res.checks).toHaveLength(5);
      expect(res.checks.every((c) => c.status === 'PASSED')).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        'ten_alpha',
        expect.objectContaining({ action: 'TENANT_ISOLATION_VERIFIED' })
      );
    });

    it('should correctly evaluate rules access based on tenant membership and active status', () => {
      // 1. Authorized user in own tenant
      const ownAccess = securityService.evaluateRuleAccess('invoices/ten_alpha/inv_1', {
        uid: 'usr_1',
        tenantId: 'ten_alpha',
        role: 'ADMIN',
        isActive: true,
      });
      expect(ownAccess.allowed).toBe(true);

      // 2. Cross-tenant access attempt (should block)
      const crossAccess = securityService.evaluateRuleAccess('invoices/ten_beta/inv_2', {
        uid: 'usr_1',
        tenantId: 'ten_alpha',
        role: 'ADMIN',
        isActive: true,
      });
      expect(crossAccess.allowed).toBe(false);
      expect(crossAccess.reason).toContain('Cross-tenant access blocked');

      // 3. Inactive membership (should block)
      const inactiveAccess = securityService.evaluateRuleAccess('invoices/ten_alpha/inv_1', {
        uid: 'usr_1',
        tenantId: 'ten_alpha',
        role: 'ADMIN',
        isActive: false,
      });
      expect(inactiveAccess.allowed).toBe(false);
      expect(inactiveAccess.reason).toContain('inactive or suspended');

      // 4. Unauthenticated (should block)
      const unauthAccess = securityService.evaluateRuleAccess('invoices/ten_alpha/inv_1', null as any);
      expect(unauthAccess.allowed).toBe(false);
      expect(unauthAccess.reason).toContain('Unauthenticated request');
    });
  });

  // =========================================================================
  // 3. SECRETS & TOKEN ROTATION
  // =========================================================================
  describe('Secrets Management & Token Rotation', () => {
    it('should return rotatable secrets or seed defaults if none exist', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);

      const secrets = await securityService.getRotatableSecrets(tenantId);
      expect(secrets).toHaveLength(4);
      const types = secrets.map((s) => s.type);
      expect(types).toContain('TALLY_AGENT_AUTH_TOKEN');
      expect(types).toContain('RAZORPAY_WEBHOOK_SECRET');
      expect(types).toContain('WHATSAPP_BUSINESS_TOKEN');
      expect(types).toContain('PARTNER_API_KEY');
    });

    it('should cryptographically rotate a secret and record audit entry', async () => {
      vi.spyOn(securityService, 'getRotatableSecrets').mockResolvedValue([
        {
          secretId: 'sec_01',
          tenantId,
          type: 'RAZORPAY_WEBHOOK_SECRET',
          name: 'Razorpay Secret',
          maskedValue: 'old_masked_value',
          lastRotatedAt: Date.now() - 30 * 86400000,
          expiresAt: Date.now() + 60 * 86400000,
          status: 'ACTIVE',
        },
      ]);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const logSpy = vi.spyOn(securityService, 'logSecurityEvent').mockResolvedValue({} as any);

      const rotated = await securityService.rotateSecret(tenantId, 'RAZORPAY_WEBHOOK_SECRET');

      expect(rotated.type).toBe('RAZORPAY_WEBHOOK_SECRET');
      expect(rotated.maskedValue).not.toBe('old_masked_value');
      expect(rotated.maskedValue).toContain('****');
      expect(setSpy).toHaveBeenCalledWith(`secrets/${tenantId}/${rotated.secretId}`, rotated);
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ action: 'SECRET_ROTATED' })
      );
    });
  });

  // =========================================================================
  // 4. RATE LIMITING & ANTI-ABUSE
  // =========================================================================
  describe('Rate Limiting & Anti-Abuse', () => {
    it('should return rate limit status for monitored API endpoints', async () => {
      const status = await securityService.getRateLimitStatus(tenantId);
      expect(status.length).toBeGreaterThanOrEqual(4);
      const endpoints = status.map((s) => s.endpoint);
      expect(endpoints).toContain('/api/v1/sync/tally-batch');
      expect(endpoints).toContain('/api/v1/reminders/whatsapp');
      expect(endpoints).toContain('/api/v1/webhooks/payment');
      expect(status.every((s) => s.status === 'HEALTHY')).toBe(true);
    });
  });

  // =========================================================================
  // 5. IMMUTABLE SECURITY AUDIT TRAIL
  // =========================================================================
  describe('Immutable Security Audit Trail', () => {
    it('should record and retrieve security audit logs', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const entry = await securityService.logSecurityEvent(tenantId, {
        actorId: 'usr_admin',
        actorEmail: 'admin@apexsteel.com',
        action: 'LOGIN_MFA_SUCCESS',
        resourceType: 'TENANT',
        resourceId: tenantId,
        ipAddress: '103.21.124.8',
        details: { mfaMethod: 'TOTP' },
      });

      expect(entry.auditLogId).toMatch(/^sec_aud_/);
      expect(entry.tenantId).toBe(tenantId);
      expect(entry.action).toBe('LOGIN_MFA_SUCCESS');
      expect(setSpy).toHaveBeenCalledWith(
        `securityAuditLogs/${tenantId}/${entry.auditLogId}`,
        entry
      );
    });

    it('should retrieve audit logs sorted by timestamp desc', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        aud_1: { auditLogId: 'aud_1', timestamp: 1000, action: 'INVOICE_SYNCED' },
        aud_2: { auditLogId: 'aud_2', timestamp: 2000, action: 'SECRET_ROTATED' },
      });

      const logs = await securityService.getSecurityAuditLogs(tenantId);
      expect(logs).toHaveLength(2);
      expect(logs[0].auditLogId).toBe('aud_2');
      expect(logs[1].auditLogId).toBe('aud_1');
    });
  });

  // =========================================================================
  // 6. DATA PRIVACY & GOVERNANCE (DPDP ACT 2023)
  // =========================================================================
  describe('Data Privacy & Governance', () => {
    it('should process data export takeout request under DPDP Section 12', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const logSpy = vi.spyOn(securityService, 'logSecurityEvent').mockResolvedValue({} as any);

      const req = await securityService.requestDataExport(tenantId, 'JSON', 'Rajesh Sharma');

      expect(req.requestId).toMatch(/^exp_/);
      expect(req.tenantId).toBe(tenantId);
      expect(req.format).toBe('JSON');
      expect(req.status).toBe('READY');
      expect(req.downloadUrl).toBeDefined();
      expect(setSpy).toHaveBeenCalledWith(`dataExports/${tenantId}/${req.requestId}`, req);
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ action: 'DATA_EXPORT_REQUESTED' })
      );
    });

    it('should schedule data deletion with 30-day statutory grace window', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const logSpy = vi.spyOn(securityService, 'logSecurityEvent').mockResolvedValue({} as any);

      const req = await securityService.requestDataDeletion(
        tenantId,
        'CUSTOMER_LEDGERS',
        'Customer requested erasure',
        'Rajesh Sharma'
      );

      expect(req.requestId).toMatch(/^del_/);
      expect(req.tenantId).toBe(tenantId);
      expect(req.scope).toBe('CUSTOMER_LEDGERS');
      expect(req.retentionWindowDays).toBe(30);
      expect(setSpy).toHaveBeenCalledWith(`dataDeletions/${tenantId}/${req.requestId}`, req);
      expect(logSpy).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ action: 'DATA_DELETION_REQUESTED' })
      );
    });
  });
});
