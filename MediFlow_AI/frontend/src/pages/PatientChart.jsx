import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, Sparkles, FileJson, AlertTriangle, X, Activity, KeyRound,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { apiFetch, fhirFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const TABS = ['Overview', 'Vitals', 'Diagnoses', 'Medications', 'Notes', 'Encounters', 'Tests & Bills', 'Consent'];

const PILL = {
  // priority
  Emergency: 'bg-red-100 text-red-700', High: 'bg-amber-100 text-amber-700', Normal: 'bg-emerald-100 text-emerald-700',
  // status
  Waiting: 'bg-amber-100 text-amber-700', 'In Treatment': 'bg-blue-100 text-blue-700',
  Admitted: 'bg-violet-100 text-violet-700', Discharged: 'bg-slate-100 text-slate-500',
  // clinical
  Active: 'bg-blue-100 text-blue-700', Resolved: 'bg-emerald-100 text-emerald-700', Stopped: 'bg-slate-100 text-slate-500',
  // tests
  Completed: 'bg-emerald-100 text-emerald-700', Ready: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700', Pending: 'bg-slate-100 text-slate-500',
  // billing
  Paid: 'bg-emerald-100 text-emerald-700', Insurance: 'bg-blue-100 text-blue-700',
};
const Pill = ({ v }) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PILL[v] || 'bg-slate-100 text-slate-600'}`}>{v || '—'}</span>;

const NEWS2_STYLE = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  'low-medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  unknown: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function PatientChart() {
  const { patientId } = useParams();
  const user = useAuthStore((s) => s.user);
  const [chart, setChart] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [ai, setAi] = useState({ loading: false, text: '', error: '' });
  const [encModal, setEncModal] = useState(null);
  const [idOpen, setIdOpen] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [summary, setSummary] = useState({ loading: false, data: null, error: '' });

  const canWrite = ['Admin', 'Doctor', 'Nurse'].includes(user?.role);
  const canRx = ['Admin', 'Doctor'].includes(user?.role);

  const load = async () => {
    setLoading(true);
    try { setChart(await apiFetch(`/patients/${patientId}/chart`)); setErr(''); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [patientId]);

  const runAI = async () => {
    setAiOpen(true); setAi({ loading: true, text: '', error: '' });
    try {
      const data = await apiFetch(`/ai/recommend/${patientId}`, { method: 'POST' });
      setAi({ loading: false, text: data.recommendation, error: '' });
    } catch (e) { setAi({ loading: false, text: '', error: e.message }); }
  };

  const runSummary = async () => {
    setSumOpen(true); setSummary({ loading: true, data: null, error: '' });
    try {
      const data = await apiFetch(`/ai/summary/${patientId}`, { method: 'POST' });
      setSummary({ loading: false, data, error: '' });
    } catch (e) { setSummary({ loading: false, data: null, error: e.message }); }
  };

  const grantPortal = async () => {
    const username = prompt('Portal username for the patient (e.g. their MRN):', patientId.toLowerCase());
    if (!username) return;
    const password = prompt('Set a portal password (min 6 characters):');
    if (!password) return;
    try {
      const r = await apiFetch(`/patients/${patientId}/portal-access`, { method: 'POST', body: JSON.stringify({ username, password }) });
      alert(`${r.message}\n\nUsername: ${username}\nThe patient can now sign in to the portal.`);
    } catch (e) { alert(e.message); }
  };

  const exportFhir = async () => {
    const res = await fhirFetch(`/fhir/Patient/${patientId}/$everything`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${patientId}-fhir-bundle.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center gap-2 text-text-secondary"><Loader2 className="animate-spin" /> Loading chart…</div>;
  if (err) return <div className="text-red-600 bg-red-50 rounded-lg p-4">{err}</div>;
  if (!chart) return null;

  const p = chart.patient;
  const news2 = chart.vitals?.[0]?.news2;
  const unidentified = p.identity_confirmed === false;

  return (
    <div>
      {unidentified && (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle size={18} /> <b>Identity unconfirmed</b> — this patient was admitted as an unidentified emergency.
          </div>
          {canWrite && (
            <button onClick={() => setIdOpen(true)} className="btn-blue">Confirm identity</button>
          )}
        </div>
      )}
      <div className="glass-panel rounded-xl p-5 mb-5">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{p.name}</h1>
            <p className="text-text-secondary text-sm mt-1">
              <span className="font-mono text-primary">{p.patient_id}</span> · {p.age}y · {p.gender || '—'} ·
              Blood {p.blood_group || '—'} · Dr. {(p.assigned_doctor || '—').replace(/^Dr\.\s*/, '')}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Pill v={p.priority} /><Pill v={p.status} />
              {news2 && news2.score != null && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${NEWS2_STYLE[news2.band]}`}
                  title={`NEWS2 deterioration score — ${news2.response}`}>
                  NEWS2 {news2.score} · {news2.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={runAI} className="btn-blue"><Sparkles size={16} /> AI Diagnosis</button>
            <button onClick={runSummary} className="btn-secondary"><Sparkles size={16} /> AI Summary</button>
            <button onClick={exportFhir} className="btn-secondary"><FileJson size={16} /> Export FHIR</button>
            {['Admin', 'Receptionist'].includes(user?.role) && (
              <button onClick={grantPortal} className="btn-secondary"><KeyRound size={16} /> Portal access</button>
            )}
          </div>
        </div>
        {p.allergies && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle size={16} /> Allergies: {p.allergies}
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-border-color overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <Overview p={p} chart={chart} />}
      {tab === 'Vitals' && <VitalsTab chart={chart} patientId={patientId} canWrite={canWrite} reload={load} />}
      {tab === 'Diagnoses' && <ListTab items={chart.diagnoses} cols={['description', 'code', 'status', 'diagnosed_by']} patientId={patientId} kind="diagnoses" canWrite={canRx} reload={load} />}
      {tab === 'Medications' && <MedsTab chart={chart} patientId={patientId} canRx={canRx} reload={load} />}
      {tab === 'Notes' && <NotesTab chart={chart} patientId={patientId} canWrite={canWrite} reload={load} />}
      {tab === 'Encounters' && <EncountersTab chart={chart} onOpen={setEncModal} />}
      {tab === 'Tests & Bills' && <TestsBills chart={chart} />}
      {tab === 'Consent' && <ConsentTab patientId={patientId} />}

      {aiOpen && <AIModal ai={ai} onClose={() => setAiOpen(false)} />}
      {encModal && <EncounterModal enc={encModal} chart={chart} onClose={() => setEncModal(null)} />}
      {idOpen && <IdentifyModal patientId={patientId} onClose={() => setIdOpen(false)} onDone={() => { setIdOpen(false); load(); }} />}
      {sumOpen && <SummaryModal state={summary} onClose={() => setSumOpen(false)} />}

      <style>{`.btn-blue{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .85rem;background:#2563eb;color:#fff;border-radius:.6rem;font-size:.85rem;font-weight:500}.btn-blue:hover{background:#1d4ed8}.btn-secondary{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .8rem;border:1px solid var(--border-color,#cbd5e1);border-radius:.6rem;font-size:.85rem;font-weight:500}.card{background:var(--surface-primary,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:.75rem;padding:1rem}.fld{width:100%;padding:.5rem .7rem;border:1px solid #cbd5e1;border-radius:.5rem;font-size:.9rem;margin-bottom:.5rem}`}</style>
    </div>
  );
}

