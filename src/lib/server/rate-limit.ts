export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export type RateLimiterOptions = {
  capacity: number;
  refillIntervalMs: number;
  now?: () => number;
};

type Bucket = { tokens: number; updatedAt: number };

export function createRateLimiter(opts: RateLimiterOptions) {
  const now = opts.now ?? (() => Date.now());
  const refillPerMs = opts.capacity / opts.refillIntervalMs;
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, t: number): Bucket {
    const elapsed = t - bucket.updatedAt;
    const refilled = Math.min(opts.capacity, bucket.tokens + elapsed * refillPerMs);
    return { tokens: refilled, updatedAt: t };
  }

  function take(key: string): RateLimitResult {
    const t = now();
    const current = buckets.get(key) ?? { tokens: opts.capacity, updatedAt: t };
    const refilled = refill(current, t);

    if (refilled.tokens >= 1) {
      buckets.set(key, { tokens: refilled.tokens - 1, updatedAt: t });
      return { allowed: true };
    }

    buckets.set(key, refilled);
    const tokensNeeded = 1 - refilled.tokens;
    const retryAfterMs = Math.ceil(tokensNeeded / refillPerMs);
    return { allowed: false, retryAfterMs };
  }

  return { take };
}

export const DEFAULT_RATE_LIMIT = {
  capacity: 10,
  refillIntervalMs: 60_000
};
