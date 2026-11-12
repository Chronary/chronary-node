import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const USAGE = {
  period_start: '2026-04-01T00:00:00.000Z',
  period_end: '2026-04-30T23:59:59.000Z',
  plan: 'free',
  agents: { used: 2, limit: 5 },
  calendars: { used: 3, limit: 10 },
  events: { used: 100, limit: 5000 },
  api_calls: { used: 500, limit: 50000 },
  webhooks: { used: 10, limit: 10000 },
  availability_queries: { used: 5, limit: 10000 },
  ical_subscriptions: { used: 1, limit: 3 },
  proposals: { used: 18, limit: 500 },
  recurring_events: { used: 2, limit: 5 },
};

describe('UsageClient', () => {
  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: USAGE }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.usage.get();
    expect(result.plan).toBe('free');
    expect(result.agents.used).toBe(2);
    expect(result.agents.limit).toBe(5);
    expect(result.proposals.used).toBe(18);
    expect(result.proposals.limit).toBe(500);
    expect(result.recurring_events.used).toBe(2);
    expect(result.recurring_events.limit).toBe(5);
    expect(fetch.mock.calls[0][0]).toContain('/v1/usage');
  });

  it('history sends the months query and defaults to none', async () => {
    const body = { plan: 'free', months: 3, limits: {}, data: [] };
    const fetch = mockFetch([
      { status: 200, body },
      { status: 200, body },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.usage.history({ months: 3 });
    expect(result.months).toBe(3);
    expect(fetch.mock.calls[0][0]).toContain('/v1/usage/history?months=3');

    await client.usage.history();
    expect(fetch.mock.calls[1][0]).toContain('/v1/usage/history');
    expect(fetch.mock.calls[1][0]).not.toContain('months=');
  });
});
