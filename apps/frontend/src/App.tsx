// ============================================================
// Main Application Router & Auth Protection
// ============================================================
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login/Login';
import { Register } from './pages/Login/Register';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Markets } from './pages/Markets/Markets';
import { Instrument } from './pages/Instrument/Instrument';
import { Signals } from './pages/Signals/Signals';
import { Backtest } from './pages/Backtest/Backtest';
import { PaperTrading } from './pages/PaperTrading/PaperTrading';
import { Models } from './pages/Models/Models';
import { News } from './pages/News/News';
import { Settings } from './pages/Settings/Settings';
import { useAuthStore } from './store/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="markets" element={<Markets />} />
        <Route path="instruments/:symbol" element={<Instrument />} />
        <Route path="signals" element={<Signals />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="paper-trading" element={<PaperTrading />} />
        <Route path="models" element={<Models />} />
        <Route path="news" element={<News />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
