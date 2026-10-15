import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

export default function Appointments() {
  const user = useAuthStore((s) => s.user);
  const canBook = ['Admin', 'Doctor', 'Receptionist'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ patient_id: '', patient_name: '', doctor_name: '', department: '', scheduled_for: '', reason: '' });
  const [msg, setMsg] = useState(null);

  const load = async () => { try { setRows(await apiFetch('/appointments/')); } catch (e) { setMsg({ type: 'err', text: e.message }); } };
  useEffect(() => { load(); apiFetch('/doctors/').then(setDoctors).catch(() => {}); }, []);

  const book = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await apiFetch('/appointments/', { method: 'POST', body: JSON.stringify(form) }); setMsg({ type: 'ok', text: 'Booked.' }); setForm({ patient_id: '', patient_name: '', doctor_name: '', department: '', scheduled_for: '', reason: '' }); load(); }
    catch (err) { setMsg({ type: 'err', text: err.message }); }
  };
  const setStatus = async (id, status) => { await apiFetch(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-5">Appointments</h1>
      {msg && <div className={`mb-4 text-sm rounded p-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {canBook && (
        <form onSubmit={book} className="glass-panel rounded-xl p-4 mb-5 grid md:grid-cols-3 gap-2">
          <input className="fld" placeholder="Patient MRN" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} required />
          <input className="fld" placeholder="Patient name" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
          <select className="fld" value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}>
            <option value="">Select doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <input className="fld" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <input className="fld" type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
          <input className="fld" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="btn-blue md:col-span-3">Book appointment</button>
        </form>
      )}
      <div className="glass-panel rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary border-b border-border-color"><tr>{['When', 'Patient', 'Doctor', 'Reason', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border-color/40">
                <td className="px-4 py-3 text-text-secondary">{(a.scheduled_for || '').replace('T', ' ')}</td>
                <td className="px-4 py-3 text-text-primary">{a.patient_name || a.patient_id}</td>
                <td className="px-4 py-3">{a.doctor_name}</td>
                <td className="px-4 py-3 text-text-secondary">{a.reason}</td>
                <td className="px-4 py-3">{a.status}</td>
                <td className="px-4 py-3 text-xs space-x-2">
                  {a.status === 'Scheduled' && <>
                    <button onClick={() => setStatus(a.id, 'Completed')} className="text-green-600 hover:underline">Complete</button>
                    <button onClick={() => setStatus(a.id, 'Cancelled')} className="text-red-600 hover:underline">Cancel</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.fld{padding:.5rem .7rem;border:1px solid #cbd5e1;border-radius:.5rem;font-size:.9rem}.btn-blue{padding:.5rem .85rem;background:#2563eb;color:#fff;border-radius:.6rem;font-size:.9rem;font-weight:500}`}</style>
    </div>
  );
}
