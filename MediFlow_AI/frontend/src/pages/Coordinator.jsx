import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Cpu, Radio, Activity } from 'lucide-react';
import { rawFetch, wsUrl } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const AGENT_COLORS = {
  'Patient Intake': '#2563eb', 'Doctor Assignment': '#8b5cf6', Diagnostic: '#f59e0b',
  'Bed Management': '#10b981', Coordinator: '#06b6d4', Registration: '#0ea5e9',
  Access: '#64748b', Pharmacy: '#ef4444', Vitals: '#e11d48', Scheduling: '#14b8a6',
  Billing: '#eab308', 'AI Assist': '#7c3aed', Import: '#22c55e',
};
const colorFor = (name) => AGENT_COLORS[name] || '#64748b';
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString() : '');

export default function Coordinator() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState({ by_agent: {}, total_events: 0 });
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  const loadStats = async () => {
    try { const r = await rawFetch('/system/agent-stats'); if (r.ok) setStats(await r.json()); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadStats();
    // Seed the feed with the most recent logs
    rawFetch('/system/logs').then(async (r) => {
      if (r.ok) { const logs = await r.json(); setFeed(logs.slice(0, 25)); }
    }).catch(() => {});
    const poll = setInterval(loadStats, 8000);

    // Live activity WebSocket
    let ws;
    try {
      ws = new WebSocket(wsUrl(`/ws/activity?token=${encodeURIComponent(token || '')}`));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (evt) => {
        try {
          const row = JSON.parse(evt.data);
          setFeed((f) => [row, ...f].slice(0, 100));
          setStats((s) => ({
            total_events: (s.total_events || 0) + 1,
            by_agent: { ...s.by_agent, [row.agent_name]: (s.by_agent?.[row.agent_name] || 0) + 1 },
          }));
        } catch { /* ignore */ }
      };
    } catch { setConnected(false); }

    return () => { clearInterval(poll); if (ws) ws.close(); };
  }, [token]);

  const agents = Object.entries(stats.by_agent || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl"><Network className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Coordinator AI</h1>
            <p className="text-text-secondary text-sm">Live agent orchestration & activity</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
          {connected ? 'Live' : 'Reconnecting…'}
        </div>
      </div>

      {/* Totals + per-agent counts */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-text-secondary">Total agent events</div>
            <div className="text-3xl font-bold text-text-primary mt-1">{stats.total_events ?? 0}</div>
          </div>
          <Cpu className="w-9 h-9 text-primary" />
        </div>
        {agents.slice(0, 3).map(([name, count]) => (
          <div key={name} className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(name) }} /> {name}
            </div>
            <div className="text-3xl font-bold text-text-primary mt-1">{count}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Per-agent breakdown */}
        <div className="glass-panel rounded-xl p-5">
          <h2 className="font-semibold text-text-primary mb-4">Agent activity</h2>
          <div className="space-y-3">
            {agents.length === 0 && <p className="text-text-secondary text-sm">No activity yet.</p>}
            {agents.map(([name, count]) => {
              const max = agents[0][1] || 1;
              return (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-primary">{name}</span>
                    <span className="text-text-secondary">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: colorFor(name) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live feed */}
        <div className="glass-panel rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-text-primary">Live activity feed</h2>
          </div>
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {feed.length === 0 && <p className="text-text-secondary text-sm">Waiting for activity…</p>}
            {feed.map((row, i) => (
              <motion.div key={`${row.id}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-secondary">
                <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: colorFor(row.agent_name) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">{row.agent_name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-secondary text-text-secondary">{row.action_type}</span>
                    {row.actor && <span className="text-xs text-text-secondary">· {row.actor}</span>}
                  </div>
                  <div className="text-sm text-text-secondary truncate">{row.message}</div>
                </div>
                <span className="text-xs text-text-secondary shrink-0">{fmtTime(row.timestamp)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
