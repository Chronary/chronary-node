import { describe, it, expect } from 'vitest';
import { CoreClient } from '../src/client';
import { APIPromise } from '../src/api-promise';
import { mockFetch, clientConfig } from './helpers';
import { expectLinearTime } from './linear-time';

describe('APIPromise', () => {
  it('resolves to parsed data when awaited directly', async () => {
    const fetch = mockFetch([{ status: 200, body: { id: 'agt_1', name: 'Bot' } }]);
    const client = new CoreClient(clientConfig(fetch));

    const agent = await client.request<{ id: string; name: string }>('GET', '/v1/agents/agt_1');
    expect(agent).toEqual({ id: 'agt_1', name: 'Bot' });
  });

  it('returns data and response via withResponse()', async () => {
    const fetch = mockFetch([{
      status: 201,
      body: { id: 'agt_2', name: 'New Bot' },
      headers: { 'x-request-id': 'req_abc123' },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    const { data, response } = await client.request<{ id: string; name: string }>(
      'POST', '/v1/agents', { name: 'New Bot', type: 'ai' },
    ).withResponse();

    expect(data).toEqual({ id: 'agt_2', name: 'New Bot' });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toBe('req_abc123');
  });

  it('exposes response headers for rate limit inspection', async () => {
    const fetch = mockFetch([{
      status: 200,
      body: { data: [] },
      headers: {
        'x-ratelimit-remaining': '98',
        'x-ratelimit-limit': '100',
      },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    const { response } = await client.request('GET', '/v1/agents').withResponse();
    expect(response.headers.get('x-ratelimit-remaining')).toBe('98');
    expect(response.headers.get('x-ratelimit-limit')).toBe('100');
  });

  it('works with 204 No Content responses', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new CoreClient(clientConfig(fetch));

    const { data, response } = await client.request('DELETE', '/v1/agents/agt_1').withResponse();
    expect(data).toBeUndefined();
    expect(response.status).toBe(204);
  });

  it('is a proper thenable (works with Promise.all)', async () => {
    const fetch = mockFetch([
      { status: 200, body: { id: 'agt_1' } },
      { status: 200, body: { id: 'agt_2' } },
    ]);
    const client = new CoreClient(clientConfig(fetch));

    const [a1, a2] = await Promise.all([
      client.request<{ id: string }>('GET', '/v1/agents/agt_1'),
      client.request<{ id: string }>('GET', '/v1/agents/agt_2'),
    ]);
    expect(a1.id).toBe('agt_1');
    expect(a2.id).toBe('agt_2');
  });

  it('propagates errors when awaited directly', async () => {
    const fetch = mockFetch([{
      status: 404,
      body: { error: { type: 'not_found', message: 'Not found', request_id: 'req_1' } },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    await expect(
      client.request('GET', '/v1/agents/nope'),
    ).rejects.toThrow('Not found');
  });

  it('propagates errors via withResponse()', async () => {
    const fetch = mockFetch([{
      status: 404,
      body: { error: { type: 'not_found', message: 'Not found', request_id: 'req_2' } },
    }]);
    const client = new CoreClient(clientConfig(fetch));

    await expect(
      client.request('GET', '/v1/agents/nope').withResponse(),
    ).rejects.toThrow('Not found');
  });

  it('has withResponse method', () => {
    const fetch = mockFetch([{ status: 200, body: {} }]);
    const client = new CoreClient(clientConfig(fetch));

    const result = client.request('GET', '/v1/test');
    expect(result).toBeInstanceOf(APIPromise);
    expect(typeof result.withResponse).toBe('function');
    expect(typeof result.then).toBe('function');
    expect(typeof result.catch).toBe('function');
    expect(typeof result.finally).toBe('function');
  });

  describe('typed quota snapshot (RawResponse.quota)', () => {
    it('parses IETF RateLimit + RateLimit-Policy headers into quota snapshot', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { data: [] },
        headers: {
          'RateLimit-Policy': '"quota";q=1000000;w=2592000;pk=org_abc',
          'RateLimit': '"quota";r=985477;t=187200',
        },
      }]);
      const client = new CoreClient(clientConfig(fetch));

      const before = Date.now();
      const { response } = await client.request('GET', '/v1/agents').withResponse();
      const after = Date.now();

      expect(response.quota).toBeDefined();
      expect(response.quota?.limit).toBe(1_000_000);
      expect(response.quota?.remaining).toBe(985_477);
      // resetAt is now + 187200 seconds (well within a tight clock skew band).
      const expectedReset = before + 187_200 * 1000;
      expect(response.quota?.resetAt.getTime()).toBeGreaterThanOrEqual(expectedReset);
      expect(response.quota?.resetAt.getTime()).toBeLessThanOrEqual(after + 187_200 * 1000);
    });

    it('omits quota snapshot when RateLimit headers are absent (public endpoints)', async () => {
      const fetch = mockFetch([{ status: 200, body: { plans: [] } }]);
      const client = new CoreClient(clientConfig(fetch));

      const { response } = await client.request('GET', '/v1/plans').withResponse();
      expect(response.quota).toBeUndefined();
    });

    it('omits quota snapshot when only RateLimit is present without RateLimit-Policy', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { data: [] },
        headers: { 'RateLimit': '"quota";r=100;t=60' },
      }]);
      const client = new CoreClient(clientConfig(fetch));

      const { response } = await client.request('GET', '/v1/agents').withResponse();
      expect(response.quota).toBeUndefined();
    });

    it('omits quota snapshot when structured params are unparseable', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { data: [] },
        headers: {
          'RateLimit-Policy': 'malformed-without-q',
          'RateLimit': '"quota";r=10;t=60',
        },
      }]);
      const client = new CoreClient(clientConfig(fetch));

      const { response } = await client.request('GET', '/v1/agents').withResponse();
      expect(response.quota).toBeUndefined();
    });

    it('exposes raw RateLimit header strings as a fallback', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { data: [] },
        headers: {
          'RateLimit-Policy': '"quota";q=500;w=86400;pk=org_x',
          'RateLimit': '"quota";r=499;t=3600',
        },
      }]);
      const client = new CoreClient(clientConfig(fetch));

      const { response } = await client.request('GET', '/v1/agents').withResponse();
      expect(response.headers.get('ratelimit')).toContain('r=499');
      expect(response.headers.get('ratelimit-policy')).toContain('q=500');
    });

    async function quotaFor(rateLimit: string, policy: string) {
      const fetch = mockFetch([{
        status: 200,
        body: { data: [] },
        headers: { 'RateLimit-Policy': policy, 'RateLimit': rateLimit },
      }]);
      const client = new CoreClient(clientConfig(fetch));
      const { response } = await client.request('GET', '/v1/agents').withResponse();
      return response.quota;
    }

    it('allows whitespace before a parameter and reads the first well-formed match', async () => {
      const quota = await quotaFor('"quota";  r=7;r=9;t=60', '"quota"; q=x; q=100;w=60');
      expect(quota?.remaining).toBe(7);
      expect(quota?.limit).toBe(100);
    });

    it('accepts a negative value and a parameter at the start of the header', async () => {
      const quota = await quotaFor('r=-1;t=0', 'q=5');
      expect(quota?.remaining).toBe(-1);
      expect(quota?.limit).toBe(5);
    });

    it.each([
      ['a value with trailing junk', '"quota";r=10x;t=60'],
      ['an empty value', '"quota";r=;t=60'],
      ['a bare minus sign', '"quota";r=-;t=60'],
      ['a key that only ends with the name', '"quota";xr=10;t=60'],
      ['whitespace after the value', '"quota";r=10 ;t=60'],
    ])('omits the quota snapshot for %s', async (_label, rateLimit) => {
      expect(await quotaFor(rateLimit, '"quota";q=100')).toBeUndefined();
    });

    it('omits the quota snapshot when a value overflows to Infinity', async () => {
      expect(await quotaFor(`"quota";r=${'9'.repeat(400)};t=60`, '"quota";q=100')).toBeUndefined();
    });

    it.each([
      ['a long whitespace run', (n: number) => `"quota";${' '.repeat(n)}x`],
      ['a long digit run', (n: number) => `"quota";r=${'1'.repeat(n)}x`],
      ['separators then whitespace', (n: number) => `${';'.repeat(n / 2)}${' '.repeat(n / 2)}x`],
      ['repeated empty members', (n: number) => `${'; r='.repeat(n / 4)}x`],
    ])('parses a RateLimit header with %s in linear time', async (_label, makeHeader) => {
      // The snapshot is parsed while the request resolves.
      const parse = async (header: string) => {
        expect(await quotaFor(header, header)).toBeUndefined();
      };
      await expectLinearTime(makeHeader, parse, 12_500);
    }, 20_000);
  });
});
