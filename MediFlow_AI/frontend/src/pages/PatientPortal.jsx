import React, { useEffect, useState } from 'react';
import { Activity, LogOut, FileJson, HeartPulse, Pill, Stethoscope, CalendarDays, Receipt, FileText } from 'lucide-react';
import { apiFetch, fhirFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

export default function PatientPortal() {
  const { user, logout } = useAuthStore();
  const pid = user?.patient_id;
  const [chart, setChart] = useState(null);
  const [appts, setAppts] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!pid) return;
    apiFetch(`/patients/${pid}/chart`).then(setChart).catch((e) => setErr(e.message));
    apiFetch('/appointments/').then(setAppts).catch(() => {});
  }, [pid]);

  const exportFhir = async () => {
    const res = await fhirFetch(`/fhir/Patient/${pid}/$everything`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${pid}-my-health-record.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const p = chart?.patient;
  const activeMeds = (chart?.prescriptions || []).filter((m) => m.status === 'Active');
  const dischargeNotes = (chart?.notes || []).filter((n) => n.note_type === 'Discharge');
  const upcoming = appts.filter((a) => a.status === 'Scheduled');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Activity size={18} /></div>
            <div>
              <div className="font-semibold text-slate-900 leading-tight">MediFlow · My Health</div>
              <div className="text-xs text-slate-500">Patient portal</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {err && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{err}</div>}
        {!chart ? <div className="text-slate-500">Loading your record…</div> : (
          <>
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{p.name}</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    <span className="font-mono">{p.patient_id}</span> · {p.age}y · {p.gender || '—'} · Blood {p.blood_group || '—'}
                  </p>
                  <p className="text-slate-500 text-sm">Care of {p.assigned_doctor || '—'}</p>
                </div>
                <button onClick={exportFhir} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <FileJson size={16} /> Download my record (FHIR)
                </button>
              </div>
              {p.allergies && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <HeartPulse size={16} /> Allergies: {p.allergies}
                </div>
              )}
            </section>

            <div className="grid md:grid-cols-2 gap-5">
              <Card icon={CalendarDays} title="Upcoming appointments">
                {upcoming.length === 0 ? <Empty>No upcoming appointments.</Empty> : upcoming.map((a) => (
                  <Row key={a.id} main={`${a.doctor_name || 'Doctor'} · ${a.department || ''}`} sub={`${(a.scheduled_for || '').replace('T', ' ')} — ${a.reason || ''}`} />
                ))}
              </Card>

              <Card icon={Pill} title="Current medications">
                {activeMeds.length === 0 ? <Empty>No active medications.</Empty> : activeMeds.map((m) => (
                  <Row key={m.id} main={m.medication} sub={[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')} />
                ))}
              </Card>

              <Card icon={Stethoscope} title="Diagnoses">
                {chart.diagnoses.length === 0 ? <Empty>None recorded.</Empty> : chart.diagnoses.map((d) => (
                  <Row key={d.id} main={d.description} sub={[d.code, d.status].filter(Boolean).join(' · ')} />
                ))}
              </Card>

              <Card icon={Receipt} title="Bills">
                {chart.bills.length === 0 ? <Empty>No bills.</Empty> : chart.bills.map((b) => (
                  <Row key={b.id} main={`₹ ${Number(b.total_amount).toLocaleString('en-IN')}`} sub={b.payment_status} />
                ))}
              </Card>
            </div>

            <Card icon={FileText} title="Visit history">
              {chart.encounters.length === 0 ? <Empty>No visits recorded.</Empty> : chart.encounters.map((e) => (
                <Row key={e.id} main={`${e.encounter_type} — ${e.reason || 'Visit'}`} sub={`${(e.created_at || '').slice(0, 10)} · ${e.attending_doctor || ''}`} />
              ))}
            </Card>

            {dischargeNotes.length > 0 && (
              <Card icon={FileText} title="Discharge summary">
                {dischargeNotes.map((n) => (
                  <div key={n.id} className="text-sm text-slate-700 whitespace-pre-wrap py-2">{n.content}</div>
                ))}
              </Card>
            )}

            <p className="text-center text-xs text-slate-400 pb-6">This is a read-only view of your health record. Contact your care team for changes.</p>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={17} className="text-slate-500" />
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
const Row = ({ main, sub }) => (
  <div className="border-t border-slate-100 py-2 first:border-0">
    <div className="text-sm font-medium text-slate-800">{main}</div>
    {sub && <div className="text-xs text-slate-500">{sub}</div>}
  </div>
);
const Empty = ({ children }) => <div className="text-sm text-slate-400">{children}</div>;
