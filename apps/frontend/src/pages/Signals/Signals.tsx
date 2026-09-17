// ============================================================
// Signals Page — Historic and Active AI Trading Signals
// ============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatPrice, formatDateTime } from '../../utils/format';
import { getReasonLabel } from '../../utils/reasonCodes';
import type { Signal } from '@trading/shared';

export function Signals() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Signal[]>('/api/signals?limit=50')
      .then((data) => {
        setSignals(data || []);
        if (data && data.length > 0) setSelectedSignal(data[0]);
      })
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="FETCHING AI SIGNALS FEED..." />;

  const columns: TableColumn<Signal>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (s) => formatDateTime(s.timestamp),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      render: (s) => <strong>{s.symbol}</strong>,
    },
    {
      key: 'direction',
      header: 'Signal',
      render: (s) => (
        <Badge variant={s.direction === 'LONG' ? 'long' : 'short'}>{s.direction}</Badge>
      ),
    },
    {
      key: 'entry',
      header: 'Entry',
      render: (s) => formatPrice(s.entry),
    },
    {
      key: 'stopLoss',
      header: 'Stop Loss',
      render: (s) => formatPrice(s.stopLoss),
    },
    {
      key: 'takeProfit',
      header: 'Take Profit',
      render: (s) => formatPrice(s.takeProfit),
    },
    {
      key: 'riskReward',
      header: 'R/R',
      render: (s) => `${Number(s.riskReward).toFixed(2)}x`,
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (s) => `${Math.round(Number(s.confidence) * 100)}%`,
    },
    {
      key: 'marketRegime',
      header: 'Regime',
      render: (s) => <Badge variant="neutral">{s.marketRegime}</Badge>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card
        title="AI GENERATED TRADING SIGNALS"
        subtitle="Probabilistic machine learning model recommendations with reason codes"
      >
        <Table
          columns={columns}
          data={signals}
          onRowClick={(s) => setSelectedSignal(s)}
          emptyMessage="No historical signals found. System evaluates on new candle arrivals."
        />
      </Card>

      {/* Selected Signal Deep Breakdown */}
      {selectedSignal && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <Card title={`SIGNAL DETAIL // ${selectedSignal.symbol} ${selectedSignal.direction}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Generated At:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatDateTime(selectedSignal.timestamp)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Model Version:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedSignal.modelVersion}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Probability UP / DOWN:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {Math.round(Number(selectedSignal.probabilityUp) * 100)}% / {Math.round(Number(selectedSignal.probabilityDown) * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recommended Risk Per Trade:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedSignal.riskPercent}%</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => navigate(`/instruments/${selectedSignal.symbol}`)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  OPEN ASSET CHART
                </button>
              </div>
            </div>
          </Card>

          <Card title="REASON CODES & EXPLANATIONS" subtitle="Why this signal was selected by the engine">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedSignal.reasonCodes && selectedSignal.reasonCodes.length > 0 ? (
                selectedSignal.reasonCodes.map((code) => (
                  <div
                    key={code}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {code}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {getReasonLabel(code)}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  Technical criteria met without specific reason code tags.
                </div>
              )}

              <div
                style={{
                  marginTop: '10px',
                  padding: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                DISCLAIMER: AI probabilistic model output. Past performance is no guarantee of future returns.
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
