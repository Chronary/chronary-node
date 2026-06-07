import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const WEBHOOK = {
  id: 'whk_abc123',
  orgId: 'org-1',
  url: 'https://example.com/webhook',
  events: ['event.created', 'event.updated'],
  active: true,
  consecutiveFailures: 0,
  firstFailureAt: null,
  createdAt: '2026-04-01T00:00:00Z',
};

describe('WebhooksClient', () => {
  it('create returns webhook with secret', async () => {
    const withSecret = { ...WEBHOOK, secret: 'whsec_abc123' };
    const fetch = mockFetch([{ status: 201, body: withSecret }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.create({
      url: 'https://example.com/webhook',
      events: ['event.created', 'event.updated'],
    });
    expect(result.id).toBe('whk_abc123');
    expect(result.secret).toBe('whsec_abc123');
  });

  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: WEBHOOK }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.get('whk_abc123');
    expect(result.id).toBe('whk_abc123');
    expect(result.secret).toBeUndefined();
    expect(result.consecutiveFailures).toBe(0);
    expect(result.firstFailureAt).toBeNull();
  });

  it('list', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [WEBHOOK], total: 1, limit: 20, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const items = [];
    for await (const w of client.webhooks.list()) {
      items.push(w);
    }
    expect(items).toHaveLength(1);
  });

  it('update', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...WEBHOOK, active: false } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.update('whk_abc123', { active: false });
    expect(result.active).toBe(false);
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.webhooks.delete('whk_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
  });
});
