import React, { useState } from 'react';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export const CompanySwitcher: React.FC = () => {
  const { activeTenant, availableTenants, switchTenant, role } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-left"
      >
        <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">
          {activeTenant?.name?.charAt(0).toUpperCase() || 'C'}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[140px]">
            {activeTenant?.name || 'Select Company'}
          </span>
          <span className="text-[10px] font-medium text-slate-400 capitalize">
            {role?.toLowerCase() || 'Member'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1 w-64 rounded-xl bg-white shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Your Companies
            </div>
            <div className="max-h-56 overflow-y-auto">
              {availableTenants.map((tenant) => {
                const isActive = tenant.tenantId === activeTenant?.tenantId;
                return (
                  <button
                    key={tenant.tenantId}
                    onClick={() => {
                      switchTenant(tenant.tenantId);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition ${
                      isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <div className="truncate max-w-[160px]">{tenant.name}</div>
                        {tenant.gstin && (
                          <div className="text-[10px] text-slate-400 font-normal">GST: {tenant.gstin}</div>
                        )}
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-brand-600" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/company-setup');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-600 font-medium hover:bg-brand-50 transition"
              >
                <Plus className="w-4 h-4" />
                Add New Company
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