function Overview({ p, chart }) {
  const item = (label, value) => (
    <div><div className="text-xs text-text-secondary">{label}</div><div className="text-text-primary">{value || '—'}</div></div>
  );
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="card grid grid-cols-2 gap-3 md:col-span-2">
        {item('Symptoms', p.symptoms)}
        {item('Chronic conditions', p.chronic_conditions)}
        {item('Contact', p.contact)}
        {item('Date of birth', p.date_of_birth)}
        {item('Address', p.address)}
        {item('Insurance', p.insurance_provider && `${p.insurance_provider} (${p.insurance_id || '—'})`)}
        {item('Emergency contact', p.emergency_contact_name && `${p.emergency_contact_name} · ${p.emergency_contact_phone || ''}`)}
      </div>
      <div className="card">
        <div className="text-sm font-semibold mb-2 text-text-primary">Summary</div>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>Encounters: {chart.encounters.length}</li>
          <li>Active meds: {chart.prescriptions.filter((m) => m.status === 'Active').length}</li>
          <li>Diagnoses: {chart.diagnoses.length}</li>
          <li>Vitals recorded: {chart.vitals.length}</li>
          <li>Tests: {chart.tests.length} · Bills: {chart.bills.length}</li>
        </ul>
      </div>
    </div>
  );
}

