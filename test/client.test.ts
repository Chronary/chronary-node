import { describe, it, expect, vi } from 'vitest';
import { CoreClient } from '../src/client';
import { AuthenticationError, RateLimitError, NotFoundError, ValidationError, ConnectionError, ChronaryError } from '../src/error';
import { mockFetch, clientConfig } from './helpers';

describe('CoreClient', () => {
  it('constructs without an API key (for unauthenticated endpoints like agentAuth.signUp)', () => {
    expect(() => new CoreClient({ apiKey: '' })).not.toThrow();
    expect(() => new CoreClient({})).not.toThrow();
  });

  it('omits the Authorization header when no API key is set', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient({
      apiKey: '',
      baseUrl: 'https://api.test.chronary.ai',
      fetch,
      maxRetries: 0,
    });

    await client.request('GET', '/v1/plans');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('makes GET requests with auth header', async () => {
    const fetch = mockFetch([{ status: 200, body: { id: 'agt_1' } }]);
    const client = new CoreClient(clientConfig(fetch));

    const result = await client.request('GET', '/v1/agents/agt_1');
    expect(result).toEqual({ id: 'agt_1' });
    expect(fetch).toHaveBeenCalledOnce();

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test.chronary.ai/v1/agents/agt_1');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toHaveProperty('Authorization', 'Bearer chr_sk_xxx1234567890');
  });

  it('sends SDK version header', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('GET', '/v1/test');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['X-Chronary-SDK-Version']).toBeDefined();
  });

  it('sets User-Agent to chronary-ts/<version> so the API can attribute traffic', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('GET', '/v1/test');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^chronary-ts\/\d+\.\d+\.\d+/);
  });

  it('merges extraHeaders into every request (used by chronary-mcp wrapper)', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient({
      ...clientConfig(fetch),
      extraHeaders: { 'X-Chronary-Client': 'chronary-mcp/0.1.1', 'X-Custom': 'custom-value' },
    });

    await client.request('GET', '/v1/test');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['X-Chronary-Client']).toBe('chronary-mcp/0.1.1');
    expect(headers['X-Custom']).toBe('custom-value');
    // SDK defaults still present
    expect(headers['User-Agent']).toMatch(/^chronary-ts\//);
    expect(headers['X-Chronary-SDK-Version']).toBeDefined();
  });

  it('sends POST with JSON body', async () => {
    const fetch = mockFetch([{ status: 201, body: { id: 'agt_2' } }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('POST', '/v1/agents', { name: 'Bot', type: 'ai' });
    const init = fetch.mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Bot', type: 'ai' });
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('adds idempotency key on mutating requests', async () => {
    const fetch = mockFetch([{ status: 201, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('POST', '/v1/agents', { name: 'Bot' });
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeDefined();
  });

  it('uses custom idempotency key when provided', async () => {
    const fetch = mockFetch([{ status: 201, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('POST', '/v1/agents', { name: 'Bot' }, undefined, { idempotencyKey: 'my-key-123' });
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('my-key-123');
  });

  it('passes caller abort signal to fetch and reports caller aborts distinctly', async () => {
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })) as unknown as typeof globalThis.fetch;
    const controller = new AbortController();
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 0 });

    const promise = client.request('GET', '/v1/agents', undefined, undefined, { signal: controller.signal });
    await Promise.resolve();
    controller.abort();

    await expect(promise).rejects.toThrow(ChronaryError);
    expect(fetch).toHaveBeenCalledOnce();
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not add idempotency key on GET', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('GET', '/v1/agents');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });

  it('builds query string from params', async () => {
    const fetch = mockFetch([{ status: 200, body: { data: [], total: 0 } }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('GET', '/v1/agents', undefined, { type: 'ai', limit: 10, offset: 0 });
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('type=ai');
    expect(url).toContain('limit=10');
  });

  it('omits undefined query params', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    await client.request('GET', '/v1/agents', undefined, { type: undefined, limit: 10 });
    const url = fetch.mock.calls[0][0] as string;
    expect(url).not.toContain('type');
    expect(url).toContain('limit=10');
  });

  it('returns undefined for 204 responses', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new CoreClient(clientConfig(fetch));

    const result = await client.request('DELETE', '/v1/agents/agt_1');
    expect(result).toBeUndefined();
  });

  it('throws NotFoundError on 404', async () => {
    const fetch = mockFetch([{
      status: 404,
      body: { error: { type: 'not_found', message: 'Agent not found', request_id: 'req_abc' } },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    await expect(client.request('GET', '/v1/agents/agt_nope')).rejects.toThrow(NotFoundError);
  });

  it('throws AuthenticationError on 401', async () => {
    const fetch = mockFetch([{
      status: 401,
      body: { error: { type: 'authentication_error', message: 'Invalid API key', request_id: 'req_abc' } },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    await expect(client.request('GET', '/v1/agents')).rejects.toThrow(AuthenticationError);
  });

  it('throws ValidationError on API validation_error 400', async () => {
    const fetch = mockFetch([{
      status: 400,
      body: { error: { type: 'validation_error', message: 'Invalid field', request_id: 'req_abc' } },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    await expect(client.request('POST', '/v1/agents', { name: '' })).rejects.toThrow(ValidationError);
  });

  it('throws RateLimitError on 429 with retry-after', async () => {
    const fetch = mockFetch([{
      status: 429,
      body: { error: { type: 'rate_limit_error', message: 'Too many requests', request_id: 'req_abc' } },
      headers: { 'retry-after': '2' },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    try {
      await client.request('GET', '/v1/agents');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(2);
    }
  });

  it('includes requestId on errors from header', async () => {
    const fetch = mockFetch([{
      status: 404,
      body: { error: { type: 'not_found', message: 'Not found', request_id: 'req_xyz123' } },
      headers: { 'x-request-id': 'req_from_header' },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    try {
      await client.request('GET', '/v1/agents/agt_1');
      expect.unreachable();
    } catch (err) {
      expect((err as NotFoundError).requestId).toBe('req_from_header');
    }
  });

  it('retries on 500 errors', async () => {
    const fetch = mockFetch([
      { status: 500, body: { error: { type: 'internal', message: 'Server error', request_id: 'req_1' } } },
      { status: 200, body: { id: 'agt_1' } },
    ]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 1 });

    const result = await client.request<{ id: string }>('GET', '/v1/agents/agt_1');
    expect(result.id).toBe('agt_1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 then succeeds', async () => {
    const fetch = mockFetch([
      { status: 429, body: { error: { type: 'rate_limit_error', message: 'Slow down', request_id: 'req_1' } }, headers: { 'retry-after': '0' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new CoreClient({ ...clientConfig(fetch), maxRetries: 1 });

    const result = await client.request<{ ok: boolean }>('GET', '/v1/test');
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws ConnectionError on network failure after retries', async () => {
    const fetch = vi.fn(async () => { throw new Error('network down'); });
    const client = new CoreClient({ ...clientConfig(fetch as unknown as typeof globalThis.fetch), maxRetries: 1 });

    await expect(client.request('GET', '/v1/agents')).rejects.toThrow(ConnectionError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('respects custom baseUrl', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient({
      apiKey: 'chr_sk_xxx',
      baseUrl: 'https://custom.api.com/api',
      fetch,
      maxRetries: 0,
    });

    await client.request('GET', '/v1/agents');
    expect(fetch.mock.calls[0][0]).toBe('https://custom.api.com/api/v1/agents');
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient({
      apiKey: 'chr_sk_xxx',
      baseUrl: 'https://api.chronary.ai/',
      fetch,
      maxRetries: 0,
    });

    await client.request('GET', '/v1/agents');
    expect(fetch.mock.calls[0][0]).toBe('https://api.chronary.ai/v1/agents');
  });
});
