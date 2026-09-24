import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Layers, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account exists with this email.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/25 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CollectFlow</h1>
          <p className="text-xs text-slate-500 mt-1">
            Receivables & Follow-up Automation for MSMEs
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2.5 text-xs text-rose-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Business Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accounts@yourbusiness.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 transition"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
          New to CollectFlow?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 transition">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};
