import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const EVENT = {
  id: 'evt_abc123',
  calendarId: 'cal_abc123',
  orgId: 'org-1',
  title: 'Stand-up',
  description: null,
  startTime: '2026-04-15T09:00:00Z',
  endTime: '2026-04-15T09:30:00Z',
  allDay: false,
  status: 'confirmed',
  source: 'internal',
  metadata: {},
  deletedAt: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

describe('EventsClient', () => {
  it('create', async () => {
    const fetch = mockFetch([{ status: 201, body: EVENT }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.create('cal_abc123', {
      title: 'Stand-up',
      start_time: '2026-04-15T09:00:00Z',
      end_time: '2026-04-15T09:30:00Z',
    });
    expect(result.id).toBe('evt_abc123');
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/events');
  });

  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: EVENT }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.get('cal_abc123', 'evt_abc123');
    expect(result.title).toBe('Stand-up');
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/events/evt_abc123');
  });

  it('list by calendarId', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [EVENT], total: 1, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const items = [];
    for await (const e of client.events.list({ calendarId: 'cal_abc123' })) {
      items.push(e);
    }
    expect(items).toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/events');
  });

  it('list by agentId uses agent-scoped route', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.events.list({ agentId: 'agt_abc123' })) { /* consume */ }
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123/events');
  });

  it('list passes filter params', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.events.list({
      calendarId: 'cal_1',
      start_after: '2026-04-01T00:00:00Z',
      status: 'confirmed',
    })) { /* consume */ }
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('start_after=');
    expect(url).toContain('status=confirmed');
  });

  it('list throws without calendarId or agentId', () => {
    const fetch = mockFetch([]);
    const client = new Chronary(clientConfig(fetch));

    expect(() => client.events.list({})).toThrow('Either calendarId or agentId is required');
  });

  it('update', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...EVENT, title: 'Renamed' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.update('cal_abc123', 'evt_abc123', { title: 'Renamed' });
    expect(result.title).toBe('Renamed');
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.events.delete('cal_abc123', 'evt_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/events/evt_abc123');
  });

  it('confirm', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...EVENT, status: 'confirmed' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.confirm('evt_abc123');
    expect(result.status).toBe('confirmed');
    expect(fetch.mock.calls[0][1]?.method).toBe('PUT');
    expect(fetch.mock.calls[0][0]).toContain('/v1/events/evt_abc123/confirm');
  });

  it('release', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...EVENT, status: 'cancelled' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.release('evt_abc123');
    expect(result.status).toBe('cancelled');
    expect(fetch.mock.calls[0][1]?.method).toBe('PUT');
    expect(fetch.mock.calls[0][0]).toContain('/v1/events/evt_abc123/release');
  });

  it('create hold passes hold_expires_at and hold_priority', async () => {
    const hold = {
      ...EVENT,
      status: 'hold',
      holdExpiresAt: '2099-01-01T10:05:00Z',
      holdPriority: 10,
    };
    const fetch = mockFetch([{ status: 201, body: hold }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.events.create('cal_abc123', {
      title: 'hold slot',
      start_time: '2099-01-01T10:00:00Z',
      end_time: '2099-01-01T10:30:00Z',
      status: 'hold',
      hold_expires_at: '2099-01-01T10:05:00Z',
      hold_priority: 10,
    });
    expect(result.status).toBe('hold');
    const body = JSON.parse(fetch.mock.calls[0][1]?.body as string);
    expect(body.hold_expires_at).toBe('2099-01-01T10:05:00Z');
    expect(body.hold_priority).toBe(10);
  });
});
