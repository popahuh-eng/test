// ============================================================
// React Error Boundary
// ============================================================
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--short)',
            margin: '24px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <h2 style={{ color: 'var(--short)', fontSize: '14px', marginBottom: '8px' }}>
            COMPONENT RUNTIME ERROR
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
            {this.state.errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            RELOAD APPLICATION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
