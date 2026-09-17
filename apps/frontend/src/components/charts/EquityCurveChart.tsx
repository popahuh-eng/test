// ============================================================
// Equity Curve Component using Recharts
// ============================================================
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface EquityPoint {
  timestamp: string | Date;
  equity: number;
}

interface EquityCurveProps {
  data: EquityPoint[];
  startingBalance: number;
  height?: number;
}

export function EquityCurveChart({ data, startingBalance, height = 240 }: EquityCurveProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        No equity curve data available
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    time:
      typeof d.timestamp === 'string'
        ? d.timestamp.split('T')[0]
        : new Date(d.timestamp).toISOString().split('T')[0],
    equity: Number(d.equity),
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <XAxis
            dataKey="time"
            stroke="#555555"
            fontSize={10}
            tickLine={false}
            fontFamily="var(--font-mono)"
          />
          <YAxis
            stroke="#555555"
            fontSize={10}
            tickLine={false}
            domain={['auto', 'auto']}
            fontFamily="var(--font-mono)"
            tickFormatter={(val) => `$${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#121212',
              borderColor: '#333333',
              borderRadius: '0px',
              color: '#ededed',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <ReferenceLine
            y={startingBalance}
            stroke="#666666"
            strokeDasharray="3 3"
            label={{
              value: `Initial: $${startingBalance}`,
              fill: '#888888',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
