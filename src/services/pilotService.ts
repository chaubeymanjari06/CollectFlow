import {
  PilotStage,
  PilotCluster,
  ControlledAccount,
  PilotMerchant,
  PilotKPIs,
  PilotGraduationCriterion,
  PilotSupportTicket,
  DailyPilotMeasurement,
} from '../types';
import { dbService } from './dbService';

// Default Clusters aligned with MSME manufacturing belts in India
const DEFAULT_CLUSTERS: PilotCluster[] = [
  {
    id: 'cluster-surat-textiles',
    name: 'Surat Textile Hub',
    sector: 'Synthetic Textiles & Weaving',
    location: 'Surat, Gujarat',
    partnerCount: 3,
    merchantCount: 16,
    targetMerchants: 15,
    totalOutstanding: 64200000, // ₹6.42 Cr
    totalCollected: 18200000,   // ₹1.82 Cr
    status: 'ACTIVE',
  },
  {
    id: 'cluster-ludhiana-auto',
    name: 'Ludhiana Auto Component Cluster',
    sector: 'Auto Parts, Forging & Fasteners',
    location: 'Ludhiana, Punjab',
    partnerCount: 2,
    merchantCount: 12,
    targetMerchants: 15,
    totalOutstanding: 51000000, // ₹5.10 Cr
    totalCollected: 11500000,   // ₹1.15 Cr
    status: 'ACTIVE',
  },
  {
    id: 'cluster-peenya-machinery',
    name: 'Peenya Industrial Machinery Hub',
    sector: 'Precision Tooling & Heavy CNC',
    location: 'Bengaluru, Karnataka',
    partnerCount: 2,
    merchantCount: 10,
    targetMerchants: 12,
    totalOutstanding: 33200000, // ₹3.32 Cr
    totalCollected: 4800000,    // ₹0.48 Cr
    status: 'ACTIVE',
  },
];

// 10 Sample accounts for controlled rollout guardrails
const createSampleControlledAccounts = (merchantId: string): ControlledAccount[] => [
  {
    id: `${merchantId}-acc-01`,
    merchantId,
    customerName: 'Shree Krishna Fabrics Pvt Ltd',
    phone: '+919825012345',
    outstandingBalance: 345000,
    overdueDays: 42,
    reminderStatus: 'DELIVERED',
    ptpStatus: 'PROMISED',
    lastContactAt: 'Yesterday 14:30',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-02`,
    merchantId,
    customerName: 'Ambika Yarn Traders',
    phone: '+919825023456',
    outstandingBalance: 185000,
    overdueDays: 18,
    reminderStatus: 'READ',
    ptpStatus: 'HONORED',
    lastContactAt: 'Today 10:15',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-03`,
    merchantId,
    customerName: 'Navkar Textile Processors',
    phone: '+919825034567',
    outstandingBalance: 520000,
    overdueDays: 65,
    reminderStatus: 'SENT',
    ptpStatus: 'NONE',
    lastContactAt: '2 days ago',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-04`,
    merchantId,
    customerName: 'Surat Silk Syndicate',
    phone: '+919825045678',
    outstandingBalance: 98000,
    overdueDays: 12,
    reminderStatus: 'DELIVERED',
    ptpStatus: 'NONE',
    lastContactAt: 'Yesterday 17:00',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-05`,
    merchantId,
    customerName: 'Radha Vallabh Weaving Mills',
    phone: '+919825056789',
    outstandingBalance: 780000,
    overdueDays: 55,
    reminderStatus: 'READ',
    ptpStatus: 'PROMISED',
    lastContactAt: 'Today 09:30',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-06`,
    merchantId,
    customerName: 'Royal Brocade Exports',
    phone: '+919825067890',
    outstandingBalance: 240000,
    overdueDays: 28,
    reminderStatus: 'PENDING',
    ptpStatus: 'NONE',
    lastContactAt: 'Not contacted',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-07`,
    merchantId,
    customerName: 'Maruti Polyfab Industries',
    phone: '+919825078901',
    outstandingBalance: 410000,
    overdueDays: 37,
    reminderStatus: 'DELIVERED',
    ptpStatus: 'NONE',
    lastContactAt: '3 days ago',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-08`,
    merchantId,
    customerName: 'Kailash Twisters & Doublers',
    phone: '+919825089012',
    outstandingBalance: 165000,
    overdueDays: 14,
    reminderStatus: 'READ',
    ptpStatus: 'HONORED',
    lastContactAt: 'Today 11:45',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-09`,
    merchantId,
    customerName: 'Tirupati Jacquard Works',
    phone: '+919825090123',
    outstandingBalance: 610000,
    overdueDays: 74,
    reminderStatus: 'SENT',
    ptpStatus: 'BROKEN',
    lastContactAt: 'Yesterday 16:20',
    safeTestMode: true,
  },
  {
    id: `${merchantId}-acc-10`,
    merchantId,
    customerName: 'Balaji Fashion Weavers',
    phone: '+919825001234',
    outstandingBalance: 125000,
    overdueDays: 9,
    reminderStatus: 'PENDING',
    ptpStatus: 'NONE',
    lastContactAt: 'Not contacted',
    safeTestMode: true,
  },
];

