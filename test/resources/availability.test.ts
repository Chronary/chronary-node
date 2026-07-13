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
      allow_stale: true,
    });
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('slot_duration=1h');
    expect(url).toContain('include_busy=true');
    expect(url).toContain('allow_stale=true');
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

  it('check with duration sends duration and not slot_duration', async () => {
    const multiResponse = { ...SLOTS_RESPONSE, agents: ['agt_1', 'agt_2'] };
    const fetch = mockFetch([{ status: 200, body: multiResponse }]);
    const client = new Chronary(clientConfig(fetch));

    await client.availability.check({
      agents: ['agt_1', 'agt_2'],
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
      duration: '45m',
    });
    const url = fetch.mock.calls[0][0] as string;
    const query = new URL(url).searchParams;
    // Preferred param `duration` is forwarded verbatim.
    expect(query.get('duration')).toBe('45m');
    // The user set only `duration`, so `slot_duration` must NOT be sent —
    // sending both with the same value is fine, but sending both risks a
    // false 400 conflict, so the SDK forwards only what the user set.
    expect(query.has('slot_duration')).toBe(false);
    expect(url).toContain('agents=agt_1%2Cagt_2');
  });

  it('check with the deprecated slot_duration still sends slot_duration and not duration', async () => {
    const multiResponse = { ...SLOTS_RESPONSE, agents: ['agt_1', 'agt_2'] };
    const fetch = mockFetch([{ status: 200, body: multiResponse }]);
    const client = new Chronary(clientConfig(fetch));

    await client.availability.check({
      agents: ['agt_1', 'agt_2'],
      start: '2026-04-15T09:00:00Z',
      end: '2026-04-15T17:00:00Z',
      slot_duration: '1h',
    });
    const url = fetch.mock.calls[0][0] as string;
    const query = new URL(url).searchParams;
    // Deprecated alias still works and is passed through as-is.
    expect(query.get('slot_duration')).toBe('1h');
    // The user did not set `duration`, so it must NOT be forwarded.
    expect(query.has('duration')).toBe(false);
    expect(url).toContain('agents=agt_1%2Cagt_2');
  });
});
