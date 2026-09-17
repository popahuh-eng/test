// ============================================================
// Data Formatting Utilities
// ============================================================

export function formatPrice(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const num = Number(value);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const num = Number(value);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(decimals)}%`;
}

export function formatPnl(value: number | string | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const num = Number(value);
  const prefix = num > 0 ? '+' : '';
  return `${prefix}$${num.toFixed(2)}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
