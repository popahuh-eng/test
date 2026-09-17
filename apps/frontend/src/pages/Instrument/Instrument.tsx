// ============================================================
// Instrument Detail Page (TradingView Chart + Signal Markers)
// ============================================================
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CandlestickChart } from '../../components/charts/CandlestickChart';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatPrice, formatDateTime } from '../../utils/format';
import { getReasonLabel } from '../../utils/reasonCodes';
import type { Signal, Candle, Timeframe } from '@trading/shared';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function Instrument() {
  const { symbol = 'XAUUSD' } = useParams();
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstrumentData() {
      setLoading(true);
      try {
        const [candleData, signalData] = await Promise.all([
          apiRequest<Candle[]>(`/api/market/${symbol}?timeframe=${timeframe}&limit=200`).catch(() => []),
          apiRequest<Signal[]>(`/api/signals?symbol=${symbol}&limit=10`).catch(() => []),
        ]);

        setCandles(candleData || []);
        setSignals(signalData || []);
        if (signalData && signalData.length > 0) {
          setActiveSignal(signalData[0]);
        } else {
          setActiveSignal(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadInstrumentData();
  }, [symbol, timeframe]);

  const formattedChartCandles = candles.map((c) => ({
    time: Math.floor(new Date(c.timestamp).getTime() / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));

  const chartSignalMarkers = signals.map((s) => ({
    time: Math.floor(new Date(s.timestamp).getTime() / 1000),
    direction: s.direction as 'LONG' | 'SHORT',
    entry: Number(s.entry),
    stopLoss: Number(s.stopLoss),
    takeProfit: Number(s.takeProfit),
  }));

  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle ? Number(latestCandle.close) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Instrument Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {symbol}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            ${formatPrice(currentPrice)}
          </span>
        </div>

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                backgroundColor: timeframe === tf ? 'var(--accent)' : 'var(--bg-secondary)',
                color: timeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-strong)',
                cursor: 'pointer',
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Candlestick Chart */}
      {loading ? (
        <LoadingSpinner message="RENDERING CANDLESTICK TICKS..." />
      ) : (
        <CandlestickChart candles={formattedChartCandles} signals={chartSignalMarkers} height={460} />
      )}

      {/* Signal Analysis Grid */}
      {activeSignal ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Card title="ACTIVE AI PROBABILISTIC SIGNAL" subtitle="Quantitative engine decision output">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Directional Bias</span>
                <Badge variant={activeSignal.direction === 'LONG' ? 'long' : 'short'}>
                  {activeSignal.direction}
                </Badge>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ENTRY</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ${formatPrice(activeSignal.entry)}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--short)' }}>STOP LOSS</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ${formatPrice(activeSignal.stopLoss)}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--long)' }}>TAKE PROFIT</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ${formatPrice(activeSignal.takeProfit)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Risk / Reward Ratio</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {Number(activeSignal.riskReward).toFixed(2)}x
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Model Confidence</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {Math.round(Number(activeSignal.confidence) * 100)}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Up vs Down Probability</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  UP: {Math.round(Number(activeSignal.probabilityUp) * 100)}% | DOWN: {Math.round(Number(activeSignal.probabilityDown) * 100)}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Detected Market Regime</span>
                <Badge variant="neutral">{activeSignal.marketRegime}</Badge>
              </div>
            </div>
          </Card>

          <Card title="REASON CODES & MODEL EXPLANATION" subtitle="Deterministic explanation of machine learning & feature state">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                WHY WAS THIS SIGNAL GENERATED?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeSignal.reasonCodes && activeSignal.reasonCodes.length > 0 ? (
                  activeSignal.reasonCodes.map((code) => (
                    <div
                      key={code}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{code}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {getReasonLabel(code)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    No specific reason codes logged.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Model Version: {activeSignal.modelVersion} • Generated: {formatDateTime(activeSignal.timestamp)}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card title="NO ACTIVE SIGNAL" subtitle="Filtered by risk, confidence, or data cooldown">
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Current market regime does not meet the minimum confidence threshold ({'>='}70%) or is currently within cooldown.
          </div>
        </Card>
      )}
    </div>
  );
}
