import { describe, it, expect, expectTypeOf } from 'vitest';
import { APIPromise, Chronary } from '../../src/index';
import type { Agent, ScopedApiKey } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

// #2002: resource methods return an APIPromise, so `.withResponse()` works on
// them as documented, not only on `CoreClient.request()`.

const QUOTA_HEADERS = {
  'x-request-id': 'req_with_response',
  'RateLimit-Policy': '"quota";q=1000;w=2592000;pk=org_abc',
  'RateLimit': '"quota";r=990;t=3600',
};

const AGENT = { id: 'agt_1', name: 'Bot' };

describe('resource methods support withResponse()', () => {
  it('agents.get returns data plus status, headers and quota', async () => {
    const fetch = mockFetch([{ status: 200, body: AGENT, headers: QUOTA_HEADERS }]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.agents.get('agt_1').withResponse();

    expect(data).toEqual(AGENT);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_with_response');
    expect(response.quota?.limit).toBe(1000);
    expect(response.quota?.remaining).toBe(990);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a plain await still resolves to the data alone', async () => {
    const fetch = mockFetch([{ status: 200, body: AGENT }]);
    const client = new Chronary(clientConfig(fetch));

    const agent = await client.agents.get('agt_1');
    expect(agent).toEqual(AGENT);
  });

  it('events.create (POST) exposes the 201 response', async () => {
    const event = { id: 'evt_1', title: 'Sync' };
    const fetch = mockFetch([{ status: 201, body: event, headers: QUOTA_HEADERS }]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.events
      .create('cal_1', { title: 'Sync', start_time: '2026-11-12T10:00:00Z', end_time: '2026-11-12T11:00:00Z' })
      .withResponse();

    expect(data).toEqual(event);
    expect(response.status).toBe(201);
    expect(response.quota?.remaining).toBe(990);
  });

  it('usage.get exposes the quota headers alongside the body', async () => {
    const fetch = mockFetch([{ status: 200, body: { plan: 'free' }, headers: QUOTA_HEADERS }]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.usage.get().withResponse();
    expect(data.plan).toBe('free');
    expect(response.headers.get('ratelimit')).toContain('r=990');
  });

  it('nested resources (billing.upgradeRequests.create) support it too', async () => {
    const request = { id: 'upr_1', status: 'pending' };
    const fetch = mockFetch([{ status: 201, body: request, headers: QUOTA_HEADERS }]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.billing.upgradeRequests.create().withResponse();
    expect(data).toEqual(request);
    expect(response.status).toBe(201);
  });

  it('keys.list keeps the response while unwrapping the keys array', async () => {
    const keys = [{ id: 'key_1' }, { id: 'key_2' }];
    const fetch = mockFetch([{ status: 200, body: { keys }, headers: QUOTA_HEADERS }]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.keys.list().withResponse();
    expect(data).toEqual(keys);
    expect(response.headers.get('x-request-id')).toBe('req_with_response');
  });

  it('delete methods resolve to undefined and still expose the response', async () => {
    const fetch = mockFetch([
      { status: 204, headers: QUOTA_HEADERS },
      { status: 200, body: { deleted: true } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const { data, response } = await client.agents.delete('agt_1').withResponse();
    expect(data).toBeUndefined();
    expect(response.status).toBe(204);

    // A body on a delete is still discarded, as before.
    expect(await client.webhooks.delete('wh_1')).toBeUndefined();
  });

  it('rejects withResponse() with the typed error', async () => {
    const fetch = mockFetch([{
      status: 404,
      body: { error: { type: 'not_found', message: 'Agent not found' } },
    }]);
    const client = new Chronary(clientConfig(fetch));

    await expect(client.agents.get('agt_missing').withResponse()).rejects.toThrow('Agent not found');
  });

  it('returns an APIPromise that is also a Promise', () => {
    const fetch = mockFetch([{ status: 200, body: AGENT }, { status: 200, body: { keys: [] } }]);
    const client = new Chronary(clientConfig(fetch));

    const agent = client.agents.get('agt_1');
    expect(agent).toBeInstanceOf(APIPromise);
    expect(agent).toBeInstanceOf(Promise);
    expectTypeOf(agent).toEqualTypeOf<APIPromise<Agent>>();
    expectTypeOf(agent).toMatchTypeOf<Promise<Agent>>();
    expectTypeOf(client.keys.list()).toEqualTypeOf<APIPromise<ScopedApiKey[]>>();
    return Promise.all([agent, client.keys.list()]);
  });
});
