// ============================================================
// Layout Component (Sidebar + TopBar + Safety Banner + Outlet)
// ============================================================
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ShieldAlert } from 'lucide-react';

export function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Safety Header Banner */}
        <div className="paper-trading-banner">
          <ShieldAlert size={14} />
          <span>Paper Trading Mode Active — Simulation Only. No Real Broker Orders Sent.</span>
        </div>
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
