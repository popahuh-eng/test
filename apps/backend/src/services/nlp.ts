// ============================================================
// Basic Financial NLP — keyword-based sentiment
// Designed to be replaced with ML-based NLP in a later phase.
// ============================================================

/**
 * Simple keyword-based NLP for financial news sentiment.
 * Provides baseline sentiment scores without external ML dependency.
 */
export class FinancialNLP {
  private readonly positiveWords = [
    'surge', 'rally', 'gain', 'rise', 'bull', 'strong', 'growth', 'positive',
    'beat', 'exceed', 'record', 'recovery', 'boost', 'jump', 'soar', 'advance',
    'profit', 'optimism', 'breakout', 'momentum', 'outperform', 'expansion',
    'inflow', 'upgrade', 'buy', 'rebound',
  ];

  private readonly negativeWords = [
    'drop', 'fall', 'decline', 'crash', 'bear', 'weak', 'recession', 'negative',
    'miss', 'below', 'loss', 'plunge', 'slump', 'tumble', 'sink', 'concern',
    'fear', 'risk', 'warning', 'selloff', 'downgrade', 'outflow', 'default',
    'contraction', 'inflation', 'hawkish',
  ];

  // Negation words that flip sentiment of next term
  private readonly negationWords = ['not', 'no', 'never', "n't", 'without', 'lack'];

  private readonly symbolKeywords: Record<string, string[]> = {
    XAUUSD:  ['gold', 'xau', 'bullion', 'precious metal', 'safe haven', 'aurum', 'troy ounce'],
    BTCUSDT: ['bitcoin', 'btc', 'crypto', 'cryptocurrency', 'blockchain', 'satoshi', 'halving'],
    ETHUSDT: ['ethereum', 'eth', 'defi', 'smart contract', 'gas fee', 'erc20', 'layer 2'],
    EURUSD:  ['euro', 'eur', 'ecb', 'eurozone', 'european central bank', 'eu economy'],
  };

  // High-authority financial sources get a multiplier
  private readonly authoritySourceMultiplier: Record<string, number> = {
    bloomberg:  1.5,
    reuters:    1.5,
    'wall street journal': 1.4,
    wsj:        1.4,
    cnbc:       1.2,
    'financial times': 1.4,
    ft:         1.4,
    marketwatch: 1.1,
    'seeking alpha': 0.9,
  };

  /**
   * Compute sentiment score in [-1, 1].
   * Uses keyword frequency with basic negation handling.
   */
  computeSentiment(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const lower = text.toLowerCase();
    const tokens = lower.split(/\W+/).filter(Boolean);
    let score    = 0;
    let total    = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Check if previous token is a negation
      const negated = i > 0 && this.negationWords.includes(tokens[i - 1]);
      const polarity = negated ? -1 : 1;

      if (this.positiveWords.includes(token)) {
        score += polarity * 1;
        total += 1;
      } else if (this.negativeWords.includes(token)) {
        score -= polarity * 1;
        total += 1;
      }
    }

    if (total === 0) return 0;

    // Normalise to [-1, 1] using tanh to avoid extreme values on short texts
    return Math.tanh(score / Math.max(total, 1) * 2);
  }

  /**
   * Compute relevance score in [0, 1] for a given symbol.
   * Based on keyword match count normalised by total keyword set.
   */
  computeRelevance(text: string, symbol: string): number {
    if (!text) return 0;

    const lower    = text.toLowerCase();
    const keywords = this.symbolKeywords[symbol] ?? [];
    if (keywords.length === 0) return 0;

    let matchCount = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) matchCount++;
    }

    // Score: fraction of matched keywords, clamped to [0, 1]
    const raw = matchCount / keywords.length;
    return Math.min(raw * 2.5, 1.0); // amplify partial matches but cap at 1
  }

  /**
   * Compute impact score in [0, 1].
   * Based on: source authority + keyword strength + sentiment magnitude.
   */
  computeImpact(
    text: string,
    source: string,
    sentiment: number,
    relevance: number,
  ): number {
    // Source authority weight
    const lowerSource    = (source || '').toLowerCase();
    let authorityWeight  = 1.0;
    for (const [key, multiplier] of Object.entries(this.authoritySourceMultiplier)) {
      if (lowerSource.includes(key)) {
        authorityWeight = multiplier;
        break;
      }
    }

    // High-impact financial keywords
    const highImpactTerms = [
      'rate hike', 'rate cut', 'federal reserve', 'fomc', 'gdp', 'cpi', 'nfp',
      'earnings', 'bankruptcy', 'acquisition', 'merger', 'ipo', 'all-time high',
      'all-time low', 'circuit breaker', 'halt', 'sanctions', 'war', 'pandemic',
    ];
    const lower         = (text || '').toLowerCase();
    let keywordBonus    = 0;
    for (const term of highImpactTerms) {
      if (lower.includes(term)) keywordBonus += 0.1;
    }
    keywordBonus = Math.min(keywordBonus, 0.4);

    // Sentiment magnitude: strong signals in either direction matter more
    const sentimentMagnitude = Math.abs(sentiment);

    // Composite impact
    const raw = (relevance * 0.4 + sentimentMagnitude * 0.3 + keywordBonus * 0.3) * authorityWeight;
    return Math.min(Math.max(raw, 0), 1);
  }
}
