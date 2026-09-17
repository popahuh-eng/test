// ============================================================
// Markets Page — Asset Directory & Specifications
// ============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/Loading';
import type { Instrument } from '@trading/shared';

export function Markets() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Instrument[]>('/api/instruments')
      .then((data) => setInstruments(data || []))
      .catch(() => setInstruments([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="LOADING ASSET DIRECTORY..." />;

  const columns: TableColumn<Instrument>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (i) => <strong>{i.symbol}</strong>,
    },
    {
      key: 'displayName',
      header: 'Name',
      render: (i) => i.displayName,
    },
    {
      key: 'assetType',
      header: 'Asset Class',
      render: (i) => <Badge variant="neutral">{i.assetType}</Badge>,
    },
    {
      key: 'exchange',
      header: 'Exchange / Provider',
      render: (i) => i.exchange || i.provider || 'DEMO',
    },
    {
      key: 'tickSize',
      header: 'Tick Size',
      render: (i) => i.tickSize,
    },
    {
      key: 'lotSize',
      header: 'Lot Size',
      render: (i) => i.lotSize,
    },
    {
      key: 'contractSize',
      header: 'Contract Size',
      render: (i) => i.contractSize,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (i) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/instruments/${i.symbol}`);
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--bg-hover)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          CHART →
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card
        title="SUPPORTED INSTRUMENTS"
        subtitle="Universal multi-asset abstraction layer (Forex, Crypto, Commodities)"
      >
        <Table
          columns={columns}
          data={instruments}
          onRowClick={(i) => navigate(`/instruments/${i.symbol}`)}
          emptyMessage="No instruments configured in database."
        />
      </Card>
    </div>
  );
}
