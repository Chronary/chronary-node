import { describe, it, expect } from 'vitest';
import { Chronary, ValidationError } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

// #2519: a caller-supplied ID used to be interpolated raw into the URL path,
// so `../agents/agt_1` turned events.deleteById into DELETE /v1/agents/agt_1
// (fetch resolves dot segments, `%2e%2e` included, before sending), `#`
// dropped the rest of the path and `?` smuggled a query string. Every ID now
// goes through encodePathSegment: one encoded segment, and "", "." and ".."
// are refused before any request is sent.

/** The path fetch would put on the wire (WHATWG URL resolves dot segments). */
const wirePath = (call: unknown[]) => new Request(String(call[0])).url.replace('https://api.test.chronary.ai', '');

function setup(status = 200, body: unknown = { id: 'x' }) {
  const fetch = mockFetch([{ status, body }]);
  const client = new Chronary(clientConfig(fetch));
  return { fetch, client };
}

describe('path params stay inside their resource (#2519)', () => {
  it('events.deleteById("../agents/agt_1") does not DELETE /v1/agents/agt_1', async () => {
    const { fetch, client } = setup(204, undefined);
    await client.events.deleteById('../agents/agt_1').catch(() => undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(wirePath(fetch.mock.calls[0])).toBe('/v1/events/..%2Fagents%2Fagt_1');
  });

  it('events.getById("../keys") and "%2e%2e/keys" do not GET /v1/keys', async () => {
    for (const id of ['../keys', '%2e%2e/keys']) {
      const { fetch, client } = setup();
      await client.events.getById(id).catch(() => undefined);
      expect(wirePath(fetch.mock.calls[0])).toMatch(/^\/v1\/events\/[^/]+$/);
    }
  });

  it('events.delete(calendarId "../webhooks/whk_1#") does not DELETE /v1/webhooks/whk_1', async () => {
    const { fetch, client } = setup(204, undefined);
    await client.events.delete('../webhooks/whk_1#', 'evt_x').catch(() => undefined);
    expect(wirePath(fetch.mock.calls[0])).toBe('/v1/calendars/..%2Fwebhooks%2Fwhk_1%23/events/evt_x');
  });

  it('webhooks.delete("../agents/agt_1") does not DELETE /v1/agents/agt_1', async () => {
    const { fetch, client } = setup(204, undefined);
    await client.webhooks.delete('../agents/agt_1').catch(() => undefined);
    expect(wirePath(fetch.mock.calls[0])).toMatch(/^\/v1\/webhooks\/[^/]+$/);
  });

  it('an ID cannot smuggle a query string', async () => {
    const { fetch, client } = setup();
    await client.events.getById('evt_1?expand=all');
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/v1/events/evt_1%3Fexpand%3Dall');
  });

  it.each(['', '.', '..'])('refuses the ID %j before sending and rejects the promise', async (id) => {
    const { fetch, client } = setup();
    const err = await client.events.deleteById(id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errorType).toBe('validation_error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a dot segment in the second parameter too', async () => {
    const { fetch, client } = setup();
    await expect(client.events.get('cal_1', '..')).rejects.toBeInstanceOf(ValidationError);
    await expect(client.webhooks.getDelivery('whk_1', '.')).rejects.toBeInstanceOf(ValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a dot segment in a paginated list on the first page fetch', async () => {
    const { fetch, client } = setup(200, { data: [], has_more: false });
    await expect(client.events.list({ agentId: '..' }).getPage()).rejects.toBeInstanceOf(ValidationError);
    await expect(client.calendars.list({ agentId: '.' }).getPage()).rejects.toBeInstanceOf(ValidationError);
    await expect(client.icalSubscriptions.list({ agentId: '..' }).getPage()).rejects.toBeInstanceOf(ValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  // Every resource method that puts a caller-supplied value into the path.
  // `prefix` is the path the request must stay under.
  type Call = [string, (c: Chronary, id: string) => Promise<unknown>, string];
  const calls: Call[] = [
    ['agents.get', (c, id) => c.agents.get(id), '/v1/agents/'],
    ['agents.update', (c, id) => c.agents.update(id, {}), '/v1/agents/'],
    ['agents.delete', (c, id) => c.agents.delete(id), '/v1/agents/'],
    ['availability.forAgent', (c, id) => c.availability.forAgent(id, { start: 'a', end: 'b' }), '/v1/agents/'],
    ['availability.forCalendar', (c, id) => c.availability.forCalendar(id, { start: 'a', end: 'b' }), '/v1/calendars/'],
    ['billing.upgradeRequests.get', (c, id) => c.billing.upgradeRequests.get(id), '/v1/billing/upgrade-requests/'],
    ['billing.upgradeRequests.cancel', (c, id) => c.billing.upgradeRequests.cancel(id), '/v1/billing/upgrade-requests/'],
    ['bookingPages.get', (c, id) => c.bookingPages.get(id), '/v1/booking-pages/'],
    ['bookingPages.update', (c, id) => c.bookingPages.update(id, {}), '/v1/booking-pages/'],
    ['bookingPages.delete', (c, id) => c.bookingPages.delete(id), '/v1/booking-pages/'],
    ['bookingPages.listBookings', (c, id) => c.bookingPages.listBookings(id), '/v1/booking-pages/'],
    ['bookingPages.rotateSlug', (c, id) => c.bookingPages.rotateSlug(id), '/v1/booking-pages/'],
    ['bookingPages.listSlots', (c, id) => c.bookingPages.listSlots(id), '/book/'],
    ['bookingPages.submit', (c, id) => c.bookingPages.submit(id, {} as never), '/book/'],
    ['calendars.create(agentId)', (c, id) => c.calendars.create({ agentId: id, name: 'n' } as never), '/v1/agents/'],
    ['calendars.get', (c, id) => c.calendars.get(id), '/v1/calendars/'],
    ['calendars.update', (c, id) => c.calendars.update(id, {}), '/v1/calendars/'],
    ['calendars.delete', (c, id) => c.calendars.delete(id), '/v1/calendars/'],
    ['calendars.rotateIcalToken', (c, id) => c.calendars.rotateIcalToken(id), '/v1/calendars/'],
    ['calendars.getContext', (c, id) => c.calendars.getContext(id), '/v1/calendars/'],
    ['calendars.setAvailabilityRules', (c, id) => c.calendars.setAvailabilityRules(id, {} as never), '/v1/calendars/'],
    ['calendars.getAvailabilityRules', (c, id) => c.calendars.getAvailabilityRules(id), '/v1/calendars/'],
    ['calendars.deleteAvailabilityRules', (c, id) => c.calendars.deleteAvailabilityRules(id), '/v1/calendars/'],
    ['connectionLinks.create', (c, id) => c.connectionLinks.create(id, {} as never), '/v1/calendars/'],
    ['connectionLinks.get', (c, id) => c.connectionLinks.get(id), '/v1/connection-links/'],
    ['connectionLinks.cancel', (c, id) => c.connectionLinks.cancel(id), '/v1/connection-links/'],
    ['events.create', (c, id) => c.events.create(id, {} as never), '/v1/calendars/'],
    ['events.get(calendarId)', (c, id) => c.events.get(id, 'evt_1'), '/v1/calendars/'],
    ['events.get(eventId)', (c, id) => c.events.get('cal_1', id), '/v1/calendars/cal_1/events/'],
    ['events.update(eventId)', (c, id) => c.events.update('cal_1', id, {}), '/v1/calendars/cal_1/events/'],
    ['events.delete(eventId)', (c, id) => c.events.delete('cal_1', id), '/v1/calendars/cal_1/events/'],
    ['events.getById', (c, id) => c.events.getById(id), '/v1/events/'],
    ['events.updateById', (c, id) => c.events.updateById(id, {}), '/v1/events/'],
    ['events.deleteById', (c, id) => c.events.deleteById(id), '/v1/events/'],
    ['events.confirm', (c, id) => c.events.confirm(id), '/v1/events/'],
    ['events.release', (c, id) => c.events.release(id), '/v1/events/'],
    ['icalSubscriptions.create', (c, id) => c.icalSubscriptions.create(id, {} as never), '/v1/agents/'],
    ['icalSubscriptions.get', (c, id) => c.icalSubscriptions.get(id), '/v1/ical-subscriptions/'],
    ['icalSubscriptions.update', (c, id) => c.icalSubscriptions.update(id, {}), '/v1/ical-subscriptions/'],
    ['icalSubscriptions.delete', (c, id) => c.icalSubscriptions.delete(id), '/v1/ical-subscriptions/'],
    ['icalSubscriptions.sync', (c, id) => c.icalSubscriptions.sync(id), '/v1/ical-subscriptions/'],
    ['icalSubscriptions.pause', (c, id) => c.icalSubscriptions.pause(id), '/v1/ical-subscriptions/'],
    ['icalSubscriptions.resume', (c, id) => c.icalSubscriptions.resume(id), '/v1/ical-subscriptions/'],
    ['keys.delete', (c, id) => c.keys.delete(id), '/v1/keys/'],
    ['scheduling.get', (c, id) => c.scheduling.get(id), '/v1/scheduling/proposals/'],
    ['scheduling.respond', (c, id) => c.scheduling.respond(id, {} as never), '/v1/scheduling/proposals/'],
    ['scheduling.resolve', (c, id) => c.scheduling.resolve(id), '/v1/scheduling/proposals/'],
    ['scheduling.cancel', (c, id) => c.scheduling.cancel(id), '/v1/scheduling/proposals/'],
    ['webhooks.get', (c, id) => c.webhooks.get(id), '/v1/webhooks/'],
    ['webhooks.update', (c, id) => c.webhooks.update(id, {}), '/v1/webhooks/'],
    ['webhooks.delete', (c, id) => c.webhooks.delete(id), '/v1/webhooks/'],
    ['webhooks.listDeliveries', (c, id) => c.webhooks.listDeliveries(id), '/v1/webhooks/'],
    ['webhooks.getDelivery(webhookId)', (c, id) => c.webhooks.getDelivery(id, 'whd_1'), '/v1/webhooks/'],
    ['webhooks.getDelivery(deliveryId)', (c, id) => c.webhooks.getDelivery('whk_1', id), '/v1/webhooks/whk_1/deliveries/'],
    ['webhooks.sendTest', (c, id) => c.webhooks.sendTest(id, {} as never), '/v1/webhooks/'],
    ['webhooks.replayDelivery(webhookId)', (c, id) => c.webhooks.replayDelivery(id, 'whd_1'), '/v1/webhooks/'],
    ['webhooks.replayDelivery(deliveryId)', (c, id) => c.webhooks.replayDelivery('whk_1', id), '/v1/webhooks/whk_1/deliveries/'],
    ['webhooks.rotateSecret', (c, id) => c.webhooks.rotateSecret(id), '/v1/webhooks/'],
  ];

  it.each(calls)('%s keeps "../keys#x?y" as one encoded segment', async (_name, call, prefix) => {
    const { fetch, client } = setup();
    await call(client, '../keys#x?y').catch(() => undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    const sent = wirePath(fetch.mock.calls[0]);
    expect(sent.startsWith(`${prefix}..%2Fkeys%23x%3Fy`)).toBe(true);
  });

  it.each(calls)('%s refuses ".." before sending', async (_name, call) => {
    const { fetch, client } = setup();
    await expect(call(client, '..')).rejects.toBeInstanceOf(ValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
