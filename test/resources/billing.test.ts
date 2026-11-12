import { describe, it, expect } from 'vitest';
import { Chronary, PlanRequiredError, QuotaExceededError, RateLimitError, ChronaryError } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const REQUEST = {
  id: 'upr_abc123',
  status: 'pending',
  plan: 'pro',
  interval: 'month',
  reason: 'Hit the event limit',
  feature: null,
  metric: 'events',
  requested_via: 'api',
  requested_by_key_prefix: 'chr_sk_abcdefghijkl',
  approval_url: 'https://console.test/settings/billing/requests/upr_abc123',
  created_at: '2026-10-19T00:00:00.000Z',
  expires_at: '2026-10-26T00:00:00.000Z',
  completed_at: null,
  declined_at: null,
  canceled_at: null,
};

const SUMMARY = {
  plan: 'free-agent',
  plan_source: null,
  plan_expires_at: null,
  status: null,
  interval: null,
  current_period_end: null,
  cancel_at: null,
  cancel_at_period_end: false,
  renews_at: null,
  price: null,
  has_billing_account: false,
  self_serve_upgrade: true,
  upgrade_options: [{ plan: 'pro', interval: 'month', amount: 2900, currency: 'usd', savings_vs_monthly: 0 }],
  upgrade_url: 'https://console.test/settings/billing',
  manage_url: 'https://console.test/settings/billing',
  contact_url: null,
  pending_upgrade_request: REQUEST,
  offer: null,
  past_due: null,
  credit: null,
};

const PAST_DUE = {
  amount_due: 1581,
  currency: 'usd',
  failed_at: '2026-10-23T00:00:00.000Z',
  next_payment_attempt: null,
  hosted_invoice_url: 'https://invoice.test/pay',
  attempt_count: 4,
};

describe('BillingClient', () => {
  it('get', async () => {
    const fetch = mockFetch([{ status: 200, body: SUMMARY }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.get();
    expect(result.plan).toBe('free-agent');
    expect(result.upgrade_options[0].amount).toBe(2900);
    expect(result.pending_upgrade_request?.id).toBe('upr_abc123');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test.chronary.ai/v1/billing');
    expect(init?.method).toBe('GET');
  });

  it('get returns past_due while a payment is failing', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...SUMMARY, status: 'past_due', past_due: PAST_DUE } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.get();
    expect(result.past_due?.amount_due).toBe(1581);
    expect(result.past_due?.next_payment_attempt).toBeNull();
  });

  it('get returns account credit after a switch to monthly billing', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...SUMMARY, credit: { amount: 26100, currency: 'usd' } } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.get();
    expect(result.credit).toEqual({ amount: 26100, currency: 'usd' });
  });

  it('upgradeRequests.create sends body and Idempotency-Key', async () => {
    const fetch = mockFetch([{ status: 201, body: { ...REQUEST, owner_notification: 'queued', reused: false } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.upgradeRequests.create(
      { interval: 'year', reason: 'Need more events', metric: 'events' },
      { idempotencyKey: 'idem-123' },
    );
    expect(result.approval_url).toContain('/settings/billing/requests/');
    expect(result.owner_notification).toBe('queued');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test.chronary.ai/v1/billing/upgrade-requests');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-123');
    expect(JSON.parse(init?.body as string)).toEqual({ interval: 'year', reason: 'Need more events', metric: 'events' });
  });

  it('upgradeRequests.create defaults to an empty body and generated idempotency key', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...REQUEST, reused: true } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.upgradeRequests.create();
    expect(result.reused).toBe(true);
    const init = fetch.mock.calls[0][1];
    expect(JSON.parse(init?.body as string)).toEqual({});
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  });

  it('upgradeRequests.get', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...REQUEST, status: 'completed', approval_url: null } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.upgradeRequests.get('upr_abc123');
    expect(result.status).toBe('completed');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test.chronary.ai/v1/billing/upgrade-requests/upr_abc123');
    expect(init?.method).toBe('GET');
  });

  it('upgradeRequests.cancel', async () => {
    const fetch = mockFetch([{ status: 200, body: { ...REQUEST, status: 'canceled' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.billing.upgradeRequests.cancel('upr_abc123');
    expect(result.status).toBe('canceled');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test.chronary.ai/v1/billing/upgrade-requests/upr_abc123/cancel');
    expect(init?.method).toBe('POST');
  });
});

describe('plan / quota errors', () => {
  it('403 plan_required throws PlanRequiredError with upgradeUrl', async () => {
    const fetch = mockFetch([{
      status: 403,
      body: { error: {
        type: 'plan_required', message: 'Pro required', request_id: 'req_1',
        required_plan: 'pro', feature: 'scoped_keys',
        upgrade_url: 'https://console.test/settings/billing', docs_url: 'https://docs.test/plans',
      } },
    }]);
    const client = new Chronary(clientConfig(fetch));

    const err = await client.billing.get().catch((e) => e);
    expect(err).toBeInstanceOf(PlanRequiredError);
    expect(err.status).toBe(403);
    expect(err.upgradeUrl).toBe('https://console.test/settings/billing');
    expect(err.docsUrl).toBe('https://docs.test/plans');
    expect(err.requiredPlan).toBe('pro');
    expect(err.feature).toBe('scoped_keys');
    expect(err.body?.type).toBe('plan_required');
  });

  it('other 403s stay plain ChronaryError', async () => {
    const fetch = mockFetch([{ status: 403, body: { error: { type: 'forbidden', message: 'Only org-level API keys can access this resource', request_id: 'r' } } }]);
    const client = new Chronary(clientConfig(fetch));
    const err = await client.billing.get().catch((e) => e);
    expect(err).toBeInstanceOf(ChronaryError);
    expect(err).not.toBeInstanceOf(PlanRequiredError);
    expect(err.errorType).toBe('forbidden');
  });

  it('429 quota_exceeded keeps status 429 and exposes metric/limit/upgradeUrl', async () => {
    const fetch = mockFetch([{
      status: 429,
      body: { error: { type: 'quota_exceeded', message: 'Quota hit', request_id: 'req_2', metric: 'api_calls', limit: 50000, upgrade_url: 'https://console.test/settings/billing' } },
    }]);
    const client = new Chronary(clientConfig(fetch));
    const err = await client.billing.get().catch((e) => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.status).toBe(429);
    expect(err.metric).toBe('api_calls');
    expect(err.limit).toBe(50000);
    expect(err.upgradeUrl).toBe('https://console.test/settings/billing');
  });

  it('legacy 402 keeps status 402', async () => {
    const fetch = mockFetch([{ status: 402, body: { error: { type: 'quota_exceeded', message: 'x', request_id: 'r' } } }]);
    const client = new Chronary(clientConfig(fetch));
    const err = await client.billing.get().catch((e) => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.status).toBe(402);
  });

  it('plain 429 is still RateLimitError', async () => {
    const fetch = mockFetch([{ status: 429, body: { error: { type: 'rate_limit_error', message: 'slow', request_id: 'r' } }, headers: { 'retry-after': '3' } }]);
    const client = new Chronary(clientConfig(fetch));
    const err = await client.billing.get().catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(3);
  });
});
