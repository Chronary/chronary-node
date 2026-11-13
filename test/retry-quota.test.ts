import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreClient } from '../src/client';
import { QuotaExceededError, RateLimitError } from '../src/error';
import { clientConfig, mockFetch } from './helpers';

// #1936 §1: a monthly plan limit (429 `quota_exceeded`) is never retried, and
// a server Retry-After never makes the client sleep longer than 60 seconds.

const QUOTA_BODY = {
  error: { type: 'quota_exceeded', message: 'Monthly API call limit of 1,000 reached.', metric: 'api_calls', request_id: 'req_q' },
};
const RATE_LIMIT_BODY = { error: { type: 'rate_limit_error', message: 'Too many requests', request_id: 'req_r' } };

/** The delays the client slept for between attempts (its request timeout is 30s+, so filtered out). */
function retryDelays(spy: ReturnType<typeof vi.spyOn>, requestTimeout: number): number[] {
  return spy.mock.calls.map((call) => call[1] as number).filter((ms) => ms !== requestTimeout);
}

describe('quota_exceeded is not retried', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws QuotaExceededError at once, with zero retries, whatever Retry-After says', async () => {
    const fetch = mockFetch([
      { status: 429, body: QUOTA_BODY, headers: { 'retry-after': '1700000' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 2 });

    const started = Date.now();
    const err = await client.request('GET', '/v1/agents').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect((err as QuotaExceededError).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('still retries a rate-limit 429, honouring Retry-After', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const fetch = mockFetch([
      { status: 429, body: RATE_LIMIT_BODY, headers: { 'retry-after': '2' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 2, timeout: 31_000 });

    const pending = client.request<{ ok: boolean }>('GET', '/v1/agents');
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(retryDelays(spy, 31_000)).toEqual([2_000]);
  });

  it('clamps a Retry-After above 60 seconds to 60 seconds', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const fetch = mockFetch([
      { status: 429, body: RATE_LIMIT_BODY, headers: { 'retry-after': '1700000' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 1, timeout: 31_000 });

    const pending = client.request<{ ok: boolean }>('GET', '/v1/agents');
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(retryDelays(spy, 31_000)).toEqual([60_000]);
  });

  it('a rate-limit 429 on the last attempt is a RateLimitError', async () => {
    const fetch = mockFetch([{ status: 429, body: RATE_LIMIT_BODY, headers: { 'retry-after': '1' } }]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 0 });
    await expect(client.request('GET', '/v1/agents')).rejects.toBeInstanceOf(RateLimitError);
  });
});
