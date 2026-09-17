// ============================================================
// Terminal Data Table Component
// ============================================================
import React from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          border: '1px dashed var(--border-subtle)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          textAlign: 'left',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-strong)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '10px 12px',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  textAlign: col.align || 'left',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (onRowClick)
                  e.currentTarget.style.backgroundColor =
                    idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)';
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 12px',
                    textAlign: col.align || 'left',
                    color: 'var(--text-primary)',
                    fontFamily:
                      typeof row[col.key] === 'number' || col.key.includes('price') || col.key.includes('pnl')
                        ? 'var(--font-mono)'
                        : 'inherit',
                  }}
                >
                  {col.render ? col.render(row) : row[col.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
