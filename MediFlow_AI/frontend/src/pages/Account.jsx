import React, { useState } from 'react';
import { apiFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

export default function Account() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(form) });
      setMsg({ type: 'ok', text: 'Password updated.' });
      setForm({ current_password: '', new_password: '' });
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-text-primary mb-1">Account</h1>
      <p className="text-text-secondary text-sm mb-5">{user?.full_name} · {user?.role}</p>
      <form onSubmit={submit} className="glass-panel rounded-xl p-5 space-y-3">
        <div className="text-sm font-semibold text-text-primary">Change password</div>
        <input className="fld" type="password" placeholder="Current password" value={form.current_password}
          onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
        <input className="fld" type="password" placeholder="New password (min 8 chars)" value={form.new_password}
          onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
        {msg && <div className={`text-sm rounded p-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
        <button className="btn-blue">Update password</button>
      </form>
      <style>{`.fld{width:100%;padding:.55rem .75rem;border:1px solid #cbd5e1;border-radius:.5rem;font-size:.9rem}.btn-blue{padding:.5rem .85rem;background:#2563eb;color:#fff;border-radius:.6rem;font-size:.9rem;font-weight:500}`}</style>
    </div>
  );
}
