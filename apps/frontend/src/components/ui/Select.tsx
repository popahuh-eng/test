// ============================================================
// Terminal Select Dropdown Component
// ============================================================
import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
}

export function Select({ label, options, style, ...props }: SelectProps) {
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
      <select
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-strong)',
          padding: '8px 10px',
          fontSize: '12px',
          outline: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          ...style,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
