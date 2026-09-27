import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users2,
  CreditCard,
  GitCompare,
  MessageSquare,
  Users,
  Settings,
  Layers,
  Radio,
  Target,
  Sparkles,
  FileSpreadsheet,
  Briefcase,
  Receipt,
  Activity,
  ShieldCheck,
  Rocket,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const Sidebar: React.FC = () => {
  const { activeTenant, isOwner, isAdmin, isPartner } = useTenant();
  const { t } = useLanguage();

  // Role-Based Dynamic View: 'ACCOUNTANT' (Munimji), 'OWNER' (Sethji), 'ADMIN' (CA/Partner), or 'ALL'
  const defaultPersona = isOwner
    ? 'OWNER'
    : isPartner
    ? 'ADMIN'
    : isAdmin
    ? 'ADMIN'
    : 'ACCOUNTANT';

  const [activePersona, setActivePersona] = useState<'ACCOUNTANT' | 'OWNER' | 'ADMIN' | 'ALL'>(defaultPersona);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Master List of Navigation Items
  const allNavItems = [
    { label: t('nav_dashboard', 'Dashboard'), to: '/', icon: LayoutDashboard, personas: ['ACCOUNTANT', 'OWNER', 'ADMIN'] },
    { label: t('nav_invoices', 'Invoices & Aging'), to: '/invoices', icon: FileText, personas: ['ACCOUNTANT', 'OWNER'] },
    { label: t('nav_customers', 'Customers 360'), to: '/customers', icon: Users2, personas: ['ACCOUNTANT', 'OWNER'] },
    { label: t('nav_payments', 'Payments & UPI'), to: '/payments', icon: CreditCard, personas: ['OWNER', 'ADMIN'] },
    { label: t('nav_reconciliation', 'Reconciliation'), to: '/reconciliation', icon: GitCompare, personas: ['ACCOUNTANT'] },
    { label: t('nav_reminders', 'WhatsApp Reminders'), to: '/reminders', icon: MessageSquare, personas: ['ACCOUNTANT'] },
    { label: t('nav_analytics', 'Collection Intelligence'), to: '/analytics', icon: Target, personas: ['OWNER'] },
    { label: t('nav_copilot', 'AI Copilot'), to: '/copilot', icon: Sparkles, personas: ['OWNER'] },
    { label: t('nav_integrations', 'Integrations & Import'), to: '/integrations', icon: FileSpreadsheet, personas: ['ADMIN'] },
    { label: t('nav_partner', 'CA / Partner Portal'), to: '/partner', icon: Briefcase, personas: ['ADMIN'] },
    { label: t('nav_billing', 'Billing & Plans'), to: '/billing', icon: Receipt, personas: ['OWNER', 'ADMIN'] },
    { label: t('nav_team', 'Team & Roles'), to: '/team', icon: Users, personas: ['OWNER', 'ADMIN'] },
    { label: t('nav_settings', 'Settings & Sync'), to: '/settings', icon: Settings, personas: ['ADMIN', 'ACCOUNTANT'] },
  ];

  const diagnosticNavItems = [
    { label: t('nav_observability', 'Operations & Health'), to: '/observability', icon: Activity },
    { label: t('nav_security', 'Security & Compliance'), to: '/security', icon: ShieldCheck },
    { label: t('nav_pilot', 'Pilot Operations'), to: '/pilot', icon: Rocket },
  ];

  const displayedNavItems = activePersona === 'ALL'
    ? [...allNavItems, ...diagnosticNavItems]
    : allNavItems.filter((item) => item.personas.includes(activePersona));

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-screen sticky top-0 overflow-y-auto">
      <div>
        {/* App Brand Header */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-none flex items-center gap-1.5 text-base tracking-tight">
              CollectFlow
            </div>
            <div className="text-[10px] font-semibold text-brand-600 uppercase tracking-widest mt-0.5">
              Receivables SaaS
            </div>
          </div>
        </div>

        {/* Phase 19: Role-Based Persona Selector */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5 px-1">
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-brand-600" />
              Role View
            </span>
            <span className="text-[10px] text-brand-600 uppercase font-bold tracking-wider">
              {activePersona === 'ACCOUNTANT' ? 'Munimji' : activePersona === 'OWNER' ? 'Sethji' : activePersona === 'ADMIN' ? 'Admin/CA' : 'All 16'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg text-[10px] font-medium text-slate-600 text-center">
            <button
              onClick={() => setActivePersona('ACCOUNTANT')}
              className={`py-1 rounded transition ${activePersona === 'ACCOUNTANT' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'hover:text-slate-900'}`}
              title="Senior Accountant / Munimji (5 Core Tools)"
            >
              Acct
            </button>
            <button
              onClick={() => setActivePersona('OWNER')}
              className={`py-1 rounded transition ${activePersona === 'OWNER' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'hover:text-slate-900'}`}
              title="Business Owner / Sethji (Executive Pulse & Cash Flow)"
            >
              Owner
            </button>
            <button
              onClick={() => setActivePersona('ADMIN')}
              className={`py-1 rounded transition ${activePersona === 'ADMIN' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'hover:text-slate-900'}`}
              title="Admin & CA Portal"
            >
              CA
            </button>
            <button
              onClick={() => setActivePersona('ALL')}
              className={`py-1 rounded transition ${activePersona === 'ALL' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'hover:text-slate-900'}`}
              title="Show all 16 navigation tools"
            >
              All
            </button>
          </div>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="p-4 space-y-1">
          {displayedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {/* Phase 19: Collapsible Admin & Diagnostics Drawer (when not in 'ALL' mode) */}
          {activePersona !== 'ALL' && (
            <div className="pt-2">
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  {t('nav_diagnostics', 'Admin & Diagnostics')}
                </span>
                {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDiagnostics && (
                <div className="mt-1 pl-2 space-y-1 border-l-2 border-slate-100 ml-3">
                  {diagnosticNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            isActive
                              ? 'bg-brand-50 text-brand-700 font-semibold'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          }`
                        }
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Tally Desktop Agent Connectivity Status */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${
                activeTenant?.tallyConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
              }`}
            />
            <div>
              <div className="text-[11px] font-semibold text-slate-700">Tally Connector</div>
              <div className="text-[10px] text-slate-400">
                {activeTenant?.tallyConnected ? 'Agent Live (Helper)' : 'Not Connected'}
              </div>
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              activeTenant?.tallyConnected ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
        </div>
      </div>
    </aside>
  );
};
