import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const CALENDAR = {
  id: 'cal_abc123',
  orgId: 'org-1',
  agentId: 'agt_abc123',
  name: 'Team Meetings',
  timezone: 'America/Los_Angeles',
  metadata: {},
  ical_url: 'https://api.chronary.ai/ical/token123.ics',
  deletedAt: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

describe('CalendarsClient', () => {
  it('create without agentId hits /v1/calendars', async () => {
    const fetch = mockFetch([{ status: 201, body: CALENDAR }]);
    const client = new Chronary(clientConfig(fetch));

    await client.calendars.create({ name: 'Team Meetings', timezone: 'America/Los_Angeles' });
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars');
    expect(fetch.mock.calls[0][0]).not.toContain('/agents/');
  });

  it('create with agentId hits /v1/agents/:id/calendars', async () => {
    const fetch = mockFetch([{ status: 201, body: CALENDAR }]);
    const client = new Chronary(clientConfig(fetch));

    await client.calendars.create({ name: 'Meetings', timezone: 'UTC', agentId: 'agt_abc123' });
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123/calendars');
  });

  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: CALENDAR }]);
    const client = new Chronary(clientConfig(fetch));

    const cal = await client.calendars.get('cal_abc123');
    expect(cal.id).toBe('cal_abc123');
  });

  it('list with agentId uses agent-scoped route', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [CALENDAR], total: 1, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.calendars.list({ agentId: 'agt_abc123' })) { /* consume */ }
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_abc123/calendars');
  });

  it('list without agentId uses /v1/calendars', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    for await (const _ of client.calendars.list()) { /* consume */ }
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars');
    expect(fetch.mock.calls[0][0]).not.toContain('/agents/');
  });

  it('update', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...CALENDAR, name: 'Renamed' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.calendars.update('cal_abc123', { name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });

  it('delete', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.calendars.delete('cal_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('getContext returns temporal snapshot', async () => {
    const fetch = mockFetch([
      {
        status: 200,
        body: {
          calendar_id: 'cal_abc123',
          now: '2026-04-16T12:00:00Z',
          agent_status: 'idle',
          current_event: null,
          next_event: null,
          recent_events: [],
          upcoming: [],
        },
      },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const ctx = await client.calendars.getContext('cal_abc123');
    expect(ctx.calendar_id).toBe('cal_abc123');
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/context');
  });

  it('setAvailabilityRules PUTs rules', async () => {
    const rules = {
      id: 'rul_1',
      calendar_id: 'cal_abc123',
      buffer_before_minutes: 10,
      buffer_after_minutes: 10,
      working_hours: null,
      timezone: 'UTC',
      created_at: '2026-04-16T12:00:00Z',
      updated_at: '2026-04-16T12:00:00Z',
    };
    const fetch = mockFetch([{ status: 200, body: rules }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.calendars.setAvailabilityRules('cal_abc123', {
      buffer_before_minutes: 10,
      buffer_after_minutes: 10,
    });
    expect(result.buffer_before_minutes).toBe(10);
    expect(fetch.mock.calls[0][1]?.method).toBe('PUT');
  });

  it('getAvailabilityRules fetches rules', async () => {
    const rules = {
      id: 'rul_1',
      calendar_id: 'cal_abc123',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      working_hours: null,
      timezone: 'UTC',
      created_at: '2026-04-16T12:00:00Z',
      updated_at: '2026-04-16T12:00:00Z',
    };
    const fetch = mockFetch([{ status: 200, body: rules }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.calendars.getAvailabilityRules('cal_abc123');
    expect(result.id).toBe('rul_1');
  });

  it('deleteAvailabilityRules DELETEs rules', async () => {
    const fetch = mockFetch([{ status: 204 }]);
    const client = new Chronary(clientConfig(fetch));

    await client.calendars.deleteAvailabilityRules('cal_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('DELETE');
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_abc123/availability-rules');
  });
});
