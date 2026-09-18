// ============================================================
// AI Service — OrcaRouter / LLM Client
// ============================================================
import { getAiConfig } from '../config/ai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function queryAi(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = getAiConfig();

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('AI API Key is not set. Please provide an API key in Settings.');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `AI API error (HTTP ${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        errorMessage = parsed.error.message;
      }
    } catch {
      errorMessage = errorBody || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

export async function explainSignalWithAi(signal: any): Promise<string> {
  const systemPrompt = `You are a Quantitative Trading Risk & Market Specialist. 
Analyze trading signals rigorously and concisely. Highlight:
1. Technical & ML rationale (regime, probabilities)
2. Risk parameters (entry, SL, TP, risk-reward ratio)
3. Actionable recommendation (cautious, aggressive, or avoid)
Format in clean, dark terminal markdown without emojis.`;

  const userPrompt = `Please analyze this signal:
Symbol: ${signal.symbol}
Direction: ${signal.direction}
Entry Price: ${signal.entry}
Stop Loss: ${signal.stopLoss}
Take Profit: ${signal.takeProfit}
Risk/Reward: ${signal.riskReward}
Confidence: ${(signal.confidence * 100).toFixed(1)}%
Regime: ${signal.marketRegime || 'UNKNOWN'}
Reason Codes: ${signal.reasonCodes?.join(', ') || 'None'}
News Sentiment: ${signal.newsSentiment || 'Neutral'}`;

  return queryAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
}
