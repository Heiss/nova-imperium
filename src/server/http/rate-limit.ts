// A simple fixed window per client address for login, registration and
// invitation checks.
export class RateLimiter {
  private hits = new Map<string, { n: number; until: number }>();
  private attempts: number;
  private windowMs: number;
  private now: () => number;

  constructor(attempts: number, windowMs: number, now: () => number) {
    this.attempts = attempts;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Counts one attempt; true when the address is over the limit. */
  limited(key: string): boolean {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.until <= t) {
      entry = { n: 0, until: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.n++;
    return entry.n > this.attempts;
  }

  /** Forgets windows that are over (called now and then). */
  sweep(): void {
    const t = this.now();
    for (const [k, v] of this.hits) if (v.until <= t) this.hits.delete(k);
  }

  get size(): number {
    return this.hits.size;
  }
}
