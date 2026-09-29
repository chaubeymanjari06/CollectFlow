import React from 'react';
import { LogOut, Bell, Languages, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { CompanySwitcher } from './CompanySwitcher';
import { AppLanguage } from '../../types';
import { getRoleMeta } from '../../config/rbacNavigation';

export interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { userProfile, currentUser, logout } = useAuth();
  const { role } = useTenant();
  const { language, setLanguage } = useLanguage();
  const roleMeta = getRoleMeta(role);

  const languages: Array<{ code: AppLanguage; label: string; short: string }> = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिन्दी', short: 'HI' },
    { code: 'gu', label: 'ગુજરાતી', short: 'GU' },
  ];

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label="Open Navigation Menu"
            data-testid="navbar-mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <CompanySwitcher />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Phase 19: Vernacular Language Toggle */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl text-xs font-semibold text-slate-600">
          <Languages className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5 hidden xs:inline" />
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition text-[11px] sm:text-xs ${
                language === l.code
                  ? 'bg-white text-brand-700 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sm:hidden">{l.short}</span>
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
