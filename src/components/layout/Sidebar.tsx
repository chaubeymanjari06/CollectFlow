import React from 'react';
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
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const Sidebar: React.FC = () => {
  const { activeTenant } = useTenant();

  const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Invoices & Aging', to: '/invoices', icon: FileText },
    { label: 'Customers 360', to: '/customers', icon: Users2 },
    { label: 'Payments & UPI', to: '/payments', icon: CreditCard },
    { label: 'Reconciliation', to: '/reconciliation', icon: GitCompare },
    { label: 'WhatsApp Reminders', to: '/reminders', icon: MessageSquare },
    { label: 'Collection Intelligence', to: '/analytics', icon: Target },
    { label: 'AI Copilot', to: '/copilot', icon: Sparkles },
    { label: 'Integrations & Import', to: '/integrations', icon: FileSpreadsheet },
    { label: 'CA / Partner Portal', to: '/partner', icon: Briefcase },
    { label: 'Billing & Plans', to: '/billing', icon: Receipt },
    { label: 'Operations & Health', to: '/observability', icon: Activity },
    { label: 'Team & Roles', to: '/team', icon: Users },
    { label: 'Settings & Sync', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-screen sticky top-0">
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

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
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
        </nav>
      </div>

      {/* Tally Desktop Agent Connectivity Status */}
      <div className="p-4 border-t border-slate-100">
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
                {activeTenant?.tallyConnected ? 'Agent Live' : 'Not Connected'}
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
