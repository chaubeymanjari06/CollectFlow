import React from 'react';
import { LogOut, Bell, Languages } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { CompanySwitcher } from './CompanySwitcher';
import { AppLanguage } from '../../types';
import { getRoleMeta } from '../../config/rbacNavigation';

export const Navbar: React.FC = () => {
  const { userProfile, currentUser, logout } = useAuth();
  const { role } = useTenant();
  const { language, setLanguage } = useLanguage();
  const roleMeta = getRoleMeta(role);

  const languages: Array<{ code: AppLanguage; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'gu', label: 'ગુજરાતી' },
  ];

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <CompanySwitcher />
      </div>

      <div className="flex items-center gap-3">
        {/* Phase 19: Vernacular Language Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <Languages className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`px-2 py-1 rounded-lg transition ${
                language === l.code
                  ? 'bg-white text-brand-700 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button
          title="Notifications"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition relative"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
            {userProfile?.name?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800">
                {userProfile?.name || 'User'}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${roleMeta.badgeClass}`}
                data-testid="navbar-role-badge"
              >
                {role || 'MEMBER'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
              {currentUser?.email}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          title="Logout"
          className="p-2 ml-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
