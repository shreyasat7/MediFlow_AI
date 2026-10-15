import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, IndianRupee, TrendingUp, Receipt, AlertCircle, Lightbulb } from 'lucide-react';
import { apiFetch } from '../api';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const PAY_COLORS = { Paid: '#10b981', Insurance: '#2563eb', Pending: '#f59e0b' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Reports() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { apiFetch('/system/analytics').then(setA).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="text-red-600 bg-red-50 rounded p-3">{err}</div>;
  if (!a) return <div className="text-text-secondary">Loading analytics…</div>;

  const t = a.totals;
  const emergencies = (a.by_priority.find((p) => p.priority === 'Emergency')?.count) || 0;
  const discharged = (a.by_status.find((s) => s.status === 'Discharged')?.count) || 0;
  const topDx = a.top_diagnoses[0];

  const insights = [
    `${t.patients} patients on record, of which ${discharged} have completed their care episode.`,
    `Total billed revenue is ${inr(a.total_revenue)} across ${t.bills} invoices (avg ${inr(t.avg_bill)} per patient).`,
    `Collection rate is ${t.collection_rate}% — ${inr(t.collected)} collected, ${inr(t.outstanding)} still outstanding.`,
    emergencies > 0
      ? `${emergencies} patient(s) are flagged Emergency priority and should be prioritised.`
      : `No emergency-priority patients are currently active.`,
    topDx ? `The most frequently recorded condition is "${topDx.description}" (${topDx.count} cases).` : null,
  ].filter(Boolean);

  const Tile = ({ icon: Icon, label, value, accent }) => (
    <div className="glass-panel rounded-xl p-5 flex items-center justify-between">
      <div>
        <div className="text-sm text-text-secondary">{label}</div>
        <div className="text-2xl font-bold text-text-primary mt-1">{value}</div>
      </div>
      <div className={`p-3 rounded-full ${accent}`}><Icon className="w-6 h-6" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Reports & Analytics</h1>
        <p className="text-text-secondary text-sm">Operational and financial overview of the hospital</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icon={Users} label="Total patients" value={t.patients} accent="bg-blue-100 text-blue-600" />
        <Tile icon={IndianRupee} label="Total revenue" value={inr(a.total_revenue)} accent="bg-emerald-100 text-emerald-600" />
        <Tile icon={TrendingUp} label="Collection rate" value={`${t.collection_rate}%`} accent="bg-violet-100 text-violet-600" />
        <Tile icon={Receipt} label="Avg bill" value={inr(t.avg_bill)} accent="bg-amber-100 text-amber-600" />
      </div>

      {/* Insights */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-text-primary">Key insights</h2>
        </div>
        <ul className="space-y-2">
          {insights.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />{s}
            </li>
          ))}
        </ul>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Patients by status">
          <BarChart data={a.by_status}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="status" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </Card>
        <Card title="Patients by priority">
          <PieChart>
            <Pie data={a.by_priority} dataKey="count" nameKey="priority" outerRadius={90} label>
              {a.by_priority.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Legend /><Tooltip />
          </PieChart>
        </Card>
        <Card title="Revenue by payment status">
          <BarChart data={a.by_payment}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="status" tick={{ fontSize: 12 }} /><YAxis /><Tooltip formatter={(v) => inr(v)} />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
              {a.by_payment.map((e, i) => <Cell key={i} fill={PAY_COLORS[e.status] || '#64748b'} />)}
            </Bar>
          </BarChart>
        </Card>
        <Card title="Beds by ward">
          <BarChart data={a.by_ward}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="ward" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </Card>
      </div>

      {/* Top diagnoses + payment table */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5">
          <h2 className="font-semibold text-text-primary mb-3">Most common conditions</h2>
          {a.top_diagnoses.length === 0 ? <p className="text-text-secondary text-sm">No data.</p> : (
            <div className="space-y-2">
              {a.top_diagnoses.map((d, i) => {
                const max = a.top_diagnoses[0].count || 1;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-text-primary">{d.description}</span><span className="text-text-secondary">{d.count}</span></div>
                    <div className="h-2 rounded-full bg-surface-secondary overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="glass-panel rounded-xl p-5">
          <h2 className="font-semibold text-text-primary mb-3">Billing breakdown</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary"><tr><th className="py-2">Status</th><th className="py-2">Invoices</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {a.by_payment.map((p) => (
                <tr key={p.status} className="border-t border-border-color/40">
                  <td className="py-2"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PAY_COLORS[p.status] }} />{p.status}</span></td>
                  <td className="py-2">{p.count}</td>
                  <td className="py-2 text-right font-medium">{inr(p.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-color font-semibold">
                <td className="py-2">Total</td><td className="py-2">{t.bills}</td><td className="py-2 text-right">{inr(a.total_revenue)}</td>
              </tr>
            </tbody>
          </table>
          {emergencies > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle size={16} /> {emergencies} emergency-priority patient(s) need attention.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="glass-panel rounded-xl p-5" style={{ height: 320 }}>
      <h2 className="font-semibold text-text-primary mb-3">{title}</h2>
      <ResponsiveContainer width="100%" height="88%">{children}</ResponsiveContainer>
    </div>
  );
}
