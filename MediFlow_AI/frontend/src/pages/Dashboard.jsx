import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, AlertCircle, Clock, Stethoscope, Activity, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

import { rawFetch } from '../api';
import { useAuthStore } from '../store/useAuthStore';

const KPICard = ({ title, value, icon: Icon, colorClass, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
    className="glass-panel p-6 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
  >
    <div>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <h3 className="text-3xl font-display font-bold mt-1 text-text-primary">{value ?? '—'}</h3>
    </div>
    <div className={`p-4 rounded-full ${colorClass} bg-opacity-20`}>
      <Icon className={`w-8 h-8 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
  </motion.div>
);

const priorityColors = { Emergency: '#FF4757', High: '#FFA502', Normal: '#2ED573' };

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [logs, setLogs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [beds, setBeds] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const role = useAuthStore((s) => s.user?.role);

  const fetchAll = useCallback(async () => {
    const isAdmin = role === 'Admin';
    const get = async (path) => {
      try { const r = await rawFetch(path); return r.ok ? await r.json() : null; }
      catch { return null; }
    };
    try {
      const [kpiData, queueData, trendData] = await Promise.all([
        get('/system/kpis'), get('/patients/queue'), get('/system/visit-trend'),
      ]);
      if (kpiData) setKpis(kpiData);
      if (queueData) setQueue(queueData);
      if (trendData) setTrend(trendData);
      // Admin-only panels
      if (isAdmin) {
        const [logData, bedData] = await Promise.all([get('/system/logs'), get('/beds/')]);
        if (logData) setLogs(logData.slice(0, 8));
        if (bedData) setBeds(bedData);
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Bed occupancy chart data
  const occupied = beds.filter(b => b.status === 'Occupied').length;
  const available = beds.filter(b => b.status === 'Available').length;
  const cleaning = beds.filter(b => b.status === 'Cleaning').length;
  const bedData = [
    { name: 'Occupied', value: occupied, color: '#FF4757' },
    { name: 'Available', value: available, color: '#2ED573' },
    { name: 'Cleaning', value: cleaning, color: '#FFA502' },
  ].filter(d => d.value > 0);

  const totalBeds = beds.length || 1;
  const occupancyPct = Math.round((occupied / totalBeds) * 100);

  // Real visit-volume trend (encounters per month) from the backend.
  const flowData = trend.map((t) => ({ time: t.month, patients: t.visits }));

  const agentColor = {
    'Patient Intake': 'text-primary',
    'Doctor Assignment': 'text-secondary',
    'Diagnostic': 'text-warning',
    'Bed Management': 'text-success',
    'Coordinator': 'text-text-secondary',
    'Billing & Discharge': 'text-emergency',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">System Overview</h1>
          <p className="text-text-secondary">Live AI Agent orchestration — refreshes every 10s</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <div className="flex items-center space-x-2 text-sm text-[#2DC653] font-medium bg-[#2DC653] bg-opacity-10 px-3 py-1.5 rounded-full border border-[#2DC653] border-opacity-20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2DC653] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2DC653]"></span>
            </span>
            <span>System Online</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Patients Today" value={kpis?.total_patients ?? '…'} icon={Users} colorClass="bg-primary" delay={0.1} />
        <KPICard title="Active Emergencies" value={kpis?.active_emergencies ?? '…'} icon={AlertCircle} colorClass="bg-emergency" delay={0.2} />
        <KPICard title="Avg Wait Time" value={kpis?.avg_wait_time ?? '…'} icon={Clock} colorClass="bg-warning" delay={0.3} />
        <KPICard title="Doctors Available" value={kpis?.doctors_available ?? '…'} icon={Stethoscope} colorClass="bg-secondary" delay={0.4} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="glass-panel p-6 rounded-xl lg:col-span-2 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-text-primary mb-4">Visit Volume — recent months</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A6EBD" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0A6EBD" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
                <YAxis stroke="var(--color-text-secondary)" tick={{ fontSize: 12 }} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                <Area type="monotone" dataKey="patients" stroke="#0A6EBD" strokeWidth={3} fillOpacity={1} fill="url(#colorPatients)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Agent Feed */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
          className="glass-panel p-6 rounded-xl flex flex-col shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Agent Activity Feed</h3>
            <Activity className="w-5 h-5 text-secondary animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-72">
            {logs.length === 0 && (
              <p className="text-sm text-text-secondary">No agent activity yet. Register a patient to start!</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="relative pl-4 border-l-2 border-border-color pb-2 hover:border-primary transition-colors">
                <div className="absolute -left-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-primary"></div>
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-mono font-semibold ${agentColor[log.agent_name] || 'text-primary'}`}>{log.agent_name}</span>
                  <span className="text-xs text-text-secondary">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm mt-0.5 text-text-primary leading-snug">{log.message}</p>
                <span className="inline-block mt-1 text-[0.65rem] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-secondary text-text-secondary">
                  {log.action_type}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bed Occupancy + Live Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
        {/* Bed Occupancy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}
          className="glass-panel p-6 rounded-xl shadow-sm"
        >
          <h3 className="text-lg font-semibold text-text-primary mb-4">Bed Occupancy</h3>
          <div className="h-64 w-full relative">
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-3xl font-display font-bold text-text-primary">{occupancyPct}%</span>
              <span className="text-xs text-text-secondary">{occupied}/{totalBeds} beds</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bedData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                  {bedData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: 'var(--color-text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Queue Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8 }}
          className="glass-panel p-6 rounded-xl lg:col-span-2 overflow-hidden flex flex-col shadow-sm"
        >
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Live Intake Queue
            <span className="ml-2 text-sm font-normal text-text-secondary">({queue.length} patients)</span>
          </h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Patient ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-tr-lg">Doctor</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {queue.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No patients in queue. Register one to see live data here!</td></tr>
                )}
                {queue.map((p, i) => (
                  <tr key={p.id} className="border-b border-border-color hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{p.patient_id}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold text-white shadow-sm ${p.priority === 'Emergency' ? 'bg-emergency animate-pulse' : p.priority === 'High' ? 'bg-warning' : 'bg-success'}`}
                      >
                        {p.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{p.status}</td>
                    <td className="px-4 py-3 text-text-secondary">{p.assigned_doctor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
