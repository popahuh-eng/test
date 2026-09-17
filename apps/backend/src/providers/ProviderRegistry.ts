// ============================================================
// Provider Registry — selects and initialises data providers
// based on environment variables.
// ============================================================
import { MarketDataProvider, NewsProvider, SocialProvider } from './types';
import { DemoMarketDataProvider } from './demo/DemoMarketDataProvider';
import { DemoNewsProvider } from './demo/DemoNewsProvider';
import { TwelveDataProvider } from './twelvedata/TwelveDataProvider';
import { NewsApiProvider } from './newsapi/NewsApiProvider';
import { logger } from '../services/logger';

export class ProviderRegistry {
  private readonly marketProvider: MarketDataProvider;
  private readonly newsProvider: NewsProvider;
  private readonly socialProvider: SocialProvider | null;

  constructor() {
    // ── Market Data ───────────────────────────────────────
    const marketProviderEnv = (process.env.MARKET_DATA_PROVIDER ?? 'demo').toLowerCase();
    if (marketProviderEnv === 'twelvedata' && process.env.TWELVE_DATA_API_KEY) {
      this.marketProvider = new TwelveDataProvider();
      logger.info({ event: 'provider_init', provider: 'twelvedata' }, 'Using TwelveData market provider');
    } else {
      if (marketProviderEnv === 'twelvedata') {
        logger.warn(
          { event: 'provider_fallback', requested: 'twelvedata', reason: 'TWELVE_DATA_API_KEY missing' },
          'Falling back to demo market data provider',
        );
      }
      this.marketProvider = new DemoMarketDataProvider();
      logger.info({ event: 'provider_init', provider: 'demo' }, 'Using Demo market data provider');
    }

    // ── News ──────────────────────────────────────────────
    const newsProviderEnv = (process.env.NEWS_PROVIDER ?? 'demo').toLowerCase();
    if (newsProviderEnv === 'newsapi' && process.env.NEWS_API_KEY) {
      this.newsProvider = new NewsApiProvider();
      logger.info({ event: 'provider_init', provider: 'newsapi' }, 'Using NewsAPI news provider');
    } else {
      if (newsProviderEnv === 'newsapi') {
        logger.warn(
          { event: 'provider_fallback', requested: 'newsapi', reason: 'NEWS_API_KEY missing' },
          'Falling back to demo news provider',
        );
      }
      this.newsProvider = new DemoNewsProvider();
      logger.info({ event: 'provider_init', provider: 'demo-news' }, 'Using Demo news provider');
    }

    // ── Social ────────────────────────────────────────────
    const socialProviderEnv = (process.env.SOCIAL_PROVIDER ?? 'disabled').toLowerCase();
    if (socialProviderEnv === 'disabled') {
      this.socialProvider = null;
      logger.info({ event: 'provider_init', provider: 'social_disabled' }, 'Social provider disabled');
    } else {
      // Placeholder: Twitter/X provider not yet implemented
      logger.warn(
        { event: 'provider_unavailable', requested: socialProviderEnv },
        'Requested social provider not yet implemented; social disabled',
      );
      this.socialProvider = null;
    }
  }

  getMarketProvider(): MarketDataProvider {
    return this.marketProvider;
  }

  getNewsProvider(): NewsProvider {
    return this.newsProvider;
  }

  getSocialProvider(): SocialProvider | null {
    return this.socialProvider;
  }

  async checkAllStatuses(): Promise<Record<string, { status: string; message: string }>> {
    const [marketStatus, newsStatus] = await Promise.all([
      this.marketProvider.getStatus(),
      this.newsProvider.getStatus(),
    ]);

    const result: Record<string, { status: string; message: string }> = {
      [this.marketProvider.name]: marketStatus,
      [this.newsProvider.name]:   newsStatus,
    };

    if (this.socialProvider) {
      const socialStatus = await this.socialProvider.getStatus();
      result[this.socialProvider.name] = socialStatus;
    }

    return result;
  }
}
