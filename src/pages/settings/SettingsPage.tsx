import React from 'react';
import { Settings, Building2, Radio, KeyRound, Bell } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const SettingsPage: React.FC = () => {
  const { activeTenant, role } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Company & Sync Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your business profile, Tally connector pairing, and integration API credentials
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            Company Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-slate-500">Company Name</span>
              <div className="font-bold text-slate-800 mt-0.5">{activeTenant?.name}</div>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Legal Entity Name</span>
              <div className="font-bold text-slate-800 mt-0.5">{activeTenant?.legalName || '—'}</div>
            </div>
            <div>
              <span className="font-semibold text-slate-500">GSTIN</span>
              <div className="font-mono font-bold text-slate-800 mt-0.5">{activeTenant?.gstin || 'Not Provided'}</div>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Your Current Role</span>
              <div className="font-bold text-brand-600 mt-0.5">{role}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-600" />
            Tally Windows Agent Connection
          </h3>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <div className="font-bold text-slate-800">
                Connection Status: {activeTenant?.tallyConnected ? 'Active' : 'Disconnected'}
              </div>
              <p className="text-slate-400 mt-0.5">
                Download the lightweight CollectFlow Windows Agent on your Tally machine to begin automated sync.
              </p>
            </div>
            <button className="px-3.5 py-2 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 transition self-start sm:self-auto shrink-0">
              Download Windows Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
