// ============================================================
// Terminal Sidebar Navigation (Square, Lucide Icons, No Emojis)
// ============================================================
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Radio,
  FlaskConical,
  ShieldCheck,
  Cpu,
  Newspaper,
  Sliders,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: TrendingUp },
  { to: '/signals', label: 'Signals', icon: Radio },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/paper-trading', label: 'Paper Trading', icon: ShieldCheck },
  { to: '/models', label: 'ML Models', icon: Cpu },
  { to: '/news', label: 'News / Macro', icon: Newspaper },
  { to: '/settings', label: 'Settings', icon: Sliders },
];

export function Sidebar() {
  return (
    <aside
      style={{
        width: '210px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--text-primary)',
          }}
        >
          ALPHA // SIGNAL
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Quantitative Platform
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'background-color 0.1s, color 0.1s',
              })}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Safety Mode Footer */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: '2px' }}>
          PAPER-FIRST MODE
        </div>
        <div>Live Execution: OFF</div>
      </div>
    </aside>
  );
}
