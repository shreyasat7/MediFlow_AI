import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Upload, FileDown, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const priorityColor = (p) => ({
  Emergency: 'bg-red-100 text-red-700',
  High: 'bg-amber-100 text-amber-700',
  Normal: 'bg-slate-100 text-slate-600',
}[p] || 'bg-slate-100 text-slate-600');

export default function Patients({ scoped = false, title = 'Patients' }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canImport = ['Admin', 'Receptionist'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const fileRef = useRef(null);

  const load = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiFetch(`/patients/?${query ? `q=${encodeURIComponent(query)}` : ''}`);
      setRows(data);
    } catch (e) { setBanner({ type: 'err', msg: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const patients = Array.isArray(json) ? json : json.patients;
      const res = await apiFetch('/patients/import', { method: 'POST', body: JSON.stringify({ patients }) });
      setBanner({ type: 'ok', msg: res.message });
      load();
    } catch (err) {
      setBanner({ type: 'err', msg: `Import failed: ${err.message}` });
    } finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const downloadTemplate = () => {
    const sample = {
      patients: [{
        name: 'Rohan Sharma', age: 45, gender: 'Male', symptoms: 'Chest pain',
        assigned_doctor: 'Dr. Aarav Sharma', allergies: 'Penicillin',
        encounters: [{ encounter_type: 'OPD', reason: 'Chest pain', date: '2025-01-10',
          diagnoses: [{ code: 'I20', description: 'Angina' }],
          medications: [{ medication: 'Aspirin', dosage: '75mg', frequency: 'OD' }],
          vitals: [{ heart_rate: 88, systolic_bp: 140, diastolic_bp: 90 }],
          notes: [{ content: 'Advised ECG' }] }],
      }],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'patients-template.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {canImport && (
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn-secondary"><Upload size={16} /> Import</button>
            <button onClick={downloadTemplate} className="btn-secondary"><FileDown size={16} /> Template</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
          </div>
        )}
      </div>

      {banner && (
        <div className={`mb-4 text-sm rounded-lg p-2 ${banner.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {banner.msg}
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or patient ID (e.g. P-1031)…"
          className="w-full pl-10 pr-3 py-2 border border-border-color rounded-lg bg-surface-primary text-text-primary outline-none focus:border-primary" />
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center gap-2 text-text-secondary"><Loader2 className="animate-spin" size={18} /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-text-secondary">No patients found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary border-b border-border-color">
              <tr>{['MRN', 'Name', 'Age', 'Priority', 'Status', 'Doctor'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.patient_id}`)}
                  className="border-b border-border-color/50 hover:bg-surface-secondary cursor-pointer">
                  <td className="px-4 py-3 font-mono text-primary">{p.patient_id}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.age}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${priorityColor(p.priority)}`}>{p.priority}</span></td>
                  <td className="px-4 py-3 text-text-secondary">{p.status}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.assigned_doctor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`.btn-secondary{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .8rem;border:1px solid var(--border-color,#cbd5e1);border-radius:.6rem;font-size:.85rem;font-weight:500}.btn-secondary:hover{background:rgba(0,0,0,.04)}`}</style>
    </div>
  );
}
