// ============================================================
// News & Macro Events Feed Page
// ============================================================
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/Loading';
import { formatDateTime } from '../../utils/format';
import type { NewsItem } from '@trading/shared';

export function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');

  useEffect(() => {
    apiRequest<NewsItem[]>('/api/news?limit=30')
      .then((data) => setNews(data || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="FETCHING FINANCIAL NEWS STREAM..." />;

  const filteredNews = news.filter((item) => {
    if (selectedSentiment === 'POSITIVE') return Number(item.sentiment) > 0.1;
    if (selectedSentiment === 'NEGATIVE') return Number(item.sentiment) < -0.1;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          padding: '10px 16px',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          Sentiment Filter:
        </span>
        {['ALL', 'POSITIVE', 'NEGATIVE'].map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSentiment(s)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              backgroundColor: selectedSentiment === s ? 'var(--accent)' : 'var(--bg-secondary)',
              color: selectedSentiment === s ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* News Feed List */}
      <Card
        title="AGGREGATED FINANCIAL NEWS & MACRO SENTIMENT"
        subtitle="Processed through NLP scoring pipeline (Sentiment [-1, 1], Relevance [0, 1], Impact [0, 1])"
      >
        {filteredNews.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No news items matching selected filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredNews.map((item) => {
              const sent = Number(item.sentiment || 0);
              const relevance = Number(item.relevance || 0);
              const impact = Number(item.impactScore || 0);

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.source} • {formatDateTime(item.timestamp)}
                      </span>
                      {item.symbols?.map((sym) => (
                        <Badge key={sym} variant="neutral">
                          {sym}
                        </Badge>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Badge variant={sent > 0.1 ? 'long' : sent < -0.1 ? 'short' : 'neutral'}>
                        SENTIMENT: {sent > 0 ? `+${sent.toFixed(2)}` : sent.toFixed(2)}
                      </Badge>
                      <Badge variant="info">IMPACT: {impact.toFixed(2)}</Badge>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {item.title}
                  </h4>

                  {item.summary && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      {item.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
