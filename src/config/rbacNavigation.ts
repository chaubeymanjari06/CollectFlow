import {
  LayoutDashboard,
  FileText,
  Users2,
  CreditCard,
  GitCompare,
  MessageSquare,
  Target,
  Sparkles,
  FileSpreadsheet,
  Briefcase,
  Receipt,
  Users,
  Settings,
  Activity,
  ShieldCheck,
  Rocket,
  Megaphone,
  LucideIcon,
} from 'lucide-react';
import { UserRole } from '../types';

export interface NavItemConfig {
  id: string;
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
  allowedRoles: UserRole[];
  isDiagnostic?: boolean;
}

/**
 * Master catalog of all application navigation menu areas with explicit role authorizations.
 * - OWNER: Full access to all business, executive, administrative and diagnostic tools.
 * - ADMIN: Operations, integrations, partner portal, billing, team, settings, and diagnostics.
 * - MANAGER (Senior Accountant / Munimji): Core financial ledgers, bills, payments, reconciliation, WhatsApp reminders, Tally sync, settings.
 * - EXECUTIVE (Collection Executive / Clerk): Daily collection queue, bills, customers, payments, WhatsApp reminders.
 * - PARTNER (CA / Auditor): Audit view of bills, customers, payments, reconciliation vouchers, CA portal, security logs.
 * - VIEWER: Read-only access to dashboard pulse, bills, and customers.
 */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    to: '/',
    labelKey: 'nav_dashboard',
    defaultLabel: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER'],
  },
  {
    id: 'invoices',
    to: '/invoices',
    labelKey: 'nav_invoices',
    defaultLabel: 'Invoices & Aging',
    icon: FileText,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER'],
  },
  {
    id: 'customers',
    to: '/customers',
    labelKey: 'nav_customers',
    defaultLabel: 'Customers 360',
    icon: Users2,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER', 'VIEWER'],
  },
  {
    id: 'payments',
    to: '/payments',
    labelKey: 'nav_payments',
    defaultLabel: 'Payments & UPI',
    icon: CreditCard,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE', 'PARTNER'],
  },
  {
    id: 'reconciliation',
    to: '/reconciliation',
    labelKey: 'nav_reconciliation',
    defaultLabel: 'Reconciliation',
    icon: GitCompare,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'PARTNER'],
  },
  {
    id: 'reminders',
    to: '/reminders',
    labelKey: 'nav_reminders',
    defaultLabel: 'WhatsApp Reminders',
    icon: MessageSquare,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE'],
  },
  {
    id: 'analytics',
    to: '/analytics',
    labelKey: 'nav_analytics',
    defaultLabel: 'Collection Intelligence',
    icon: Target,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'copilot',
    to: '/copilot',
    labelKey: 'nav_copilot',
    defaultLabel: 'AI Copilot',
    icon: Sparkles,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'promotions',
    to: '/promotions',
    labelKey: 'nav_promotions',
    defaultLabel: 'Promotions Hub',
    icon: Megaphone,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'integrations',
    to: '/integrations',
    labelKey: 'nav_integrations',
    defaultLabel: 'Integrations & Import',
    icon: FileSpreadsheet,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'partner',
    to: '/partner',
    labelKey: 'nav_partner',
    defaultLabel: 'CA / Partner Portal',
    icon: Briefcase,
    allowedRoles: ['OWNER', 'ADMIN', 'PARTNER'],
  },
  {
    id: 'billing',
    to: '/billing',
    labelKey: 'nav_billing',
    defaultLabel: 'Billing & Plans',
    icon: Receipt,
    allowedRoles: ['OWNER', 'ADMIN'],
  },
  {
    id: 'team',
    to: '/team',
    labelKey: 'nav_team',
    defaultLabel: 'Team & Roles',
    icon: Users,
    allowedRoles: ['OWNER', 'ADMIN'],
  },
  {
    id: 'settings',
    to: '/settings',
    labelKey: 'nav_settings',
    defaultLabel: 'Settings & Sync',
    icon: Settings,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  // Diagnostics
  {
    id: 'observability',
    to: '/observability',
    labelKey: 'nav_observability',
    defaultLabel: 'Operations & Health',
    icon: Activity,
    allowedRoles: ['OWNER', 'ADMIN'],
    isDiagnostic: true,
  },
  {
    id: 'security',
    to: '/security',
    labelKey: 'nav_security',
    defaultLabel: 'Security & Compliance',
    icon: ShieldCheck,
    allowedRoles: ['OWNER', 'ADMIN', 'PARTNER'],
    isDiagnostic: true,
  },
  {
    id: 'pilot',
    to: '/pilot',
    labelKey: 'nav_pilot',
    defaultLabel: 'Pilot Operations',
    icon: Rocket,
    allowedRoles: ['OWNER', 'ADMIN'],
    isDiagnostic: true,
  },
];

/**
 * Filter navigation items permitted strictly for the given user role.
 */
export function getAllowedNavItems(
  role: UserRole | null | undefined,
  isOwner: boolean = false
): {
  coreItems: NavItemConfig[];
  diagnosticItems: NavItemConfig[];
} {
  if (isOwner || role === 'OWNER') {
    return {
      coreItems: ALL_NAV_ITEMS.filter((item) => !item.isDiagnostic),
      diagnosticItems: ALL_NAV_ITEMS.filter((item) => item.isDiagnostic),
    };
  }

  if (!role) {
    return { coreItems: [], diagnosticItems: [] };
  }

  const allowed = ALL_NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
  return {
    coreItems: allowed.filter((item) => !item.isDiagnostic),
    diagnosticItems: allowed.filter((item) => item.isDiagnostic),
  };
}

/**
 * Returns human-friendly presentation metadata for each user role.
 */
export function getRoleMeta(role: UserRole | null | undefined): {
  title: string;
  subtitle: string;
  badgeClass: string;
} {
  switch (role) {
    case 'OWNER':
      return {
        title: 'Business Owner',
        subtitle: 'Sethji (Full Business Access)',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'ADMIN':
      return {
        title: 'System Admin',
        subtitle: 'Administrator & CA Portal',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'MANAGER':
      return {
        title: 'Senior Accountant',
        subtitle: 'Munimji (Ledger & Reconciliation)',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      };
    case 'EXECUTIVE':
      return {
        title: 'Collection Executive',
        subtitle: 'Accounts Clerk (WhatsApp & Follow-ups)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'PARTNER':
      return {
        title: 'CA / Tax Partner',
        subtitle: 'Auditor & Advisory',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'VIEWER':
      return {
        title: 'Read-Only Viewer',
        subtitle: 'Stakeholder View',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    default:
      return {
        title: 'Standard User',
        subtitle: 'Member Access',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
}
