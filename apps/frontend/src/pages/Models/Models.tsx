// ============================================================
// ML Models Registry & Monitoring Page
// ============================================================
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table, type TableColumn } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatDateTime } from '../../utils/format';
import type { ModelVersion } from '@trading/shared';

export function Models() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<ModelVersion[]>('/api/models')
      .then((data) => setModels(data || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="CONNECTING TO ML REGISTRY..." />;

  const columns: TableColumn<ModelVersion>[] = [
    {
      key: 'modelName',
      header: 'Model Name',
      render: (m) => <strong>{m.modelName}</strong>,
    },
    {
      key: 'version',
      header: 'Version',
      render: (m) => <span style={{ fontFamily: 'var(--font-mono)' }}>{m.version}</span>,
    },
    {
      key: 'featuresVersion',
      header: 'Features',
      render: (m) => m.featuresVersion,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (m) => (
        <Badge variant={m.isActive ? 'long' : 'neutral'}>
          {m.isActive ? 'ACTIVE INFERENCE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Trained At',
      render: (m) => formatDateTime(m.createdAt),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card
        title="ML MODEL REGISTRY & METRICS"
        subtitle="Chronologically trained models with walk-forward validation and zero data leakage"
      >
        <Table
          columns={columns}
          data={models}
          emptyMessage="No registered models. Baseline deterministic model is currently driving inference."
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card title="DIRECTIONAL MODEL ARCHITECTURE" subtitle="Supervised XGBoost Multi-Class Classifier">
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
            <div><strong>Target Horizon:</strong> Volatility-adjusted return over 4-bar window.</div>
            <div><strong>Classes:</strong> 3-way classification: UP (1), NEUTRAL (0), DOWN (-1).</div>
            <div><strong>Calibration:</strong> CalibratedClassifierCV ensures realistic probabilistic outputs.</div>
            <div><strong>Split:</strong> Strict chronological temporal split (70% Train, 15% Val, 15% Test).</div>
          </div>
        </Card>

        <Card title="CAUSAL INTEGRITY ENFORCEMENT" subtitle="Anti-lookahead validation layer">
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
            <div><strong>Automated Test:</strong> <code>apps/ml/tests/test_no_leakage.py</code> proves zero future leakage.</div>
            <div><strong>Macro Figures:</strong> Actuals remain masked until release timestamp passes.</div>
            <div><strong>Warmup Window:</strong> Rolling features compute purely on backward-looking data.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
