import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const SLOTS_RESPONSE = {
  agents: ['agt_1'],
  slots: [
    { start: '2026-04-15T09:00:00Z', end: '2026-04-15T09:30:00Z' },
    { start: '2026-04-15T10:00:00Z', end: '2026-04-15T10:30:00Z' },
  ],
};

describe('AvailabilityClient', () => {
  it('forAgent', async () => {
    const fetch = mockFetch([{ status: 200, body: SLOTS_RESPONSE }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.availability.forAgent('agt_1', {
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
    });
    expect(result.slots).toHaveLength(2);
    expect(fetch.mock.calls[0][0]).toContain('/v1/agents/agt_1/availability');
  });

  it('forAgent passes slot_duration and include_busy', async () => {
    const fetch = mockFetch([{ status: 200, body: SLOTS_RESPONSE }]);
    const client = new Chronary(clientConfig(fetch));

    await client.availability.forAgent('agt_1', {
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
      slot_duration: '1h',
      include_busy: true,
    });
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('slot_duration=1h');
    expect(url).toContain('include_busy=true');
  });

  it('forCalendar', async () => {
    const fetch = mockFetch([{ status: 200, body: SLOTS_RESPONSE }]);
    const client = new Chronary(clientConfig(fetch));

    await client.availability.forCalendar('cal_1', {
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
    });
    expect(fetch.mock.calls[0][0]).toContain('/v1/calendars/cal_1/availability');
  });

  it('check (cross-agent)', async () => {
    const multiResponse = { ...SLOTS_RESPONSE, agents: ['agt_1', 'agt_2'] };
    const fetch = mockFetch([{ status: 200, body: multiResponse }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.availability.check({
      agents: ['agt_1', 'agt_2'],
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
      slot_duration: '30m',
    });
    expect(result.agents).toEqual(['agt_1', 'agt_2']);
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('/v1/availability');
    expect(url).toContain('agents=agt_1%2Cagt_2');
  });
});
