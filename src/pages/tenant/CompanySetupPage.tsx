import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';

export const CompanySetupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { createCompany } = useTenant();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createCompany({
        name,
        legalName: legalName || name,
        gstin: gstin.trim().toUpperCase() || undefined,
        email,
        mobile,
        currency: 'INR',
        defaultPaymentTermsDays: Number(defaultPaymentTermsDays),
      });

      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to setup company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Setup Your Company</h1>
            <p className="text-xs text-slate-500">
              Configure your business profile to link Tally and start collecting payments
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2.5 text-xs text-rose-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Display Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shree Enterprises"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Shree Enterprises Pvt Ltd"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 27AABCS1429B1Z"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Payment Terms
              </label>
              <select
                value={defaultPaymentTermsDays}
                onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition bg-white"
              >
                <option value={15}>Net 15 Days</option>
                <option value={30}>Net 30 Days</option>
                <option value={45}>Net 45 Days</option>
                <option value={60}>Net 60 Days</option>
                <option value={90}>Net 90 Days</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Accounts Contact Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accounts@shree.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Dispatch Phone *
              </label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100 flex items-start gap-2.5 mt-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-brand-900 leading-relaxed">
              Your company will be isolated into a dedicated tenant namespace in Firebase Realtime Database. You will automatically receive the <strong>OWNER</strong> role.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Creating Company...' : 'Save & Enter Dashboard'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