function VitalsTab({ chart, patientId, canWrite, reload }) {
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const rows = chart.vitals;
  const trend = [...rows].reverse().map((v, i) => ({
    name: i + 1, HR: v.heart_rate, Systolic: v.systolic_bp, Diastolic: v.diastolic_bp,
  }));
  const submit = async () => {
    setErr('');
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      await apiFetch(`/patients/${patientId}/vitals`, { method: 'POST', body: JSON.stringify(body) });
      setForm({}); reload();
    } catch (e) { setErr(e.message); }
  };
  const fields = ['temperature_c', 'heart_rate', 'systolic_bp', 'diastolic_bp', 'respiratory_rate', 'spo2', 'weight_kg', 'height_cm'];
  const n = rows[0]?.news2;
  return (
    <div className="space-y-4">
      {n && n.score != null && (
        <div className={`rounded-xl p-4 border ${NEWS2_STYLE[n.band]}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Deterioration · NEWS2</div>
              <div className="text-2xl font-bold leading-tight">{n.score} · {n.label}</div>
              <div className="text-xs opacity-80">{n.response}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-[62%] justify-end">
              {Object.entries(n.breakdown).map(([f, b]) => (
                <span key={f} className={`px-2 py-0.5 rounded text-xs font-medium ${b.score >= 3 ? 'bg-red-200/70 text-red-900' : b.score >= 1 ? 'bg-amber-200/70 text-amber-900' : 'bg-white/60 text-slate-600'}`}>
                  {b.label} {b.value} (+{b.score})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {rows.length > 1 && (
        <div className="card" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
              <Line type="monotone" dataKey="HR" stroke="#ef4444" />
              <Line type="monotone" dataKey="Systolic" stroke="#2563eb" />
              <Line type="monotone" dataKey="Diastolic" stroke="#10b981" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {canWrite && (
        <div className="card">
          <div className="text-sm font-semibold mb-2">Record vitals</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {fields.map((f) => (
              <input key={f} className="fld" placeholder={f.replace(/_/g, ' ')} value={form[f] || ''}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            ))}
          </div>
          {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
          <button onClick={submit} className="btn-blue">Save</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary"><tr>{['When', 'Temp', 'HR', 'BP', 'RR', 'SpO2', 'By'].map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((v) => {
              const flag = (f) => v.flags?.[f];
              const cell = (val, f) => <span className={flag(f) === 'critical' ? 'text-red-600 font-semibold' : flag(f) === 'abnormal' ? 'text-amber-600' : ''}>{val ?? '—'}</span>;
              return (
                <tr key={v.id} className="border-t border-border-color/40">
                  <td className="py-2 pr-4 text-text-secondary">{v.recorded_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="py-2 pr-4">{cell(v.temperature_c, 'temperature_c')}</td>
                  <td className="py-2 pr-4">{cell(v.heart_rate, 'heart_rate')}</td>
                  <td className="py-2 pr-4">{cell(v.systolic_bp, 'systolic_bp')}/{cell(v.diastolic_bp, 'diastolic_bp')}</td>
                  <td className="py-2 pr-4">{cell(v.respiratory_rate, 'respiratory_rate')}</td>
                  <td className="py-2 pr-4">{cell(v.spo2, 'spo2')}</td>
                  <td className="py-2 pr-4 text-text-secondary">{v.recorded_by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListTab({ items, cols, patientId, kind, canWrite, reload }) {
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    try {
      await apiFetch(`/patients/${patientId}/${kind}`, { method: 'POST', body: JSON.stringify(form) });
      setForm({}); reload();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="card">
          <div className="text-sm font-semibold mb-2">Add diagnosis</div>
          <input className="fld" placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="fld" placeholder="ICD-10 code (optional)" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
          <button onClick={submit} className="btn-blue">Add</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary"><tr>{cols.map((c) => <th key={c} className="py-2 pr-4">{c.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border-color/40">
                {cols.map((c) => (
                  <td key={c} className="py-2 pr-4 text-text-primary">
                    {c === 'status' ? <Pill v={it[c]} /> : (it[c] || '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MedsTab({ chart, patientId, canRx, reload }) {
  const [form, setForm] = useState({});
  const [warn, setWarn] = useState(null);
  const [reason, setReason] = useState('');
  const submit = async (override = false) => {
    try {
      const body = { ...form, override, override_reason: override ? reason : undefined };
      await apiFetch(`/patients/${patientId}/prescriptions`, { method: 'POST', body: JSON.stringify(body) });
      setForm({}); setWarn(null); setReason(''); reload();
    } catch (e) {
      if (e.status === 409 && e.data?.detail?.warnings) setWarn(e.data.detail.warnings);
      else alert(e.message);
    }
  };
  const stop = async (id) => { await apiFetch(`/patients/${patientId}/prescriptions/${id}/stop`, { method: 'PATCH' }); reload(); };
  return (
    <div className="space-y-4">
      {canRx && (
        <div className="card">
          <div className="text-sm font-semibold mb-2">Prescribe</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input className="fld" placeholder="Medication" value={form.medication || ''} onChange={(e) => setForm({ ...form, medication: e.target.value })} />
            <input className="fld" placeholder="Dosage" value={form.dosage || ''} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            <input className="fld" placeholder="Frequency" value={form.frequency || ''} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
            <input className="fld" placeholder="Duration" value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>
          <button onClick={() => submit(false)} className="btn-blue">Prescribe</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary"><tr>{['Medication', 'Dosage', 'Frequency', 'Status', 'By', ''].map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
          <tbody>
            {chart.prescriptions.map((m) => (
              <tr key={m.id} className="border-t border-border-color/40">
                <td className="py-2 pr-4 font-medium text-text-primary">{m.medication}</td>
                <td className="py-2 pr-4">{m.dosage || '—'}</td>
                <td className="py-2 pr-4">{m.frequency || '—'}</td>
                <td className="py-2 pr-4"><Pill v={m.status} /></td>
                <td className="py-2 pr-4 text-text-secondary">{m.prescribed_by}</td>
                <td className="py-2 pr-4">{canRx && m.status === 'Active' && <button onClick={() => stop(m.id)} className="text-red-600 hover:underline text-xs">Stop</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {warn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full">
            <div className="flex items-center gap-2 text-red-700 font-semibold mb-3"><AlertTriangle size={18} /> Clinical Safety Alert</div>
            <ul className="text-sm space-y-2 mb-3">
              {warn.map((w, i) => <li key={i} className="bg-red-50 rounded p-2"><b>{w.severity}</b> — {w.message}</li>)}
            </ul>
            <textarea className="fld" placeholder="Override reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setWarn(null)} className="btn-secondary">Cancel</button>
              <button disabled={!reason.trim()} onClick={() => submit(true)} className="btn-blue disabled:opacity-50">Override & prescribe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesTab({ chart, patientId, canWrite, reload }) {
  const [content, setContent] = useState('');
  const submit = async () => {
    await apiFetch(`/patients/${patientId}/notes`, { method: 'POST', body: JSON.stringify({ content }) });
    setContent(''); reload();
  };
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="card">
          <textarea className="fld" placeholder="New clinical note…" value={content} onChange={(e) => setContent(e.target.value)} />
          <button onClick={submit} disabled={!content.trim()} className="btn-blue disabled:opacity-50">Add note</button>
        </div>
      )}
      <div className="space-y-2">
        {chart.notes.map((n) => (
          <div key={n.id} className="card">
            <div className="text-xs text-text-secondary mb-1">{n.note_type} · {n.author} · {n.created_at?.slice(0, 16).replace('T', ' ')}</div>
            <div className="text-sm text-text-primary whitespace-pre-wrap">{n.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EncountersTab({ chart, onOpen }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {chart.encounters.map((e) => (
        <button key={e.id} onClick={() => onOpen(e)} className="card text-left hover:border-primary transition">
          <div className="flex items-center gap-2 text-primary font-medium"><Activity size={16} /> {e.encounter_type} · {e.status}</div>
          <div className="text-sm text-text-primary mt-1">{e.reason || 'No reason recorded'}</div>
          <div className="text-xs text-text-secondary mt-1">{e.attending_doctor || '—'} · {e.created_at?.slice(0, 10)}</div>
        </button>
      ))}
      {chart.encounters.length === 0 && <div className="text-text-secondary">No encounters.</div>}
    </div>
  );
}

function EncounterModal({ enc, chart, onClose }) {
  const filt = (arr) => arr.filter((x) => x.encounter_id === enc.id);
  const section = (title, items, render) => items.length > 0 && (
    <div className="mb-3"><div className="text-xs font-semibold text-text-secondary mb-1">{title}</div>{items.map(render)}</div>
  );
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg">{enc.encounter_type} — {enc.created_at?.slice(0, 10)}</h3>
            <p className="text-sm text-slate-500">{enc.reason} · treated by {enc.attending_doctor || '—'}</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {section('Diagnoses', filt(chart.diagnoses), (d) => <div key={d.id} className="text-sm">• {d.description} {d.code ? `(${d.code})` : ''}</div>)}
        {section('Medications', filt(chart.prescriptions), (m) => <div key={m.id} className="text-sm">• {m.medication} {m.dosage || ''} {m.frequency || ''}</div>)}
        {section('Vitals', filt(chart.vitals), (v) => <div key={v.id} className="text-sm">• HR {v.heart_rate ?? '—'}, BP {v.systolic_bp ?? '—'}/{v.diastolic_bp ?? '—'}, SpO2 {v.spo2 ?? '—'}</div>)}
        {section('Notes', filt(chart.notes), (n) => <div key={n.id} className="text-sm whitespace-pre-wrap">• {n.content}</div>)}
      </div>
    </div>
  );
}

function TestsBills({ chart }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card">
        <div className="font-semibold mb-2">Tests</div>
        {chart.tests.map((t) => (
          <div key={t.id} className="border-t border-border-color/40 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">{t.test_name}</span>
              <Pill v={t.status} />
            </div>
            {t.result && <div className="text-xs text-text-secondary mt-1">{t.result}</div>}
          </div>
        ))}
        {chart.tests.length === 0 && <div className="text-text-secondary text-sm">None</div>}
      </div>
      <div className="card">
        <div className="font-semibold mb-2">Bills</div>
        {chart.bills.map((b) => (
          <div key={b.id} className="border-t border-border-color/40 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">₹ {Number(b.total_amount).toLocaleString('en-IN')}</span>
              <Pill v={b.payment_status} />
            </div>
            <div className="text-xs text-text-secondary mt-1">{b.items}</div>
          </div>
        ))}
        {chart.bills.length === 0 && <div className="text-text-secondary text-sm">None</div>}
      </div>
    </div>
  );
}

function ConsentTab({ patientId }) {
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => apiFetch(`/patients/${patientId}/consent`).then(setEvents).catch(() => {});
  useEffect(() => { load(); }, [patientId]);

  const record = async (type) => {
    let reason = '';
    if (type === 'BREAK_GLASS') { reason = prompt('Reason for emergency break-glass access (required):') || ''; if (!reason) return; }
    else { reason = prompt(`Reason / party for this ${type} (optional):`) || ''; }
    setBusy(true);
    try { await apiFetch(`/patients/${patientId}/consent`, { method: 'POST', body: JSON.stringify({ event_type: type, reason }) }); load(); }
    finally { setBusy(false); }
  };

  const STYLE = { EXPORT: 'bg-blue-100 text-blue-700', GRANT: 'bg-emerald-100 text-emerald-700', DENY: 'bg-red-100 text-red-700', BREAK_GLASS: 'bg-amber-100 text-amber-700' };
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-sm font-semibold mb-1">Consent &amp; data-sharing ledger</div>
        <p className="text-xs text-text-secondary mb-3">Every FHIR export, consent decision and emergency access is recorded here — patient-controlled sharing in the spirit of ABDM.</p>
        <div className="flex gap-2 flex-wrap">
          <button disabled={busy} onClick={() => record('GRANT')} className="btn-secondary">Record consent GRANT</button>
          <button disabled={busy} onClick={() => record('DENY')} className="btn-secondary">Record consent DENY</button>
          <button disabled={busy} onClick={() => record('BREAK_GLASS')} className="btn-secondary" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Break-glass access</button>
        </div>
      </div>
      <div className="card">
        {events.length === 0 ? <div className="text-text-secondary text-sm">No consent events yet. Exporting the FHIR record logs one automatically.</div> : (
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="flex items-start justify-between border-t border-border-color/40 py-2.5 first:border-0">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STYLE[e.event_type] || 'bg-slate-100 text-slate-600'}`}>{e.event_type.replace('_', ' ')}</span>
                  <span className="text-sm text-text-primary ml-2">{e.reason || e.party || '—'}</span>
                  <div className="text-xs text-text-secondary mt-0.5">{e.actor} · {e.created_at?.slice(0, 16).replace('T', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AIModal({ ai, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={18} className="text-blue-600" /> AI Diagnosis</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {ai.loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" /> Generating…</div>}
        {ai.error && <div className="text-red-600 bg-red-50 rounded p-3 text-sm">{ai.error}</div>}
        {ai.text && <div className="text-sm text-slate-800 whitespace-pre-wrap">{ai.text}</div>}
        <p className="text-xs text-slate-400 mt-4">AI decision support — a qualified clinician must confirm before acting.</p>
      </div>
    </div>
  );
}

function SummaryModal({ state, onClose }) {
  const { loading, data, error } = state;
  const factMap = {};
  (data?.facts || []).forEach((f) => { factMap[f.id] = f.text; });
  const render = (text) => (text || '').split(/(\[[A-Z]\d+\])/g).map((part, i) => {
    const m = part.match(/^\[([A-Z]\d+)\]$/);
    if (m) return <span key={i} title={factMap[m[1]] || 'source fact'} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium cursor-help">{m[1]}</span>;
    return <span key={i}>{part}</span>;
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={18} className="text-blue-600" /> Grounded summary</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" /> Generating…</div>}
        {error && <div className="text-red-600 bg-red-50 rounded p-3 text-sm">{error}</div>}
        {data && (
          <>
            <p className="text-xs text-slate-500 mb-3">Every claim is cited to a source fact — hover a citation to see it. The AI may only use these facts, so it cannot hallucinate.</p>
            <div className="text-sm text-slate-800 leading-relaxed">{render(data.summary)}</div>
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Source facts</div>
              <div className="space-y-1">
                {data.facts.map((f) => (
                  <div key={f.id} className="text-xs text-slate-600 flex gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">{f.id}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IdentifyModal({ patientId, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', age: '', gender: '', contact: '', blood_group: '', allergies: '', chronic_conditions: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const body = { ...form, age: form.age ? Number(form.age) : null };
      await apiFetch(`/patients/${patientId}/identify`, { method: 'PATCH', body: JSON.stringify(body) });
      onDone();
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-xl p-5 max-w-md w-full space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">Confirm patient identity</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500">Attach real details to this previously-unidentified patient.</p>
        <input className="fld" placeholder="Full name" value={form.name} onChange={set('name')} required />
        <div className="grid grid-cols-3 gap-2">
          <input className="fld" placeholder="Age" type="number" value={form.age} onChange={set('age')} />
          <select className="fld" value={form.gender} onChange={set('gender')}><option value="">Gender</option><option>Male</option><option>Female</option></select>
          <input className="fld" placeholder="Blood group" value={form.blood_group} onChange={set('blood_group')} />
        </div>
        <input className="fld" placeholder="Contact" value={form.contact} onChange={set('contact')} />
        <input className="fld" placeholder="Allergies" value={form.allergies} onChange={set('allergies')} />
        <input className="fld" placeholder="Chronic conditions" value={form.chronic_conditions} onChange={set('chronic_conditions')} />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button className="btn-blue w-full justify-center">Confirm identity</button>
      </form>
    </div>
  );
}
