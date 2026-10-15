import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist'];
const SPECIALIZATIONS = ['Cardiology', 'Neurology', 'Orthopedics', 'General', 'Pediatrics', 'Emergency', 'Maternity'];

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '', password: '', full_name: '', role: 'Doctor', specialization: 'General',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: form.username, password: form.password }),
        });
        setAuth(data.access_token, data.user);
      } else {
        const body = {
          username: form.username, full_name: form.full_name,
          password: form.password, role: form.role,
          specialization: form.role === 'Doctor' ? form.specialization : null,
        };
        const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) });
        setAuth(data.access_token, data.user);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-3">
            <Activity size={22} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">MediFlow AI</h1>
          <p className="text-sm text-slate-500">Hospital Operations &amp; EHR</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex mb-5 border-b border-slate-100">
            {['login', 'signup'].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 pb-2.5 text-sm font-medium border-b-2 -mb-px transition ${mode === m ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <Field label="Full name">
                <input className="input" placeholder="e.g. Dr. Asha Rao" value={form.full_name} onChange={set('full_name')} required />
              </Field>
            )}
            <Field label="User ID">
              <input className="input" placeholder="your.username" value={form.username} onChange={set('username')} required />
            </Field>
            <Field label="Password">
              <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </Field>

            {mode === 'signup' && (
              <div className={`grid gap-3 ${form.role === 'Doctor' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Field label="Role">
                  <select className="input" value={form.role} onChange={set('role')}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                {form.role === 'Doctor' && (
                  <Field label="Specialization">
                    <select className="input" value={form.specialization} onChange={set('specialization')}>
                      {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}

            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 transition mt-1">
              {loading && <Loader2 className="animate-spin" size={16} />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} MediFlow AI · For demonstration use</p>
      </div>

      <style>{`
        .input{width:100%;padding:0.55rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.55rem;font-size:0.9rem;outline:none;background:#fff;color:#0f172a;transition:border-color .15s, box-shadow .15s}
        .input:focus{border-color:#0f172a;box-shadow:0 0 0 3px rgba(15,23,42,.08)}
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
