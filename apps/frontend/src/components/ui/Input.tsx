// ============================================================
// Terminal Form Input Component
// ============================================================
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: error ? '1px solid var(--short)' : '1px solid var(--border-strong)',
          padding: '8px 10px',
          fontSize: '12px',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--short)' }}>{error}</span>
      )}
    </div>
  );
}
