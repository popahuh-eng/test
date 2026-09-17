// ============================================================
// Terminal Card Component (Square, Solid Border, No Gradients)
// ============================================================
import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ title, subtitle, action, children, className = '', style }: CardProps) {
  return (
    <div
      className={`terminal-card ${className}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subtitle}</span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children && <div style={{ padding: '16px', flex: 1 }}>{children}</div>}
    </div>
  );
}
