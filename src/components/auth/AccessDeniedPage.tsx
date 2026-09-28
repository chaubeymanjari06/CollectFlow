import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { getRoleMeta } from '../../config/rbacNavigation';
import { UserRole } from '../../types';

interface AccessDeniedPageProps {
  allowedRoles?: UserRole[];
  areaName?: string;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  allowedRoles = [],
  areaName = 'this section',
}) => {
  const navigate = useNavigate();
  const { role } = useTenant();
  const roleMeta = getRoleMeta(role);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Access Restricted / प्रवेश प्रतिबंधित
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Your assigned user role does not have authorization to access <strong>{areaName}</strong>.
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-left text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Your Current Role:</span>
            <span className={`px-2 py-0.5 rounded font-semibold text-[11px] border ${roleMeta.badgeClass}`}>
              {roleMeta.title} ({role || 'NONE'})
            </span>
          </div>
          {allowedRoles.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Authorized Roles:</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {allowedRoles.map((r) => (
                  <span key={r} className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-medium">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400">
          Each user type in CollectFlow can only access their designated menu areas. If you need access to this section, please ask your business owner (Sethji) or company administrator to adjust your role.
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            Allowed Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
