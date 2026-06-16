import './App.css';
import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PatientDashboard from './components/citizenDashboard';
import AmbulanceDashboard from './components/workerDashboard';
import HospitalDashboard from './components/HospitalDashboard';
import PoliceDashboard from './components/PoliceDashboard';
import FireDashboard from './components/FireDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { clearAuthSession, getAuthSession } from './lib/auth';

function App() {
  const [session, setSession] = useState(() => getAuthSession());

  const isAuthenticated = Boolean(session?.role);

  const homeRoute = useMemo(() => {
    if (!session?.role) {
      return '/login';
    }

    if (session.role === 'ambulance') return '/ambulance';
    if (session.role === 'hospital') return '/hospital';
    if (session.role === 'police') return '/police';
    if (session.role === 'fire') return '/fire';
    if (session.role === 'admin') return '/admin';

    return '/patient';
  }, [session]);

  const handleLogin = (nextSession) => {
    setSession(nextSession);
  };

  const handleSignOut = () => {
    clearAuthSession();
    setSession(null);
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRoute} replace />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route
        path="/patient"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['patient']}>
            <PatientDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/ambulance"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['ambulance']}>
            <AmbulanceDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/hospital"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['hospital']}>
            <HospitalDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/police"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['police']}>
            <PoliceDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/fire"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['fire']}>
            <FireDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} role={session?.role} allowedRoles={['admin']}>
            <AdminDashboard session={session} onSignOut={handleSignOut} />
          </ProtectedRoute>
        )}
      />
      <Route path="/citizen" element={<Navigate to="/patient" replace />} />
      <Route path="/worker" element={<Navigate to="/ambulance" replace />} />
      <Route path="*" element={<Navigate to={homeRoute} replace />} />
    </Routes>
  );
}

export default App;
