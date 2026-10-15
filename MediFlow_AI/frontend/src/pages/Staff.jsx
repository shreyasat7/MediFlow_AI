import React, { useEffect, useState } from 'react';
import { UserPlus, KeyRound, Power, Trash2, X, Shield, Search } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist'];
const ROLE_BADGE = {
  Admin: 'bg-violet-100 text-violet-700', Doctor: 'bg-blue-100 text-blue-700',
  Nurse: 'bg-emerald-100 text-emerald-700', Receptionist: 'bg-amber-100 text-amber-700',
};
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Staff() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'Nurse', specialization: 'General' });
  const [msg, setMsg] = useState(null);

  const load = async () => { try { setUsers(await apiFetch('/auth/users')); } catch (e) { setMsg({ type: 'err', text: e.message }); } };
  useEffect(() => { load(); }, []);

  const selected = users.find((u) => u.id === selectedId) || null;
  const isSelf = selected && me && selected.id === me.id;
  const filtered = users.filter(
    (u) => !q || [u.full_name, u.username, u.role].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500); };

  const create = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ username: '', full_name: '', password: '', role: 'Nurse', specialization: 'General' });
      setShowCreate(false); flash('ok', 'User created.'); load();
    } catch (err) { flash('err', err.message); }
  };
  const toggle = async () => {
    try { await apiFetch(`/auth/users/${selected.id}/active`, { method: 'PATCH', body: JSON.stringify({ is_active: !selected.is_active }) }); flash('ok', `${selected.username} ${selected.is_active ? 'deactivated' : 'activated'}.`); load(); }
    catch (e) { flash('err', e.message); }
  };
  const del = async () => {
    if (!confirm(`Delete account "${selected.username}"? This cannot be undone.`)) return;
    try { await apiFetch(`/auth/users/${selected.id}`, { method: 'DELETE' }); setSelectedId(null); flash('ok', 'Account deleted.'); load(); }
    catch (e) { flash('err', e.message); }
  };
  const reset = async () => {
    const pw = prompt(`New password for "${selected.username}" (min 8 characters):`);
    if (!pw) return;
    try { await apiFetch(`/auth/users/${selected.id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: pw }) }); flash('ok', 'Password reset (account unlocked).'); }
    catch (e) { flash('err', e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl"><Shield className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Staff & Access</h1>
            <p className="text-text-secondary text-sm">{users.length} accounts · select a row to manage</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
          <UserPlus size={16} /> New user
        </button>
      </div>

      {msg && <div className={`mb-4 text-sm rounded-lg p-2.5 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {/* Contextual action bar */}
      {selected && (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap glass-panel rounded-xl px-4 py-3 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">{initials(selected.full_name)}</div>
            <div>
              <div className="font-semibold text-text-primary text-sm">{selected.full_name} <span className="text-text-secondary font-normal">· {selected.username}</span></div>
              <div className="text-xs text-text-secondary">{selected.role} · {selected.is_active ? 'Active' : 'Disabled'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="action"><KeyRound size={15} /> Reset password</button>
            {!isSelf && <button onClick={toggle} className="action"><Power size={15} /> {selected.is_active ? 'Deactivate' : 'Activate'}</button>}
            {!isSelf && <button onClick={del} className="action-danger"><Trash2 size={15} /> Delete</button>}
            <button onClick={() => setSelectedId(null)} className="p-1.5 text-text-secondary hover:text-text-primary"><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, user ID or role…"
          className="w-full pl-10 pr-3 py-2 border border-border-color rounded-lg bg-surface-primary text-text-primary outline-none focus:border-primary" />
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary border-b border-border-color bg-surface-secondary/40">
            <tr>{['User', 'User ID', 'Role', 'Status'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">No matching users.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} onClick={() => setSelectedId(u.id === selectedId ? null : u.id)}
                className={`border-b border-border-color/40 cursor-pointer transition ${u.id === selectedId ? 'bg-primary/5' : 'hover:bg-surface-secondary/50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-surface-secondary flex items-center justify-center text-xs font-semibold text-text-secondary">{initials(u.full_name)}</div>
                    <span className="font-medium text-text-primary">{u.full_name}{u.id === me?.id && <span className="text-xs text-text-secondary"> (you)</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary">{u.username}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />{u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={create} className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-bold text-lg">Create user</h2>
              <button type="button" onClick={() => setShowCreate(false)}><X size={20} /></button>
            </div>
            <input className="fld" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            <input className="fld" placeholder="User ID" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <input className="fld" type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <div className={`grid gap-3 ${form.role === 'Doctor' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <select className="fld" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              {form.role === 'Doctor' && <input className="fld" placeholder="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />}
            </div>
            <button className="w-full bg-primary text-white py-2.5 rounded-lg font-medium">Create account</button>
          </form>
        </div>
      )}

      <style>{`
        .fld{width:100%;padding:.6rem .8rem;border:1px solid #cbd5e1;border-radius:.6rem;font-size:.9rem}
        .action{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .75rem;border:1px solid var(--border-color,#cbd5e1);border-radius:.55rem;font-size:.8rem;font-weight:500;color:var(--text-primary,#0f172a)}
        .action:hover{background:rgba(37,99,235,.06);border-color:#93c5fd}
        .action-danger{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .75rem;border:1px solid #fecaca;color:#dc2626;border-radius:.55rem;font-size:.8rem;font-weight:500}
        .action-danger:hover{background:#fef2f2}
      `}</style>
    </div>
  );
}
