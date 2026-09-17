// ============================================================
// Terminal Button Component (Square, Solid Fill/Outline)
// ============================================================
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  let bg = 'transparent';
  let color = 'var(--text-primary)';
  let border = '1px solid var(--border-strong)';

  if (variant === 'primary') {
    bg = 'var(--accent)';
    color = '#ffffff';
    border = '1px solid var(--accent)';
  } else if (variant === 'danger') {
    bg = 'var(--short)';
    color = '#ffffff';
    border = '1px solid var(--short)';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    border = '1px solid transparent';
  }

  const paddingMap = {
    sm: '4px 8px',
    md: '8px 14px',
    lg: '10px 18px',
  };

  const fontMap = {
    sm: '11px',
    md: '12px',
    lg: '13px',
  };

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: paddingMap[size],
        fontSize: fontMap[size],
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: bg,
        color,
        border,
        outline: 'none',
        transition: 'background-color 0.15s, border-color 0.15s',
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
}
