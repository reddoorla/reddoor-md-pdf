import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/lib/server/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the capacity', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 3, refillIntervalMs: 60_000, now: () => now });

    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
  });

  it('rejects the next request and reports retryAfterMs', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('1.1.1.1');
    limiter.take('1.1.1.1');

    const result = limiter.take('1.1.1.1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it('refills one token per interval/capacity step', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('1.1.1.1');
    limiter.take('1.1.1.1');
    expect(limiter.take('1.1.1.1').allowed).toBe(false);

    now += 30_000; // half an interval -> one token back for capacity 2
    expect(limiter.take('1.1.1.1').allowed).toBe(true);
    expect(limiter.take('1.1.1.1').allowed).toBe(false);
  });

  it('keeps separate buckets per key', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 1, refillIntervalMs: 60_000, now: () => now });

    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('b').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('caps tokens at capacity even after long idle', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('a');
    limiter.take('a');
    now += 10 * 60_000;

    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });
});
