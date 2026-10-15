import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, RefreshCw, ArrowRight } from 'lucide-react';
import { apiFetch } from '../api';

const BAND = {
  high: { ring: 'border-red-500', chip: 'bg-red-500 text-white', text: 'text-red-600', label: 'High' },
  medium: { ring: 'border-amber-500', chip: 'bg-amber-500 text-white', text: 'text-amber-600', label: 'Medium' },
  'low-medium': { ring: 'border-yellow-400', chip: 'bg-yellow-400 text-slate-900', text: 'text-yellow-600', label: 'Low-Med' },
  low: { ring: 'border-emerald-500', chip: 'bg-emerald-500 text-white', text: 'text-emerald-600', label: 'Low' },
  unknown: { ring: 'border-slate-300', chip: 'bg-slate-300 text-slate-700', text: 'text-slate-500', label: 'No score' },
};

export default function Rounds() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [updated, setUpdated] = useState(null);

  const load = () => apiFetch('/patients/queue').then((d) => { setQueue(d); setUpdated(new Date()); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl"><Moon className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Ward Rounds</h1>
            <p className="text-text-secondary text-sm">Risk-ordered for on-call review — sickest first, by NEWS2 deterioration score</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <RefreshCw className="w-4 h-4" /> {updated ? updated.toLocaleTimeString() : 'Refresh'}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {queue.length === 0 && (
          <div className="glass-panel rounded-xl p-8 text-center text-text-secondary">No active patients on the ward.</div>
        )}
        {queue.map((p, i) => {
          const b = BAND[p.news2_band] || BAND.unknown;
          return (
            <button key={p.id} onClick={() => navigate(`/patients/${p.patient_id}`)}
              className={`w-full text-left glass-panel rounded-xl border-l-4 ${b.ring} px-5 py-4 flex items-center gap-4 hover:shadow-md transition`}>
              <div className="text-2xl font-bold text-text-secondary w-8 tabular-nums">{i + 1}</div>
              <div className={`h-16 w-16 rounded-xl flex flex-col items-center justify-center ${b.chip} shrink-0`}>
                <span className="text-2xl font-bold leading-none">{p.news2 ?? '–'}</span>
                <span className="text-[10px] uppercase tracking-wide">NEWS2</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg text-text-primary truncate">{p.name}</span>
                  {p.identity_confirmed === false && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Unidentified</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.priority === 'Emergency' ? 'bg-red-100 text-red-700' : p.priority === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.priority}</span>
                </div>
                <div className="text-sm text-text-secondary mt-0.5">
                  <span className="font-mono text-primary">{p.patient_id}</span> · {p.assigned_doctor || 'Unassigned'}
                </div>
                <div className={`text-sm font-medium mt-0.5 ${b.text}`}>{p.news2_response}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-text-secondary shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
