import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Layers,
  Radio,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAllowedNavItems, getRoleMeta } from '../../config/rbacNavigation';

export const Sidebar: React.FC = () => {
  const { activeTenant, role, isOwner } = useTenant();
  const { t } = useLanguage();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Strictly filter navigation items permitted for the user's role
  const { coreItems, diagnosticItems } = getAllowedNavItems(role, isOwner);
  const roleMeta = getRoleMeta(role);

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

        {/* Role Identity & Area Scope Card */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
              <span className="flex items-center gap-1.5 text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                <span>Active Role</span>
              </span>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${roleMeta.badgeClass}`}
                data-testid="sidebar-role-badge"
              >
                {role || 'MEMBER'}
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-700">
              {roleMeta.title}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {roleMeta.subtitle}
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Links (Only Permitted Menu Areas) */}
        <nav className="p-4 space-y-1" data-testid="sidebar-nav-list">
          {coreItems.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey, item.defaultLabel);
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
                <span>{label}</span>
              </NavLink>
            );
          })}

          {/* Role-Authorized Diagnostics Drawer */}
          {diagnosticItems.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition"
                data-testid="toggle-diagnostics-drawer"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('nav_diagnostics', 'Admin & Diagnostics')}</span>
                </span>
                {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDiagnostics && (
                <div className="mt-1 pl-2 space-y-1 border-l-2 border-slate-100 ml-3">
                  {diagnosticItems.map((item) => {
                    const Icon = item.icon;
                    const label = t(item.labelKey, item.defaultLabel);
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
                        <span>{label}</span>
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
