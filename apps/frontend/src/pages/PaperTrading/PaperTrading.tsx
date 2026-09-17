// ============================================================
// Paper Trading Page (Virtual Account, Active Positions, Log)
// ============================================================
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatPrice, formatPnl, formatDateTime } from '../../utils/format';
import type { PaperTrade } from '@trading/shared';

export function PaperTrading() {
  const [account, setAccount] = useState<any>(null);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaperData();
  }, []);

  async function loadPaperData() {
    try {
      const [accData, tradeData] = await Promise.all([
        apiRequest<any>('/api/paper/account'),
        apiRequest<PaperTrade[]>('/api/paper/trades'),
      ]);
      setAccount(accData);
      setTrades(tradeData || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const handleCloseTrade = async (tradeId: string, currentPrice: number) => {
    try {
      await apiRequest(`/api/paper/trades/${tradeId}/close`, {
        method: 'PATCH',
        body: JSON.stringify({ closePrice: currentPrice, closeReason: 'MANUAL_EXIT' }),
      });
      loadPaperData();
    } catch (err: any) {
      alert(`Failed to close trade: ${err.message}`);
    }
  };

  if (loading) return <LoadingSpinner message="CONNECTING TO PAPER ENGINE..." />;

  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const closedTrades = trades.filter((t) => t.status !== 'OPEN');

  const openColumns: TableColumn<PaperTrade>[] = [
    {
      key: 'symbol',
      header: 'Asset',
      render: (t) => <strong>{t.symbol}</strong>,
    },
    {
      key: 'direction',
      header: 'Direction',
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
      key: 'stopLoss',
      header: 'Stop Loss',
      render: (t) => formatPrice(t.stopLoss),
    },
    {
      key: 'takeProfit',
      header: 'Take Profit',
      render: (t) => formatPrice(t.takeProfit),
    },
    {
      key: 'positionSize',
      header: 'Position Size',
      render: (t) => t.positionSize,
    },
    {
      key: 'openedAt',
      header: 'Opened At',
      render: (t) => formatDateTime(t.openedAt),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (t) => (
        <button
          onClick={() => handleCloseTrade(t.id, Number(t.entryPrice))}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--short-bg)',
            border: '1px solid var(--short)',
            color: 'var(--short)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          CLOSE POSITION
        </button>
      ),
    },
  ];

  const closedColumns: TableColumn<PaperTrade>[] = [
    {
      key: 'symbol',
      header: 'Asset',
      render: (t) => <strong>{t.symbol}</strong>,
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
      key: 'closePrice',
      header: 'Exit',
      render: (t) => formatPrice(t.closePrice),
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
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge variant={t.status === 'TP' ? 'long' : t.status === 'SL' ? 'short' : 'neutral'}>
          {t.status}
        </Badge>
      ),
    },
    {
      key: 'closedAt',
      header: 'Closed At',
      render: (t) => formatDateTime(t.closedAt),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Account Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VIRTUAL BALANCE</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ${formatPrice(account?.balance)}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INITIAL BALANCE</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            ${formatPrice(account?.initialBalance)}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL REALIZED PNL</div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: Number(account?.totalPnl) >= 0 ? 'var(--long)' : 'var(--short)',
            }}
          >
            {formatPnl(account?.totalPnl)}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OPEN TRADES</div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {openTrades.length}
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <Card
        title="ACTIVE OPEN POSITIONS"
        subtitle="Monitored intra-bar by paper execution worker against live price ticks"
      >
        <Table
          columns={openColumns}
          data={openTrades}
          emptyMessage="No open virtual positions currently active."
        />
      </Card>

      {/* Closed Positions History */}
      <Card
        title="CLOSED POSITIONS AUDIT"
        subtitle="Completed simulated trades history with fee deductions"
      >
        <Table
          columns={closedColumns}
          data={closedTrades}
          emptyMessage="No historical paper trades recorded."
        />
      </Card>
    </div>
  );
}
