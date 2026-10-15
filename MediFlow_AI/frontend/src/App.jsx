import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';
import PatientPortal from './pages/PatientPortal';

import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import MyPatients from './pages/MyPatients';
import PatientChart from './pages/PatientChart';
import Registration from './pages/Registration';
import Doctors from './pages/Doctors';
import Beds from './pages/Beds';
import Diagnostics from './pages/Diagnostics';
import Billing from './pages/Billing';
import Appointments from './pages/Appointments';
import Coordinator from './pages/Coordinator';
import Rounds from './pages/Rounds';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import Staff from './pages/Staff';
import Account from './pages/Account';

const guard = (element, roles) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

function App() {
  const { initTheme } = useThemeStore();
  useEffect(() => { initTheme(); }, [initTheme]);
  const role = useAuthStore((s) => s.user?.role);

  if (role === 'Patient') {
    return (
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<ProtectedRoute><PatientPortal /></ProtectedRoute>} />
          </Routes>
        </Router>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/account" element={<Account />} />

            <Route path="/patients" element={guard(<Patients />, ['Admin', 'Nurse', 'Receptionist'])} />
            <Route path="/patients/:patientId" element={<PatientChart />} />
            <Route path="/my-patients" element={guard(<MyPatients />, ['Doctor'])} />
            <Route path="/rounds" element={guard(<Rounds />, ['Admin', 'Doctor', 'Nurse'])} />

            <Route path="/registration" element={guard(<Registration />, ['Admin', 'Receptionist'])} />
            <Route path="/doctors" element={guard(<Doctors />, ['Admin'])} />
            <Route path="/diagnostics" element={guard(<Diagnostics />, ['Admin', 'Doctor', 'Nurse'])} />
            <Route path="/beds" element={guard(<Beds />, ['Admin', 'Nurse'])} />
            <Route path="/billing" element={guard(<Billing />, ['Admin', 'Doctor', 'Receptionist'])} />
            <Route path="/appointments" element={guard(<Appointments />, ['Admin', 'Doctor', 'Receptionist'])} />
            <Route path="/coordinator" element={guard(<Coordinator />, ['Admin'])} />
            <Route path="/reports" element={guard(<Reports />, ['Admin'])} />
            <Route path="/audit" element={guard(<AuditLog />, ['Admin'])} />
            <Route path="/staff" element={guard(<Staff />, ['Admin'])} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
