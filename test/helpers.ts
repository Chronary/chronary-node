import { vi } from 'vitest';
import type { ChronaryConfig } from '../src/types';

export function mockFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;
  const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(
      resp.body !== undefined ? JSON.stringify(resp.body) : null,
      {
        status: resp.status,
        headers: {
          'content-type': 'application/json',
          'x-request-id': `req_test${callIndex}`,
          ...(resp.headers ?? {}),
        },
      },
    );
  });
  return fn;
}

export function clientConfig(
  fetchFn: typeof fetch,
  overrides: Partial<ChronaryConfig> = {},
): ChronaryConfig {
  return {
    apiKey: 'chr_sk_live_test1234567890',
    baseUrl: 'https://api.test.chronary.ai',
    fetch: fetchFn,
    maxRetries: 0,
    timeout: 5000,
    ...overrides,
  };
}
