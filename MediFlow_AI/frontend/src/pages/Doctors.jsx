import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rawFetch } from '../api';
import { motion } from 'framer-motion';
import { Stethoscope, UserCircle, Users, ChevronRight, X, CheckCircle2 } from 'lucide-react';

const ACTIVE = ['Waiting', 'In Treatment', 'Admitted'];
const priorityPill = (p) =>
  p === 'Emergency' ? 'bg-red-100 text-red-700' : p === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

const Doctors = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = () => {
    Promise.all([
      rawFetch('/doctors/').then((r) => r.json()).catch(() => []),
      rawFetch('/patients/').then((r) => r.json()).catch(() => []),
    ]).then(([docs, pats]) => {
      setDoctors(Array.isArray(docs) ? docs : []);
      setPatients(Array.isArray(pats) ? pats : []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const byDoctor = useMemo(() => {
    const map = {};
    patients.forEach((p) => { (map[p.assigned_doctor] ||= []).push(p); });
    return map;
  }, [patients]);

  const activeCount = (name) => (byDoctor[name] || []).filter((p) => ACTIVE.includes(p.status)).length;

  const markDone = async (patientId) => {
    try {
      const res = await rawFetch(`/patients/${patientId}/discharge`, { method: 'PATCH' });
      const data = await res.json();
      setPatients((prev) => prev.map((p) => (p.patient_id === patientId ? { ...p, status: 'Discharged' } : p)));
      const r = data.readmission_risk;
      if (r) alert(`Discharged.\n\n30-day readmission risk: ${r.band} (score ${r.score})\n${r.advice}\n\nFactors: ${r.factors.join('; ') || 'none'}`);
    } catch { /* ignore */ }
  };

  const list = selected ? (byDoctor[selected.name] || []) : [];
  const active = list.filter((p) => ACTIVE.includes(p.status));
  const discharged = list.filter((p) => !ACTIVE.includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl"><Stethoscope className="w-6 h-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Doctors & Queue</h1>
          <p className="text-text-secondary text-sm">Roster, workload and patient management</p>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map((i) => <div key={i} className="h-44 bg-surface-secondary rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc, i) => {
            const total = (byDoctor[doc.name] || []).length;
            const act = activeCount(doc.name);
            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-panel p-6 rounded-2xl border-t-4"
                style={{ borderTopColor: doc.status === 'Available' ? '#10b981' : doc.status === 'Busy' ? '#f59e0b' : '#94a3b8' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <UserCircle className="w-10 h-10 text-primary" />
                    <div>
                      <h3 className="font-bold text-text-primary">{doc.name}</h3>
                      <p className="text-xs text-text-secondary uppercase tracking-wide">{doc.specialization}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-md ${doc.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : doc.status === 'Busy' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{doc.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-surface-secondary rounded-xl p-3">
                    <div className="text-xs text-text-secondary">Active queue</div>
                    <div className="text-2xl font-bold text-primary">{act}</div>
                  </div>
                  <div className="bg-surface-secondary rounded-xl p-3">
                    <div className="text-xs text-text-secondary">Total patients</div>
                    <div className="text-2xl font-bold text-text-primary">{total}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(doc)} className="w-full flex items-center justify-center py-2.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/5 font-medium text-sm">
                  Manage Patients <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-40 flex justify-end" onClick={() => setSelected(null)}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full bg-surface glass-panel shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-border-color flex justify-between items-center sticky top-0 bg-surface z-10">
              <div>
                <h2 className="text-lg font-bold text-text-primary">{selected.name}</h2>
                <p className="text-sm text-text-secondary">{active.length} active · {list.length} total</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-surface-secondary rounded-full text-text-secondary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <Section title="Active queue" empty="No active patients." items={active} onOpen={(p) => navigate(`/patients/${p.patient_id}`)} onDone={markDone} priorityPill={priorityPill} showDone />
              <Section title="Past patients" empty="No past patients." items={discharged} onOpen={(p) => navigate(`/patients/${p.patient_id}`)} priorityPill={priorityPill} />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

function Section({ title, items, empty, onOpen, onDone, priorityPill, showDone }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">{title} · {items.length}</h3>
      {items.length === 0 ? <p className="text-sm text-text-secondary">{empty}</p> : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="bg-surface-secondary p-3 rounded-xl border border-border-color">
              <div className="flex justify-between items-start">
                <button onClick={() => onOpen(p)} className="text-left">
                  <div className="font-mono text-xs text-primary">{p.patient_id}</div>
                  <div className="font-semibold text-text-primary hover:underline">{p.name}</div>
                  <div className="text-xs text-text-secondary">{p.status}</div>
                </button>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityPill(p.priority)}`}>{p.priority}</span>
              </div>
              {showDone && (
                <button onClick={() => onDone(p.patient_id)} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg">
                  <CheckCircle2 size={15} /> Mark as done / discharge
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Doctors;
