import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

// bughunt-BH-056 (#2557): an empty `calendars` array must be omitted, not sent as `calendars=`
// (which the API's CrossAgentAvailabilityQuerySchema rejects with 400: "calendars must not
// include empty ids"). This test lives in the public SDK mirror, so it checks the URL only and
// does not import the API's schema from outside the package.
describe('bughunt-BH-056 availability.check with calendars: []', () => {
  it('omits the calendars query param', async () => {
    const fetch = mockFetch([{ status: 200, body: { agents: ['agt_1'], slots: [] } }]);
    const client = new Chronary(clientConfig(fetch));
    await client.availability.check({
      agents: ['agt_1'],
      start: '2026-12-01T00:00:00Z',
      end: '2026-12-02T00:00:00Z',
      calendars: [],
    });
    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.search).not.toMatch(/calendars=/);
    expect(url.searchParams.has('calendars')).toBe(false);
  });

  it('still sends a non-empty calendars list', async () => {
    const fetch = mockFetch([{ status: 200, body: { agents: ['agt_1'], slots: [] } }]);
    const client = new Chronary(clientConfig(fetch));
    await client.availability.check({
      agents: ['agt_1'],
      start: '2026-12-01T00:00:00Z',
      end: '2026-12-02T00:00:00Z',
      calendars: ['cal_1', 'cal_2'],
    });
    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.searchParams.get('calendars')).toBe('cal_1,cal_2');
  });
});
