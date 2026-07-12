import { describe, expect, it } from 'vitest';
import { Chronary } from '../../src';
import { clientConfig, mockFetch } from '../helpers';

const LINK = { id: 'csl_1', calendar_id: 'cal_1', setup_url: 'https://api.test/setup', status: 'awaiting_human', expires_at: '2026-07-12T12:00:00Z' };

describe('ConnectionLinksClient', () => {
  it('creates, gets, and cancels setup links', async () => {
    const fetch = mockFetch([{ status: 201, body: LINK }, { status: 200, body: LINK }, { status: 204 }]);
    const client = new Chronary(clientConfig(fetch));
    expect((await client.connectionLinks.create('cal_1', { capabilities: ['availability'] })).id).toBe('csl_1');
    expect((await client.connectionLinks.get('csl_1')).status).toBe('awaiting_human');
    await client.connectionLinks.cancel('csl_1');
    expect(fetch.mock.calls.map((call) => call[1]?.method)).toEqual(['POST', 'GET', 'DELETE']);
  });
});
