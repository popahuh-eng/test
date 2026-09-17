// ============================================================
// Terminal Loading Indicator Component
// ============================================================
import React from 'react';

export function LoadingSpinner({ message = 'Loading system state...' }: { message?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        gap: '12px',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          border: '2px solid var(--border-subtle)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>
        {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
      </style>
      <span>{message}</span>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '28px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            width: '100%',
          }}
        />
      ))}
    </div>
  );
}
