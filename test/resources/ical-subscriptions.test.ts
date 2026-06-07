import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const SUBSCRIPTION = {
  id: 'ics_abc123',
  agent_id: 'agt_abc123',
  calendar_id: 'cal_abc123',
  url: 'https://example.com/feed.ics',
  label: 'External Feed',
  status: 'active',
  last_synced_at: '2026-04-10T12:00:00Z',
  last_error: null,
  created_at: '2026-04-01T00:00:00Z',
};

describe('ICalSubscriptionsClient', () => {
  it('create', async () => {
    const fetch = mockFetch([{ status: 201, body: SUBSCRIPTION }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.icalSubscriptions.create('agt_abc123', {
      calendar_id: 'cal_abc123',
      url: 'https://example.com/feed.ics',
      label: 'External Feed',
    });
    expect(result.id).toBe('ics_abc123');
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123/ical-subscriptions');
  });

  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: SUBSCRIPTION }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.icalSubscriptions.get('ics_abc123');
    expect(result.label).toBe('External Feed');
    expect(fetch.mock.calls[0][0]).toContain('/v1/ical-subscriptions/ics_abc123');
  });

  it('list', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [SUBSCRIPTION], total: 1, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const items = [];
    for await (const sub of client.icalSubscriptions.list({ agentId: 'agt_abc123' })) {
      items.push(sub);
    }
    expect(items).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123/ical-subscriptions');
  });

  it('list with status filter', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.icalSubscriptions.list({ agentId: 'agt_1', status: 'error' })) { /* consume */ }
    expect(fetch.mock.calls[0][0]).toContain('status=error');
  });

  it('update', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...SUBSCRIPTION, label: 'Renamed' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.icalSubscriptions.update('ics_abc123', { label: 'Renamed' });
    expect(result.label).toBe('Renamed');
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.icalSubscriptions.delete('ics_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('sync', async () => {
    const fetch = mockFetch([{ status: 202, body: { status: 'syncing' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.icalSubscriptions.sync('ics_abc123');
    expect(result.status).toBe('syncing');
    expect(fetch.mock.calls[0][0]).toContain('/v1/ical-subscriptions/ics_abc123/sync');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  });
});
