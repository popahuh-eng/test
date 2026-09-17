// ============================================================
// Terminal Empty State Component
// ============================================================
import React from 'react';

interface EmptyStateProps {
  title?: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title = 'NO DATA', description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        border: '1px dashed var(--border-strong)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          maxWidth: '360px',
          marginBottom: action ? '16px' : 0,
        }}
      >
        {description}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
