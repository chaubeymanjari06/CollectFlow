import React from 'react';
import { LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CompanySwitcher } from './CompanySwitcher';

export const Navbar: React.FC = () => {
  const { userProfile, currentUser, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <CompanySwitcher />
      </div>

      <div className="flex items-center gap-3">
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
            <span className="text-xs font-semibold text-slate-800">
              {userProfile?.name || 'User'}
            </span>
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
