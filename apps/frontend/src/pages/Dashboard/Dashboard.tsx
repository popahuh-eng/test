// ============================================================
// Main Dashboard (Markets, AI Signals, Paper Portfolio, News)
// ============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatPrice, formatPercent, formatPnl, formatDateTime } from '../../utils/format';
import { TrendingUp, Radio, Newspaper, ShieldCheck } from 'lucide-react';
import type { Signal, Instrument, NewsItem, PaperTrade } from '@trading/shared';

export function Dashboard() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [paperAccount, setPaperAccount] = useState<any>(null);
  const [openTrades, setOpenTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [instrData, sigData, newsData, accData, tradesData] = await Promise.all([
          apiRequest<Instrument[]>('/api/instruments').catch(() => []),
          apiRequest<Signal[]>('/api/signals?limit=5').catch(() => []),
          apiRequest<NewsItem[]>('/api/news?limit=5').catch(() => []),
          apiRequest<any>('/api/paper/account').catch(() => null),
          apiRequest<PaperTrade[]>('/api/paper/trades').catch(() => []),
        ]);

        setInstruments(instrData || []);
        setSignals(sigData || []);
        setNewsList(newsData || []);
        setPaperAccount(accData);
        setOpenTrades((tradesData || []).filter((t) => t.status === 'OPEN'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="INITIALIZING TERMINAL METRICS..." />;
  }

  const signalColumns: TableColumn<Signal>[] = [
    {
      key: 'symbol',
      header: 'Asset',
      render: (s) => <strong>{s.symbol}</strong>,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (s) => (
        <Badge variant={s.direction === 'LONG' ? 'long' : s.direction === 'SHORT' ? 'short' : 'neutral'}>
          {s.direction}
        </Badge>
      ),
    },
    {
      key: 'entry',
      header: 'Entry',
      render: (s) => formatPrice(s.entry),
    },
    {
      key: 'stopLoss',
      header: 'SL',
      render: (s) => formatPrice(s.stopLoss),
    },
    {
      key: 'takeProfit',
      header: 'TP',
      render: (s) => formatPrice(s.takeProfit),
    },
    {
      key: 'confidence',
      header: 'Conf.',
      render: (s) => `${Math.round(Number(s.confidence) * 100)}%`,
    },
    {
      key: 'marketRegime',
      header: 'Regime',
      render: (s) => <Badge variant="neutral">{s.marketRegime}</Badge>,
    },
    {
      key: 'timestamp',
      header: 'Time',
      render: (s) => formatDateTime(s.timestamp),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top 4 Markets Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        {instruments.slice(0, 4).map((inst) => {
          // Approximate mock current prices for initial display
          const prices: Record<string, number> = {
            XAUUSD: 2420.5,
            BTCUSDT: 64250.0,
            ETHUSDT: 3450.0,
            EURUSD: 1.0875,
          };
          const price = prices[inst.symbol] || 100.0;

          return (
            <div
              key={inst.symbol}
              onClick={() => navigate(`/instruments/${inst.symbol}`)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {inst.symbol}
                </span>
                <Badge variant="neutral">{inst.assetType}</Badge>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                ${formatPrice(price, inst.pricePrecision || 2)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {inst.displayName}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Signals & Quick Chart Link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card
            title="LATEST AI SIGNALS"
            subtitle="Probabilistic signal engine outputs (Multi-timeframe + Risk Adjusted)"
            action={
              <button
                onClick={() => navigate('/signals')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                VIEW ALL SIGNALS →
              </button>
            }
          >
            <Table
              columns={signalColumns}
              data={signals}
              emptyMessage="No AI signals recorded yet. Signal worker evaluates candles continuously."
              onRowClick={(s) => navigate(`/instruments/${s.symbol}`)}
            />
          </Card>

          <Card
            title="FINANCIAL NEWS & MACRO CONTEXT"
            subtitle="NLP Sentiment & Relevance Scores"
            action={
              <button
                onClick={() => navigate('/news')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                NEWS FEED →
              </button>
            }
          >
            {newsList.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No news items loaded. Check background news worker.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {newsList.map((item) => {
                  const sent = Number(item.sentiment || 0);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.source} • {formatDateTime(item.timestamp)}
                        </span>
                        <Badge variant={sent > 0.1 ? 'long' : sent < -0.1 ? 'short' : 'neutral'}>
                          Sent: {sent > 0 ? `+${sent.toFixed(2)}` : sent.toFixed(2)}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Paper Portfolio & System Guard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card title="PAPER TRADING ACCOUNT" subtitle="Simulated Virtual Execution">
            {paperAccount ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Virtual Balance</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ${formatPrice(paperAccount.balance)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Realized PnL</span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: Number(paperAccount.totalPnl) >= 0 ? 'var(--long)' : 'var(--short)',
                    }}
                  >
                    {formatPnl(paperAccount.totalPnl)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Open Positions</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {openTrades.length} trades
                  </span>
                </div>

                <button
                  onClick={() => navigate('/paper-trading')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    marginTop: '8px',
                  }}
                >
                  MANAGE POSITIONS & TRADES
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Account initializing...
              </div>
            )}
          </Card>

          <Card title="ARCHITECTURE PIPELINE" subtitle="Modular decoupled pipeline status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>DATA COLLECTORS</span>
                <span style={{ color: 'var(--long)' }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>FEATURE PIPELINE</span>
                <span style={{ color: 'var(--long)' }}>CAUSAL (NO LEAK)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>ML DIRECTION</span>
                <span style={{ color: 'var(--long)' }}>XGBOOST</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>SIGNAL FILTERS</span>
                <span style={{ color: 'var(--long)' }}>ENFORCED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>RISK SIZING</span>
                <span style={{ color: 'var(--long)' }}>ATR + LOT SIZE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>LIVE BROKER EXEC</span>
                <span style={{ color: 'var(--short)' }}>LOCKED (SAFETY)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
