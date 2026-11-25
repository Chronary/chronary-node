import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chronary } from '../src/index';
import { ChronaryError, RateLimitError } from '../src/error';
import { clientConfig, mockFetch } from './helpers';

// bughunt-BH-057 (#2558): a refusal whose Retry-After (900 s, the Free iCal
// manual-sync cooldown; seconds to UTC midnight for the anonymous sign-up cap)
// is far beyond the 60 s retry cap cannot succeed inside the retry window, so
// the SDK surfaces it at once instead of sleeping 2 x 60 s and failing anyway.
const COOLDOWN_BODY = {
  error: { type: 'rate_limit_error', message: 'A sync for this feed started recently.', request_id: 'req_c' },
};
const CAPACITY_BODY = {
  error: { type: 'anonymous_signup_capacity', message: 'Sign-up capacity reached for today.', request_id: 'req_s' },
};

/** The delays the client slept for between attempts (its request timeout is filtered out). */
function retryDelays(spy: ReturnType<typeof vi.spyOn>, requestTimeout: number): number[] {
  return spy.mock.calls.map((call) => call[1] as number).filter((ms) => ms !== requestTimeout);
}

describe('bughunt-BH-057 Retry-After beyond the retry cap', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not retry a 429 with Retry-After: 900', async () => {
    vi.useFakeTimers();
    const fetch = mockFetch([
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': '900' } },
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': '840' } },
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': '780' } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 2, timeout: 31_000 });

    const settled = client.icalSubscriptions.sync('ics_1').then(
      () => null,
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(130_000);
    const err = await settled;
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(900);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 503 whose Retry-After is hours away', async () => {
    vi.useFakeTimers();
    const fetch = mockFetch([
      { status: 503, body: CAPACITY_BODY, headers: { 'retry-after': '36000' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 2, timeout: 31_000 });

    const settled = client.agents.get('agt_1').then(
      () => null,
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(130_000);
    const err = await settled;
    expect(err).toBeInstanceOf(ChronaryError);
    expect((err as ChronaryError).status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still retries a 503 whose Retry-After is within the cap, sleeping that long', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const fetch = mockFetch([
      { status: 503, body: CAPACITY_BODY, headers: { 'retry-after': '5' } },
      { status: 200, body: { id: 'agt_1' } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 2, timeout: 31_000 });

    const pending = client.agents.get('agt_1');
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toMatchObject({ id: 'agt_1' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(retryDelays(spy, 31_000)).toEqual([5_000]);
  });

  it('retries a Retry-After of exactly 60 seconds', async () => {
    vi.useFakeTimers();
    const fetch = mockFetch([
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': '60' } },
      { status: 200, body: { status: 'syncing' } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 1, timeout: 31_000 });

    const pending = client.icalSubscriptions.sync('ics_1');
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(pending).resolves.toEqual({ status: 'syncing' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Review of #2748: V8's loose Date.parse reads "1.5" as a date in 2001,
  // which made the wait 0 ms. A Retry-After that is neither delta-seconds nor
  // an HTTP date falls back to the exponential backoff.
  it('a Retry-After of "1.5" falls back to backoff (not a 0 ms wait)', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const fetch = mockFetch([
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': '1.5' } },
      { status: 200, body: { status: 'syncing' } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 1, timeout: 31_000 });

    const pending = client.icalSubscriptions.sync('ics_1');
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual({ status: 'syncing' });
    expect(retryDelays(spy, 31_000)).toEqual([500]);
  });

  it('an HTTP-date Retry-After 30 s ahead is waited out', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const when = new Date(Date.now() + 30_000).toUTCString();
    const fetch = mockFetch([
      { status: 429, body: COOLDOWN_BODY, headers: { 'retry-after': when } },
      { status: 200, body: { status: 'syncing' } },
    ]);
    const client = new Chronary({ ...clientConfig(fetch), maxRetries: 1, timeout: 31_000 });

    const pending = client.icalSubscriptions.sync('ics_1');
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toEqual({ status: 'syncing' });
    const [delay] = retryDelays(spy, 31_000);
    expect(delay).toBeGreaterThan(28_000);
    expect(delay).toBeLessThanOrEqual(30_000);
  });
});
