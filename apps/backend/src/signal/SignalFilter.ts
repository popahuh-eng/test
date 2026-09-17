// ============================================================
// Signal Filter — cooldown & hourly rate limiting via Redis
// ============================================================
import type { Redis } from 'ioredis';

/**
 * Prevents spam signals by enforcing:
 *  - Per-symbol cooldown period (TTL-based Redis key)
 *  - Per-symbol hourly max signal count (Redis counter)
 */
export class SignalFilter {
  constructor(private readonly redis: Redis) {}

  /**
   * Returns true if the cooldown window has passed (allowed to signal).
   * Returns false if we are still in cooldown (block).
   */
  async checkCooldown(
    userId: string,
    symbol: string,
    cooldownMinutes: number,
  ): Promise<boolean> {
    const key    = this.cooldownKey(userId, symbol);
    const exists = await this.redis.exists(key);
    return exists === 0; // 0 = key not present = cooldown expired = allowed
  }

  /**
   * Returns true if hourly limit has NOT been reached (allowed).
   * Returns false if limit exceeded (block).
   */
  async checkHourlyLimit(
    userId: string,
    symbol: string,
    maxPerHour: number,
  ): Promise<boolean> {
    const key   = this.hourlyKey(userId, symbol);
    const count = await this.redis.get(key);
    const n     = count ? parseInt(count, 10) : 0;
    return n < maxPerHour;
  }

  /**
   * Record that a signal was generated:
   *  - Sets cooldown key with TTL = cooldownMinutes
   *  - Increments hourly counter; sets TTL = 3600s if first signal this hour
   */
  async recordSignal(
    userId: string,
    symbol: string,
    cooldownMinutes: number,
  ): Promise<void> {
    const cdKey    = this.cooldownKey(userId, symbol);
    const hourKey  = this.hourlyKey(userId, symbol);

    // Set cooldown (nx ensures we only extend if not already set in race, but
    // here we always want to refresh the cooldown on a new signal)
    await this.redis.set(cdKey, '1', 'EX', cooldownMinutes * 60);

    // Increment hourly counter; initialise with TTL if first signal this hour
    const newCount = await this.redis.incr(hourKey);
    if (newCount === 1) {
      // First signal in this hour window — set TTL to remainder of current hour
      const now        = Date.now();
      const msToNextHr = 3_600_000 - (now % 3_600_000);
      await this.redis.pexpire(hourKey, msToNextHr);
    }
  }

  // ── Key helpers ─────────────────────────────────────────

  private cooldownKey(userId: string, symbol: string): string {
    return `signal:cooldown:${userId}:${symbol}`;
  }

  private hourlyKey(userId: string, symbol: string): string {
    // Bucket by current UTC hour to reset automatically
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    return `signal:hourly:${userId}:${symbol}:${hourBucket}`;
  }
}
