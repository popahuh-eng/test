// ============================================================
// AI Configuration (OrcaRouter / OpenAI-compatible endpoint)
// ============================================================

const DEFAULT_AI_KEY = 'sk-orca-P2c4qgI1xTnbxWmpem4FUoTwsSNmKGPFSQMRm1uuVDU';
const DEFAULT_BASE_URL = 'https://api.orcarouter.ai/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export function getAiConfig() {
  const storedKey = localStorage.getItem('trader_ai_api_key');
  const storedUrl = localStorage.getItem('trader_ai_base_url');
  const storedModel = localStorage.getItem('trader_ai_model');

  return {
    apiKey: storedKey || import.meta.env.VITE_AI_API_KEY || DEFAULT_AI_KEY,
    baseUrl: storedUrl || import.meta.env.VITE_AI_BASE_URL || DEFAULT_BASE_URL,
    model: storedModel || import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL,
  };
}

export function saveAiConfig(config: { apiKey?: string; baseUrl?: string; model?: string }) {
  if (config.apiKey !== undefined) localStorage.setItem('trader_ai_api_key', config.apiKey);
  if (config.baseUrl !== undefined) localStorage.setItem('trader_ai_base_url', config.baseUrl);
  if (config.model !== undefined) localStorage.setItem('trader_ai_model', config.model);
}
