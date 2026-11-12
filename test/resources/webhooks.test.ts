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

  it('getDelivery returns the delivery with its attempt_log', async () => {
    const detail = {
      id: 'whd_1',
      subscription_id: 'whk_abc123',
      event_type: 'event.created',
      status: 'failed',
      attempts: 1,
      max_attempts: 4,
      last_attempt_at: '2026-04-18T10:00:00.000Z',
      next_retry_at: null,
      created_at: '2026-04-18T10:00:00.000Z',
      last_response_status: 503,
      last_error_code: 'non_2xx',
      last_duration_ms: 120,
      payload: { id: 'evt_1' },
      payload_redacted: false,
      request_headers: {
        'content-type': 'application/json',
        'x-delivery-id': 'whd_1',
        'x-chronary-event-type': 'event.created',
      },
      attempt_log: [
        {
          id: 'wha_1',
          attempt_number: 1,
          started_at: '2026-04-18T10:00:00.000Z',
          duration_ms: 120,
          response_status: 503,
          response_body: 'unavailable',
          error_code: 'non_2xx',
        },
      ],
    };
    const fetch = mockFetch([{ status: 200, body: detail }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.getDelivery('whk_abc123', 'whd_1');
    expect(fetch.mock.calls[0][0]).toContain('/v1/webhooks/whk_abc123/deliveries/whd_1');
    expect(fetch.mock.calls[0][1]?.method).toBe('GET');
    expect(result.attempt_log[0].error_code).toBe('non_2xx');
    expect(result.max_attempts).toBe(4);
  });

  it('sendTest POSTs the event type and returns the queued test delivery (#1200)', async () => {
    const sent = {
      delivery_id: 'whd_t',
      webhook_id: 'whk_abc123',
      event_type: 'event.created',
      status: 'pending',
      is_test: true,
    };
    const fetch = mockFetch([{ status: 202, body: sent }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.sendTest('whk_abc123', { event_type: 'event.created' });
    expect(fetch.mock.calls[0][0]).toContain('/v1/webhooks/whk_abc123/test');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ event_type: 'event.created' });
    expect(result).toEqual(sent);
  });

  it('replayDelivery POSTs to the replay route with an Idempotency-Key (#588)', async () => {
    const sent = {
      delivery_id: 'whd_new',
      webhook_id: 'whk_abc123',
      event_type: 'event.created',
      status: 'pending',
      replay_of_delivery_id: 'whd_orig',
    };
    const fetch = mockFetch([{ status: 202, body: sent }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.replayDelivery('whk_abc123', 'whd_orig', { idempotencyKey: 'replay-1' });
    expect(fetch.mock.calls[0][0]).toContain('/v1/webhooks/whk_abc123/deliveries/whd_orig/replay');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    expect(fetch.mock.calls[0][1]?.body).toBeUndefined();
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>)['Idempotency-Key']).toBe('replay-1');
    expect(result).toEqual(sent);
  });

  it('rotateSecret POSTs expire_old_in and returns the new secret (#594)', async () => {
    const rotated = {
      webhook_id: 'whk_abc123',
      secret: 'whsec_new',
      previous_secret_expires_at: '2026-11-05T10:00:00.000Z',
    };
    const fetch = mockFetch([{ status: 200, body: rotated }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.rotateSecret('whk_abc123', { expire_old_in: '1h' });
    expect(fetch.mock.calls[0][0]).toContain('/v1/webhooks/whk_abc123/secret/rotate');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ expire_old_in: '1h' });
    expect(result).toEqual(rotated);
  });

  it('rotateSecret sends an empty body by default (the API defaults to 24h)', async () => {
    const fetch = mockFetch([
      { status: 200, body: { webhook_id: 'whk_abc123', secret: 'whsec_new', previous_secret_expires_at: null } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    await client.webhooks.rotateSecret('whk_abc123');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({});
  });

  it('listDeliveries sends the #1200 filters and cursor and returns next_cursor', async () => {
    const page = {
      data: [],
      total: 3,
      limit: 2,
      offset: 0,
      next_cursor: 'WyJ4IiwieSJd',
      has_more: true,
      stats: { pending: 0, delivered: 1, failed: 0, dropped: 2 },
    };
    const fetch = mockFetch([{ status: 200, body: page }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.webhooks.listDeliveries('whk_abc123', {
      limit: 2,
      status: 'dropped',
      event_type: 'event.',
      created_after: '2026-04-18T00:00:00Z',
      is_test: false,
      cursor: 'abc',
    });
    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v1/webhooks/whk_abc123/deliveries');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '2',
      offset: '0',
      status: 'dropped',
      event_type: 'event.',
      created_after: '2026-04-18T00:00:00Z',
      is_test: 'false',
      cursor: 'abc',
    });
    expect(result.next_cursor).toBe('WyJ4IiwieSJd');
    expect(result.stats.dropped).toBe(2);
  });

  it('listDeliveries sends only limit and offset by default', async () => {
    const fetch = mockFetch([{ status: 200, body: { data: [], total: 0, limit: 20, offset: 0, next_cursor: null, has_more: false, stats: {} } }]);
    const client = new Chronary(clientConfig(fetch));
    await client.webhooks.listDeliveries('whk_abc123');
    expect(new URL(fetch.mock.calls[0][0] as string).search).toBe('?limit=20&offset=0');
  });
});