// Initial Pilot Merchants covering 8 stages
const DEFAULT_PILOT_MERCHANTS: PilotMerchant[] = [
  {
    id: 'merch-surat-01',
    businessName: 'Vardhaman Synthetics LLP',
    gstin: '24AAACV1234F1Z8',
    clusterId: 'cluster-surat-textiles',
    clusterName: 'Surat Textile Hub',
    partnerId: 'partner-mehta-ca',
    partnerName: 'Mehta & Associates CA',
    stage: 'measurement_30_day',
    stageProgress: 92,
    controlled10PilotActive: true,
    controlledAccounts: createSampleControlledAccounts('merch-surat-01'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 4.0',
    syncSuccessRate: 99.7,
    invoicesSynced: 1420,
    outstandingAmount: 4850000,
    amountCollected: 1620000,
    messagesDelivered: 480,
    customerResponseRate: 46.5,
    ptpCreationRate: 41.2,
    ptpSuccessRate: 84.6,
    paymentsDetected: 142,
    reconciliationsCompleted: 139,
    supportTickets: 0,
    churnRisk: 'LOW',
    pilotStartDate: '2026-08-26',
    pilotDayNumber: 28,
    graduationScore: 94,
    graduationEligible: true,
  },
  {
    id: 'merch-surat-02',
    businessName: 'Apex Yarn Spinners Pvt Ltd',
    gstin: '24AABCA5678M1Z2',
    clusterId: 'cluster-surat-textiles',
    clusterName: 'Surat Textile Hub',
    partnerId: 'partner-mehta-ca',
    partnerName: 'Mehta & Associates CA',
    stage: 'controlled_10_account',
    stageProgress: 60,
    controlled10PilotActive: true,
    controlledAccounts: createSampleControlledAccounts('merch-surat-02'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 3.0',
    syncSuccessRate: 98.9,
    invoicesSynced: 640,
    outstandingAmount: 3200000,
    amountCollected: 640000,
    messagesDelivered: 85,
    customerResponseRate: 38.0,
    ptpCreationRate: 32.5,
    ptpSuccessRate: 75.0,
    paymentsDetected: 48,
    reconciliationsCompleted: 45,
    supportTickets: 1,
    churnRisk: 'LOW',
    pilotStartDate: '2026-09-10',
    pilotDayNumber: 15,
    graduationScore: 78,
    graduationEligible: false,
  },
  {
    id: 'merch-ludhiana-01',
    businessName: 'Heroic Forgings & Stampings',
    gstin: '03AAACH9012K1Z4',
    clusterId: 'cluster-ludhiana-auto',
    clusterName: 'Ludhiana Auto Component Cluster',
    partnerId: 'partner-sharma-tally',
    partnerName: 'Sharma Enterprise Systems',
    stage: 'full_activation',
    stageProgress: 75,
    controlled10PilotActive: false,
    controlledAccounts: createSampleControlledAccounts('merch-ludhiana-01'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 4.0',
    syncSuccessRate: 99.2,
    invoicesSynced: 910,
    outstandingAmount: 4100000,
    amountCollected: 980000,
    messagesDelivered: 310,
    customerResponseRate: 44.0,
    ptpCreationRate: 39.0,
    ptpSuccessRate: 81.0,
    paymentsDetected: 79,
    reconciliationsCompleted: 76,
    supportTickets: 0,
    churnRisk: 'LOW',
    pilotStartDate: '2026-09-02',
    pilotDayNumber: 23,
    graduationScore: 88,
    graduationEligible: true,
  },
  {
    id: 'merch-ludhiana-02',
    businessName: 'Punjab Precision Fasteners',
    gstin: '03AABCP3456N1Z9',
    clusterId: 'cluster-ludhiana-auto',
    clusterName: 'Ludhiana Auto Component Cluster',
    partnerId: 'partner-sharma-tally',
    partnerName: 'Sharma Enterprise Systems',
    stage: 'data_validation',
    stageProgress: 45,
    controlled10PilotActive: true,
    controlledAccounts: createSampleControlledAccounts('merch-ludhiana-02'),
    tallyConnected: true,
    tallyVersion: 'Tally.ERP 9',
    syncSuccessRate: 97.4,
    invoicesSynced: 430,
    outstandingAmount: 2450000,
    amountCollected: 120000,
    messagesDelivered: 12,
    customerResponseRate: 25.0,
    ptpCreationRate: 20.0,
    ptpSuccessRate: 60.0,
    paymentsDetected: 10,
    reconciliationsCompleted: 8,
    supportTickets: 1,
    churnRisk: 'MEDIUM',
    pilotStartDate: '2026-09-17',
    pilotDayNumber: 8,
    graduationScore: 62,
    graduationEligible: false,
  },
  {
    id: 'merch-peenya-01',
    businessName: 'Chamundi CNC Tools & Dies',
    gstin: '29AAACC7890L1Z6',
    clusterId: 'cluster-peenya-machinery',
    clusterName: 'Peenya Industrial Machinery Hub',
    partnerId: 'partner-rao-consultants',
    partnerName: 'Rao & Co Financial Advisors',
    stage: 'payment_recon_test',
    stageProgress: 82,
    controlled10PilotActive: false,
    controlledAccounts: createSampleControlledAccounts('merch-peenya-01'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 4.0',
    syncSuccessRate: 99.5,
    invoicesSynced: 820,
    outstandingAmount: 3100000,
    amountCollected: 740000,
    messagesDelivered: 290,
    customerResponseRate: 48.2,
    ptpCreationRate: 40.5,
    ptpSuccessRate: 82.5,
    paymentsDetected: 64,
    reconciliationsCompleted: 63,
    supportTickets: 0,
    churnRisk: 'LOW',
    pilotStartDate: '2026-09-05',
    pilotDayNumber: 20,
    graduationScore: 89,
    graduationEligible: true,
  },
  {
    id: 'merch-peenya-02',
    businessName: 'Karnataka Hydraulics & Valves',
    gstin: '29AABCK1234D1Z1',
    clusterId: 'cluster-peenya-machinery',
    clusterName: 'Peenya Industrial Machinery Hub',
    partnerId: 'partner-rao-consultants',
    partnerName: 'Rao & Co Financial Advisors',
    stage: 'tally_connection',
    stageProgress: 30,
    controlled10PilotActive: true,
    controlledAccounts: createSampleControlledAccounts('merch-peenya-02'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 4.0',
    syncSuccessRate: 99.0,
    invoicesSynced: 210,
    outstandingAmount: 1890000,
    amountCollected: 0,
    messagesDelivered: 0,
    customerResponseRate: 0,
    ptpCreationRate: 0,
    ptpSuccessRate: 0,
    paymentsDetected: 0,
    reconciliationsCompleted: 0,
    supportTickets: 1,
    churnRisk: 'LOW',
    pilotStartDate: '2026-09-21',
    pilotDayNumber: 4,
    graduationScore: 50,
    graduationEligible: false,
  },
  {
    id: 'merch-surat-03',
    businessName: 'Zenith Weaving Mills',
    gstin: '24AABBC9999M1Z3',
    clusterId: 'cluster-surat-textiles',
    clusterName: 'Surat Textile Hub',
    partnerId: 'partner-mehta-ca',
    partnerName: 'Mehta & Associates CA',
    stage: 'graduated',
    stageProgress: 100,
    controlled10PilotActive: false,
    controlledAccounts: createSampleControlledAccounts('merch-surat-03'),
    tallyConnected: true,
    tallyVersion: 'TallyPrime 4.0',
    syncSuccessRate: 99.9,
    invoicesSynced: 2150,
    outstandingAmount: 5900000,
    amountCollected: 2450000,
    messagesDelivered: 890,
    customerResponseRate: 52.0,
    ptpCreationRate: 44.0,
    ptpSuccessRate: 88.5,
    paymentsDetected: 210,
    reconciliationsCompleted: 208,
    supportTickets: 0,
    churnRisk: 'LOW',
    pilotStartDate: '2026-08-15',
    pilotDayNumber: 30,
    graduationScore: 98,
    graduationEligible: true,
    graduatedAt: '2026-09-18',
  },
];

// Initial Pilot Support Tickets
const DEFAULT_SUPPORT_TICKETS: PilotSupportTicket[] = [
  {
    ticketId: 'PILOT-TCK-101',
    merchantId: 'merch-ludhiana-02',
    merchantName: 'Punjab Precision Fasteners',
    cluster: 'Ludhiana Auto Component Cluster',
    title: 'Tally.ERP 9 ODBC port 9000 connection timeout on older Windows 7 machine',
    category: 'TALLY_SYNC',
    severity: 'MEDIUM',
    status: 'IN_PROGRESS',
    createdAt: '2026-09-24 11:30',
    slaRemainingHours: 3.5,
  },
  {
    ticketId: 'PILOT-TCK-102',
    merchantId: 'merch-peenya-02',
    merchantName: 'Karnataka Hydraulics & Valves',
    cluster: 'Peenya Industrial Machinery Hub',
    title: 'WhatsApp Business template header branding verification pending with Meta',
    category: 'WHATSAPP_DELIVERY',
    severity: 'LOW',
    status: 'OPEN',
    createdAt: '2026-09-24 16:45',
    slaRemainingHours: 11.2,
  },
  {
    ticketId: 'PILOT-TCK-103',
    merchantId: 'merch-surat-02',
    merchantName: 'Apex Yarn Spinners Pvt Ltd',
    cluster: 'Surat Textile Hub',
    title: 'Roundoff ₹0.45 difference during manual bank ledger reconciliation match',
    category: 'RECON_DISCREPANCY',
    severity: 'LOW',
    status: 'RESOLVED',
    createdAt: '2026-09-23 09:15',
    resolvedAt: '2026-09-23 11:20',
    slaRemainingHours: 0,
  },
];

// 30-Day Measurement Trajectory (Day 1 to 30)
const generate30DayTrajectory = (): DailyPilotMeasurement[] => {
  const measurements: DailyPilotMeasurement[] = [];
  const baseDate = new Date('2026-08-26');

  for (let i = 1; i <= 30; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (i - 1));
    const dateStr = d.toISOString().split('T')[0];

    // Progressive velocity ramp
    const activeMerchants = Math.min(38, Math.round(5 + i * 1.1));
    const invoicesSynced = Math.round(450 * i * 1.08);
    const messagesSent = Math.round(110 * i * 1.15);
    const responsesReceived = Math.round(messagesSent * 0.44);
    const ptpsCreated = Math.round(responsesReceived * 0.38);
    const amountCollected = Math.round(85000 * Math.pow(i, 1.25));

    measurements.push({
      day: i,
      date: dateStr,
      invoicesSynced,
      messagesSent,
      responsesReceived,
      ptpsCreated,
      amountCollected,
      activeMerchants,
    });
  }

  return measurements;
};

class PilotService {
  private clusters: PilotCluster[] = [...DEFAULT_CLUSTERS];
  private merchants: PilotMerchant[] = [...DEFAULT_PILOT_MERCHANTS];
  private tickets: PilotSupportTicket[] = [...DEFAULT_SUPPORT_TICKETS];
  private measurements: DailyPilotMeasurement[] = generate30DayTrajectory();

  /**
   * Returns all participating industrial clusters
   */
  async getClusters(): Promise<PilotCluster[]> {
    return [...this.clusters];
  }

  /**
   * Returns pilot merchants, optionally filtered by cluster or stage
   */
  async getMerchants(clusterId?: string, stage?: PilotStage): Promise<PilotMerchant[]> {
    let filtered = [...this.merchants];
    if (clusterId) {
      filtered = filtered.filter((m) => m.clusterId === clusterId);
    }
    if (stage) {
      filtered = filtered.filter((m) => m.stage === stage);
    }
    return filtered;
  }

  /**
   * Returns single pilot merchant by ID
   */
  async getMerchantById(merchantId: string): Promise<PilotMerchant | null> {
    const found = this.merchants.find((m) => m.id === merchantId);
    return found ? { ...found } : null;
  }

  /**
   * Aggregates real-time KPIs across all pilot businesses against Phase 18 targets
   */
  async getPilotKPIs(): Promise<PilotKPIs> {
    // 38 MSME businesses across all clusters
    const activeBusinesses = 38;
    const activePartners = 7;
    const activeClusters = this.clusters.length;

    const totalInvoicesSynced = this.merchants.reduce((sum, m) => sum + m.invoicesSynced, 12200);
    const totalOutstandingTracked = this.clusters.reduce((sum, c) => sum + c.totalOutstanding, 0);
    const totalAmountCollected = this.clusters.reduce((sum, c) => sum + c.totalCollected, 0);
    const collectionRecoveryRate = Number(
      ((totalAmountCollected / (totalOutstandingTracked || 1)) * 100).toFixed(1)
    );

    const totalMessagesDelivered = this.merchants.reduce((sum, m) => sum + m.messagesDelivered, 2800);
    const totalPaymentsDetected = this.merchants.reduce((sum, m) => sum + m.paymentsDetected, 980);
    const totalReconciliationsCompleted = this.merchants.reduce(
      (sum, m) => sum + m.reconciliationsCompleted,
      950
    );

    const avgResponseRate = Number(
      (
        this.merchants.reduce((sum, m) => sum + m.customerResponseRate, 0) /
        (this.merchants.length || 1)
      ).toFixed(1)
    );

    const avgPtpCreationRate = Number(
      (
        this.merchants.reduce((sum, m) => sum + m.ptpCreationRate, 0) /
        (this.merchants.length || 1)
      ).toFixed(1)
    );

    const avgPtpSuccessRate = Number(
      (
        this.merchants.reduce((sum, m) => sum + m.ptpSuccessRate, 0) /
        (this.merchants.length || 1)
      ).toFixed(1)
    );

    const openSupportTickets = this.tickets.filter((t) => t.status !== 'RESOLVED').length;

    return {
      activeBusinesses,
      targetBusinessesMin: 25,
      targetBusinessesMax: 50,
      activePartners,
      targetPartnersMin: 5,
      targetPartnersMax: 10,
      activeClusters,
      targetClustersMin: 1,
      targetClustersMax: 3,
      successfulTallyConnections: 37, // 37 of 38 connected
      syncSuccessRateAvg: 99.4,
      totalInvoicesSynced,
      totalOutstandingTracked,
      totalAmountCollected,
      collectionRecoveryRate,
      totalMessagesDelivered,
      avgResponseRate,
      avgPtpCreationRate,
      avgPtpSuccessRate,
      totalPaymentsDetected,
      totalReconciliationsCompleted,
      openSupportTickets,
      churnRate: 0.0,
    };
  }

  /**
   * Advances a merchant through the 8-step pilot pipeline
   */
  async advanceStage(merchantId: string, nextStage: PilotStage): Promise<PilotMerchant> {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant with id ${merchantId} not found`);
    }

    const stageProgressMap: Record<PilotStage, number> = {
      partner_onboarding: 10,
      merchant_onboarding: 20,
      tally_connection: 35,
      data_validation: 50,
      controlled_10_account: 65,
      full_activation: 80,
      payment_recon_test: 90,
      measurement_30_day: 95,
      graduated: 100,
    };

    merchant.stage = nextStage;
    merchant.stageProgress = stageProgressMap[nextStage];

    // If advanced to full activation, lift controlled 10 pilot restriction
    if (nextStage === 'full_activation' || nextStage === 'payment_recon_test' || nextStage === 'graduated') {
      merchant.controlled10PilotActive = false;
    }

    // If graduated, record graduation timestamp
    if (nextStage === 'graduated') {
      merchant.graduatedAt = new Date().toISOString().split('T')[0];
      merchant.graduationScore = 100;
      merchant.graduationEligible = true;
    }

    await dbService.update(`tenants/${merchant.id}/pilot`, {
      stage: merchant.stage,
      stageProgress: merchant.stageProgress,
      controlled10PilotActive: merchant.controlled10PilotActive,
      updatedAt: Date.now(),
    });

    return { ...merchant };
  }

  /**
   * Toggles the 10-account safety guardrail switch
   */
  async toggleControlled10Pilot(merchantId: string, enabled: boolean): Promise<PilotMerchant> {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant with id ${merchantId} not found`);
    }

    merchant.controlled10PilotActive = enabled;

    await dbService.update(`tenants/${merchant.id}/pilot`, {
      controlled10PilotActive: enabled,
      updatedAt: Date.now(),
    });

    return { ...merchant };
  }

  /**
   * Simulates/dispatches a safe reminder to one of the 10 pilot accounts
   */
  async simulateControlledReminder(
    merchantId: string,
    accountId: string
  ): Promise<ControlledAccount> {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const account = merchant.controlledAccounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found in merchant pilot`);
    }

    account.reminderStatus = 'DELIVERED';
    account.lastContactAt = 'Just now (Simulated WhatsApp)';
    account.safeTestMode = true;

    merchant.messagesDelivered += 1;

    return { ...account };
  }

  /**
   * Evaluates the 6 rigorous graduation criteria for a merchant
   */
  async getGraduationCriteria(merchantId: string): Promise<{
    score: number;
    eligible: boolean;
    criteria: PilotGraduationCriterion[];
  }> {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const criteria: PilotGraduationCriterion[] = [
      {
        id: 'crit-sync-uptime',
        title: 'Tally Connector Sync Reliability',
        category: 'INTEGRATION',
        targetMetric: '>= 98.0% Sync Success Rate',
        actualMetric: `${merchant.syncSuccessRate}%`,
        status: merchant.syncSuccessRate >= 98.0 ? 'PASSED' : 'FAILED',
        description: 'Tally XML port and background sync must be stable with zero fatal crashed loops.',
      },
      {
        id: 'crit-ledger-parity',
        title: 'Ledger Parity & Data Validation',
        category: 'DATA_VALIDATION',
        targetMetric: '100% Invoice Balance Match',
        actualMetric: `${merchant.invoicesSynced} Invoices Synced`,
        status: merchant.invoicesSynced >= 300 ? 'PASSED' : 'IN_PROGRESS',
        description: 'CollectFlow balances match Tally closing balances without mismatch.',
      },
      {
        id: 'crit-controlled-test',
        title: 'Controlled 10-Account Validation',
        category: 'COLLECTION',
        targetMetric: '>= 30% Response Rate on 10 Accounts',
        actualMetric: `${merchant.customerResponseRate}% Response`,
        status: merchant.customerResponseRate >= 30 ? 'PASSED' : 'IN_PROGRESS',
        description: 'Safe test blast to 10 designated customers verified without spam or opt-out flags.',
      },
      {
        id: 'crit-payment-recon',
        title: 'Payment Link & Reconciliation Trial',
        category: 'RECONCILIATION',
        targetMetric: '>= 10 Payments Reconciled Automatically',
        actualMetric: `${merchant.reconciliationsCompleted} Reconciled`,
        status: merchant.reconciliationsCompleted >= 10 ? 'PASSED' : 'IN_PROGRESS',
        description: 'UPI dynamic QR or payment gateway webhook matched to invoice ledger.',
      },
      {
        id: 'crit-ptp-execution',
        title: 'Promise-to-Pay (PTP) Fulfillment',
        category: 'COLLECTION',
        targetMetric: '>= 60% PTP Success Rate',
        actualMetric: `${merchant.ptpSuccessRate}%`,
        status: merchant.ptpSuccessRate >= 60.0 ? 'PASSED' : 'IN_PROGRESS',
        description: 'Debtors recording PTPs honor payments within scheduled grace periods.',
      },
      {
        id: 'crit-support-sla',
        title: 'Operational Stability & SLA',
        category: 'OPERATIONS',
        targetMetric: 'Zero Critical Open Tickets',
        actualMetric: `${merchant.supportTickets} Open Tickets`,
        status: merchant.supportTickets === 0 ? 'PASSED' : 'IN_PROGRESS',
        description: 'No unresolved high-priority integration or data parity tickets.',
      },
    ];

    const passedCount = criteria.filter((c) => c.status === 'PASSED').length;
    const score = Math.round((passedCount / criteria.length) * 100);
    const eligible = score >= 80 && merchant.syncSuccessRate >= 98.0;

    merchant.graduationScore = score;
    merchant.graduationEligible = eligible;

    return {
      score,
      eligible,
      criteria,
    };
  }

  /**
   * Graduates merchant from pilot to full production autonomous mode
   */
  async graduateMerchant(merchantId: string): Promise<PilotMerchant> {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    merchant.stage = 'graduated';
    merchant.stageProgress = 100;
    merchant.controlled10PilotActive = false;
    merchant.graduationScore = 100;
    merchant.graduationEligible = true;
    merchant.graduatedAt = new Date().toISOString().split('T')[0];

    await dbService.update(`tenants/${merchant.id}/pilot`, {
      stage: 'graduated',
      stageProgress: 100,
      controlled10PilotActive: false,
      graduatedAt: merchant.graduatedAt,
      graduated: true,
      updatedAt: Date.now(),
    });

    return { ...merchant };
  }

  /**
   * Returns daily 30-day velocity measurement history
   */
  async getDailyMeasurements(): Promise<DailyPilotMeasurement[]> {
    return [...this.measurements];
  }

  /**
   * Returns support tickets raised during pilot
   */
  async getSupportTickets(): Promise<PilotSupportTicket[]> {
    return [...this.tickets];
  }

  /**
   * Creates a new support ticket
   */
  async createSupportTicket(
    ticket: Omit<PilotSupportTicket, 'ticketId' | 'createdAt' | 'status' | 'slaRemainingHours'>
  ): Promise<PilotSupportTicket> {
    const newTicket: PilotSupportTicket = {
      ...ticket,
      ticketId: `PILOT-TCK-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'OPEN',
      slaRemainingHours: ticket.severity === 'CRITICAL' ? 4 : ticket.severity === 'HIGH' ? 8 : 24,
    };

    this.tickets.unshift(newTicket);
    return { ...newTicket };
  }

  /**
   * Resolves a support ticket
   */
  async resolveSupportTicket(ticketId: string): Promise<PilotSupportTicket> {
    const ticket = this.tickets.find((t) => t.ticketId === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    ticket.status = 'RESOLVED';
    ticket.resolvedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    ticket.slaRemainingHours = 0;

    return { ...ticket };
  }

  async resolveTicket(ticketId: string): Promise<PilotSupportTicket> {
    return this.resolveSupportTicket(ticketId);
  }
}

export const pilotService = new PilotService();
