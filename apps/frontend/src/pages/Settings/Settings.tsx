// ============================================================
// User Settings & Risk Parameters Page
// ============================================================
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Loading';
import { getAiConfig, saveAiConfig } from '../../config/ai';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [riskPerTrade, setRiskPerTrade] = useState('1.0');
  const [minConfidence, setMinConfidence] = useState('0.70');
  const [minRR, setMinRR] = useState('2.0');
  const [cooldownMinutes, setCooldownMinutes] = useState('60');
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const [newsEnabled, setNewsEnabled] = useState(true);

  useEffect(() => {
    apiRequest<any>('/api/settings')
      .then((data) => {
        if (data) {
          setRiskPerTrade(String(data.riskPerTrade ?? '1.0'));
          setMinConfidence(String(data.minConfidence ?? '0.70'));
          setMinRR(String(data.minRR ?? '2.0'));
          setCooldownMinutes(String(data.signalCooldownMinutes ?? '60'));
          setTelegramAlerts(data.telegramAlerts ?? true);
          setNewsEnabled(data.newsEnabled ?? true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          riskPerTrade: Number(riskPerTrade),
          minConfidence: Number(minConfidence),
          minRR: Number(minRR),
          signalCooldownMinutes: Number(cooldownMinutes),
          telegramAlerts,
          newsEnabled,
        }),
      });
      setSavedSuccess(true);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="LOADING USER CONFIGURATION..." />;

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card
        title="RISK & SIGNAL ENGINE PREFERENCES"
        subtitle="Configure risk limits and signal generation thresholds"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {savedSuccess && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--long-bg)',
                border: '1px solid var(--long)',
                color: 'var(--long)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              SETTINGS PERSISTED TO DATABASE
            </div>
          )}

          <Input
            label="Risk Per Trade (%)"
            type="number"
            step="0.1"
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(e.target.value)}
            required
          />

          <Input
            label="Minimum Model Confidence [0.50 - 0.95]"
            type="number"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            required
          />

          <Input
            label="Minimum Risk / Reward Ratio (e.g. 2.0 = 2:1)"
            type="number"
            step="0.1"
            value={minRR}
            onChange={(e) => setMinRR(e.target.value)}
            required
          />

          <Input
            label="Signal Cooldown Window (Minutes)"
            type="number"
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(e.target.value)}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={telegramAlerts}
                onChange={(e) => setTelegramAlerts(e.target.checked)}
              />
              <span>Telegram Instant Push Alerts</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={newsEnabled}
                onChange={(e) => setNewsEnabled(e.target.checked)}
              />
              <span>Include Financial News / Sentiment in Feature Pipeline</span>
            </label>
          </div>

          <Button type="submit" variant="primary" disabled={saving} style={{ marginTop: '12px' }}>
            {saving ? 'SAVING...' : 'SAVE SETTINGS'}
          </Button>
        </form>
      </Card>

      {/* AI Copilot Configuration */}
      <AiSettingsCard />
    </div>
  );
}

function AiSettingsCard() {
  const initial = getAiConfig();
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [saved, setSaved] = useState(false);

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    saveAiConfig({ apiKey, baseUrl, model });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card
      title="AI COPILOT & LLM GATEWAY"
      subtitle="OrcaRouter / OpenAI-compatible endpoint credentials"
    >
      <form onSubmit={handleSaveAi} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {saved && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--long-bg)',
              border: '1px solid var(--long)',
              color: 'var(--long)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            AI CREDENTIALS SAVED TO LOCAL STORAGE
          </div>
        )}

        <Input
          label="AI API Key"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-orca-..."
          required
        />

        <Input
          label="Gateway Base URL"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.orcarouter.ai/v1"
          required
        />

        <Input
          label="Model Identifier"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/gpt-4o-mini"
          required
        />

        <Button type="submit" variant="secondary" style={{ marginTop: '8px' }}>
          UPDATE AI CONFIGURATION
        </Button>
      </form>
    </Card>
  );
}
