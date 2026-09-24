import React from 'react';
import { MessageSquare, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const RemindersPage: React.FC = () => {
  const { activeTenant } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">WhatsApp Collection Workflows</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated, Meta policy-compliant reminder sequences for due and overdue invoices
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-600" />
            Configured Reminder Intervals
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Pre-Due Notification (Due -3 Days)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">Friendly reminder with bill attachment and UPI link</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">Enabled</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Due Date Notification (Today)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">Alerts customer that payment is due today</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">Enabled</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Overdue Follow-up (+7, +15 Days)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">Follow-up with Promise to Pay (PTP) quick-reply button</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">Enabled</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            Safety & Protection Rules
          </h3>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">PTP Pause:</span> Reminders are automatically paused when a customer commits to pay by a specific date.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">Deduplication:</span> Maximum of 1 reminder per invoice in any 48-hour window.
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">Opt-Out Protection:</span> Customers requesting opt-out are permanently excluded from bulk reminders.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
