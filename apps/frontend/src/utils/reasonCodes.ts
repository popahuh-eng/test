// ============================================================
// Reason Codes Explanation Mapping
// ============================================================

export const REASON_CODE_LABELS: Record<string, string> = {
  PROBABILITY_UP_DOMINANT: 'Directional probability strictly favors upside movement',
  PROBABILITY_DOWN_DOMINANT: 'Directional probability strictly favors downside movement',
  MOMENTUM_CONFIRMED: 'RSI & momentum metrics align with trade direction',
  REGIME_ALIGNED: 'Macro market regime matches proposed trade bias',
  NEWS_POSITIVE: 'Aggregated financial news sentiment is supportive and positive',
  NEWS_NEGATIVE: 'Aggregated financial news sentiment is negative / risk-off',
  VOLATILITY_ACCEPTABLE: 'Expected price volatility is within risk tolerance bounds',
  TECHNICAL_CONFIRMATION: 'Moving average alignment and trend slope validate setup',
  RISK_REWARD_ACCEPTABLE: 'Calculated Take-Profit to Stop-Loss ratio exceeds threshold',
};

export function getReasonLabel(code: string): string {
  return REASON_CODE_LABELS[code] || code.replace(/_/g, ' ');
}
