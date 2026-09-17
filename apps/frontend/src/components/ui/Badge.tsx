// ============================================================
// Terminal Badge Component (Square, High Contrast)
// ============================================================
import React from 'react';

export type BadgeVariant = 'long' | 'short' | 'neutral' | 'warning' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({ variant = 'neutral', children, style }: BadgeProps) {
  let bg = 'var(--bg-hover)';
  let color = 'var(--text-secondary)';
  let border = 'var(--border-subtle)';

  if (variant === 'long') {
    bg = 'var(--long-bg)';
    color = 'var(--long)';
    border = 'rgba(34, 197, 94, 0.3)';
  } else if (variant === 'short') {
    bg = 'var(--short-bg)';
    color = 'var(--short)';
    border = 'rgba(239, 68, 68, 0.3)';
  } else if (variant === 'warning') {
    bg = 'var(--warning-bg)';
    color = 'var(--warning)';
    border = 'rgba(245, 158, 11, 0.3)';
  } else if (variant === 'info') {
    bg = 'rgba(59, 130, 246, 0.1)';
    color = 'var(--accent)';
    border = 'rgba(59, 130, 246, 0.3)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        lineHeight: 1.2,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
