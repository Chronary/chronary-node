import { describe, expect, it } from 'vitest';
import { Chronary } from '../../src/index';
import { clientConfig, mockFetch } from '../helpers';

const CREATED_KEY = {
  id: 'key_1',
  key: 'chr_ak_live_SECRET',
  mode: 'live',
  key_prefix: 'chr_ak_live_ABCD1234',
  agent_id: 'agt_1',
  label: 'Customer A',
  created_at: '2026-04-17T16:20:00.000Z',
};

const LIST_KEY = {
  id: 'key_2',
  mode: 'test',
  key_prefix: 'chr_ak_test_DCBA4321',
  agent_id: 'agt_2',
  label: null,
  created_at: '2026-04-17T16:25:00.000Z',
};

describe('KeysClient', () => {
  it('create', async () => {
    const fetch = mockFetch([{ status: 201, body: CREATED_KEY }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.keys.create({
      agent_id: 'agt_1',
      mode: 'live',
      label: 'Customer A',
    });

    expect(result).toEqual(CREATED_KEY);
    expect(fetch.mock.calls[0][0]).toContain('/v1/keys');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  });

  it('list unwraps keys', async () => {
    const fetch = mockFetch([{ status: 200, body: { keys: [LIST_KEY] } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.keys.list();

    expect(result).toEqual([LIST_KEY]);
    expect(fetch.mock.calls[0][0]).toContain('/v1/keys');
    expect(fetch.mock.calls[0][1]?.method).toBe('GET');
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.keys.delete('key_1');

    expect(fetch.mock.calls[0][0]).toContain('/v1/keys/key_1');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
  });
});
