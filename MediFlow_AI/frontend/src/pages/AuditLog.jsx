import React, { useEffect, useMemo, useState } from 'react';
import { Search, ScrollText } from 'lucide-react';
import { apiFetch } from '../api';

const ACTION_STYLE = {
  TRIAGE: 'bg-blue-100 text-blue-700', ASSIGN: 'bg-violet-100 text-violet-700',
  SCHEDULE: 'bg-amber-100 text-amber-700', ALLOCATE: 'bg-emerald-100 text-emerald-700',
  COMPLETE: 'bg-cyan-100 text-cyan-700', REGISTER: 'bg-sky-100 text-sky-700',
  VIEW: 'bg-slate-100 text-slate-600', PRESCRIBE: 'bg-indigo-100 text-indigo-700',
  SAFETY_OVERRIDE: 'bg-red-100 text-red-700', CRITICAL: 'bg-red-100 text-red-700',
  LOCKOUT: 'bg-red-100 text-red-700', SIGNUP: 'bg-green-100 text-green-700',
  DELETE: 'bg-red-100 text-red-700', RESET: 'bg-amber-100 text-amber-700',
  RECOMMEND: 'bg-purple-100 text-purple-700', PAYMENT: 'bg-yellow-100 text-yellow-700',
};
const badge = (a) => ACTION_STYLE[a] || 'bg-slate-100 text-slate-600';
const fmt = (t) => (t ? new Date(t).toLocaleString() : '');

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('All');
  const [err, setErr] = useState('');

  useEffect(() => { apiFetch('/system/logs').then(setLogs).catch((e) => setErr(e.message)); }, []);

  const agents = useMemo(() => ['All', ...Array.from(new Set(logs.map((l) => l.agent_name))).sort()], [logs]);
  const filtered = logs.filter((l) => {
    if (agent !== 'All' && l.agent_name !== agent) return false;
    if (!q) return true;
    return [l.agent_name, l.action_type, l.message, l.actor].join(' ').toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2.5 bg-primary/10 rounded-xl"><ScrollText className="w-5 h-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Audit Log</h1>
          <p className="text-text-secondary text-sm">Every action, attributed and time-stamped · {logs.length} events</p>
        </div>
      </div>

      <div className="flex gap-3 my-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, message, action…"
            className="w-full pl-10 pr-3 py-2 border border-border-color rounded-lg bg-surface-primary text-text-primary outline-none focus:border-primary" />
        </div>
        <select value={agent} onChange={(e) => setAgent(e.target.value)}
          className="px-3 py-2 border border-border-color rounded-lg bg-surface-primary text-text-primary outline-none focus:border-primary">
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {err && <div className="text-red-600 bg-red-50 rounded p-2 mb-4 text-sm">{err}</div>}

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary border-b border-border-color bg-surface-secondary/40">
              <tr>{['Time', 'Agent / Area', 'Action', 'Actor', 'Details'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border-color/40 hover:bg-surface-secondary/50">
                  <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">{fmt(l.timestamp)}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{l.agent_name}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(l.action_type)}`}>{l.action_type}</span></td>
                  <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">{l.actor || '—'}</td>
                  <td className="px-4 py-2.5 text-text-primary">{l.message}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No matching events.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
