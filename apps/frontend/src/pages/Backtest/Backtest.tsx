// ============================================================
// Backtest Page (Run Simulation, View Equity Curve & Trades)
// ============================================================
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { EquityCurveChart } from '../../components/charts/EquityCurveChart';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatPrice, formatPnl, formatPercent, formatDateTime } from '../../utils/format';
import type { BacktestResult } from '@trading/shared';

export function Backtest() {
  const [backtestsList, setBacktestsList] = useState<BacktestResult[]>([]);
  const [activeBacktest, setActiveBacktest] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('1h');
  const [startingBalance, setStartingBalance] = useState('10000');
  const [riskPerTrade, setRiskPerTrade] = useState('1.0');

  useEffect(() => {
    loadBacktests();
  }, []);

  async function loadBacktests() {
    try {
      const data = await apiRequest<BacktestResult[]>('/api/backtests');
      setBacktestsList(data || []);
      if (data && data.length > 0) {
        loadBacktestDetail(data[0].id);
      }
    } catch {
      // ignore
    }
  }

  async function loadBacktestDetail(id: string) {
    try {
      const detail = await apiRequest<any>(`/api/backtests/${id}`);
      setActiveBacktest(detail);
    } catch {
      // ignore
    }
  }

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const created = await apiRequest<BacktestResult>('/api/backtests', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          timeframe,
          startDate: thirtyDaysAgo.toISOString(),
          endDate: now.toISOString(),
          startingBalance: Number(startingBalance),
          riskPerTrade: Number(riskPerTrade),
          modelVersion: 'baseline_v1',
          commission: 0.0002,
          slippage: 0.0001,
          spreadPips: 1,
        }),
      });

      // Poll until completed
      const pollInterval = setInterval(async () => {
        try {
          const check = await apiRequest<any>(`/api/backtests/${created.id}`);
          if (check.status === 'COMPLETED' || check.status === 'FAILED') {
            clearInterval(pollInterval);
            setActiveBacktest(check);
            setLoading(false);
            loadBacktests();
          }
        } catch {
          clearInterval(pollInterval);
          setLoading(false);
        }
      }, 1500);
    } catch (err: any) {
      alert(`Backtest error: ${err.message}`);
      setLoading(false);
    }
  };

  const tradeColumns: TableColumn<any>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (t) => formatDateTime(t.timestamp),
    },
    {
      key: 'direction',
      header: 'Dir',
      render: (t) => (
        <Badge variant={t.direction === 'LONG' ? 'long' : 'short'}>{t.direction}</Badge>
      ),
    },
    {
      key: 'entryPrice',
      header: 'Entry',
      render: (t) => formatPrice(t.entryPrice),
    },
    {
      key: 'exitPrice',
      header: 'Exit',
      render: (t) => formatPrice(t.exitPrice),
    },
    {
      key: 'pnl',
      header: 'Net PnL',
      render: (t) => (
        <span
          style={{
            color: Number(t.pnl) >= 0 ? 'var(--long)' : 'var(--short)',
            fontWeight: 600,
          }}
        >
          {formatPnl(t.pnl)}
        </span>
      ),
    },
    {
      key: 'fees',
      header: 'Fees',
      render: (t) => `$${formatPrice(t.fees)}`,
    },
    {
      key: 'exitReason',
      header: 'Reason',
      render: (t) => (
        <Badge variant={t.exitReason === 'TP' ? 'long' : t.exitReason === 'SL' ? 'short' : 'neutral'}>
          {t.exitReason}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Form Grid: Configuration */}
      <Card
        title="BACKTEST ENGINE CONFIGURATION"
        subtitle="Simulate strategy with strict causal progression, commissions, and execution delay"
      >
        <form
          onSubmit={handleRunBacktest}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr) auto',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <Select
            label="Trading Asset"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            options={[
              { value: 'XAUUSD', label: 'XAU/USD (Gold)' },
              { value: 'BTCUSDT', label: 'BTC/USDT (Bitcoin)' },
              { value: 'ETHUSDT', label: 'ETH/USDT (Ethereum)' },
              { value: 'EURUSD', label: 'EUR/USD (Euro)' },
            ]}
          />

          <Select
            label="Timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            options={[
              { value: '15m', label: '15 Minutes' },
              { value: '1h', label: '1 Hour' },
              { value: '4h', label: '4 Hours' },
              { value: '1d', label: '1 Day' },
            ]}
          />

          <Input
            label="Initial Balance ($)"
            type="number"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
          />

          <Input
            label="Risk / Trade (%)"
            type="number"
            step="0.1"
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(e.target.value)}
          />

          <Button type="submit" variant="primary" disabled={loading} style={{ height: '35px' }}>
            {loading ? 'SIMULATING...' : 'EXECUTE BACKTEST'}
          </Button>
        </form>
      </Card>

      {/* Results View */}
      {loading ? (
        <LoadingSpinner message="RUNNING BACKTEST ENGINE OVER HISTORICAL TICKS..." />
      ) : activeBacktest && activeBacktest.status === 'COMPLETED' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NET PNL</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: Number(activeBacktest.netPnl) >= 0 ? 'var(--long)' : 'var(--short)',
                }}
              >
                {formatPnl(activeBacktest.netPnl)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WIN RATE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {formatPercent(Number(activeBacktest.winRate) * 100)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PROFIT FACTOR</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {Number(activeBacktest.profitFactor).toFixed(2)}x
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MAX DRAWDOWN</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--short)' }}>
                {formatPercent(Number(activeBacktest.maxDrawdown) * 100)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SHARPE RATIO</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {Number(activeBacktest.sharpeRatio).toFixed(2)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL TRADES</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {activeBacktest.totalTrades}
              </div>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <Card
            title={`EQUITY CURVE // ${activeBacktest.config?.symbol} (${activeBacktest.config?.timeframe})`}
            subtitle="Portfolio balance progression over time including fees and simulated slippage"
          >
            <EquityCurveChart
              data={activeBacktest.equityCurve || []}
              startingBalance={Number(activeBacktest.startingBalance || 10000)}
              height={260}
            />
          </Card>

          {/* Trades Log */}
          <Card
            title="SIMULATED TRADES LOG"
            subtitle="Individual executions with intra-bar SL/TP fills"
          >
            <Table
              columns={tradeColumns}
              data={activeBacktest.trades || []}
              emptyMessage="No trades generated during this backtest period."
            />
          </Card>
        </div>
      ) : (
        <Card title="NO RECENT SIMULATION" subtitle="Configure parameters above and click EXECUTE BACKTEST" />
      )}
    </div>
  );
}
