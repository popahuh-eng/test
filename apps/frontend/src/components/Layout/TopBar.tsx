import React from 'react';
import { useAuthStore } from '../../store/auth';
import { LogOut, Activity, Cpu } from 'lucide-react';

interface TopBarProps {
  onToggleAi?: () => void;
}

export function TopBar({ onToggleAi }: TopBarProps) {
  const { user, clearAuth } = useAuthStore();

  return (
    <header
      style={{
        height: '46px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}
    >
      {/* System Status Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: 'var(--long)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)' }}>SYSTEM HEALTHY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Activity size={12} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>ML ENGINE: ONLINE</span>
        </div>
      </div>

      {/* User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onToggleAi}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-accent)',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
          title="Open AI Terminal Copilot"
        >
          <Cpu size={12} />
          <span>AI COPILOT</span>
        </button>
        {user && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {user.email}
          </span>
        )}

        <button
          onClick={() => {
            clearAuth();
            window.location.href = '/login';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            outline: 'none',
          }}
          title="Log out"
        >
          <LogOut size={12} />
          <span>EXIT</span>
        </button>
      </div>
    </header>
  );
}
