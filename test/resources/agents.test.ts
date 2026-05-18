import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const AGENT = {
  id: 'agt_abc123',
  orgId: 'org-1',
  name: 'Sales Bot',
  type: 'ai',
  description: null,
  status: 'active',
  metadata: {},
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

describe('AgentsClient', () => {
  it('create', async () => {
    const fetch = mockFetch([{ status: 201, body: AGENT }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.agents.create({ name: 'Sales Bot', type: 'ai' });
    expect(result).toEqual(AGENT);
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  });

  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: AGENT }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.agents.get('agt_abc123');
    expect(result.id).toBe('agt_abc123');
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123');
  });

  it('list iterates pages', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [AGENT], total: 1, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const items = [];
    for await (const agent of client.agents.list()) {
      items.push(agent);
    }
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('agt_abc123');
  });

  it('list passes filter params', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [], total: 0, limit: 10, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.agents.list({ type: 'ai', status: 'active', limit: 10 })) {
      // consume
    }
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('type=ai');
    expect(url).toContain('status=active');
    expect(url).toContain('limit=10');
  });

  it('list starts iteration at the supplied offset', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [AGENT], total: 11, limit: 10, offset: 10 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.agents.list({ limit: 10, offset: 10 })) {
      // consume
    }

    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=10');
  });

  it('list getPage', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [AGENT], total: 3, limit: 1, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const page = await client.agents.list({ limit: 1 }).getPage();
    expect(page.data).toHaveLength(1);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);
  });

  it('update', async () => {
    const updated = { ...AGENT, name: 'Updated Bot' };
    const fetch = mockFetch([{ status: 200, body: updated }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.agents.update('agt_abc123', { name: 'Updated Bot' });
    expect(result.name).toBe('Updated Bot');
    expect(fetch.mock.calls[0][1]?.method).toBe('PATCH');
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.agents.delete('agt_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
  });
});
