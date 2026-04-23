import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

describe('PlansClient', () => {
  const catalogFixture = {
    plans: [
      {
        id: 'free',
        name: 'Free',
        tagline: 'For prototyping and small agents',
        price: 0,
        currency: 'usd',
        limits: { agents: 5, calendars: 10, events: 5000, api_calls: 50000, webhook_deliveries: 10000, availability_queries: 10000, ical_subscriptions: 3, proposals: 500 },
        display_features: ['5 agents'],
        recommended: false,
      },
      {
        id: 'pro',
        name: 'Pro',
        tagline: 'For production agent workflows',
        price: 2900,
        currency: 'usd',
        limits: { agents: 500, calendars: 1000, events: 500000, api_calls: 1000000, webhook_deliveries: 1000000, availability_queries: 1000000, ical_subscriptions: 100, proposals: null },
        display_features: ['500 agents'],
        recommended: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        tagline: 'Custom limits, dedicated SLA',
        price: null,
        currency: null,
        limits: null,
        display_features: ['Everything in Scale'],
        recommended: false,
        custom_pricing: true,
        contact_url: 'https://chronary.ai/contact',
      },
    ],
  };

  it('list → sends GET /v1/plans and returns the catalog', async () => {
    const fetch = mockFetch([{ status: 200, body: catalogFixture }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.plans.list();

    expect(fetch.mock.calls[0][0]).toContain('/v1/plans');
    expect(fetch.mock.calls[0][1]?.method).toBe('GET');
    expect(result.plans).toHaveLength(3);
    expect(result.plans[1].id).toBe('pro');
    expect(result.plans[1].price).toBe(2900);
    expect(result.plans[2].custom_pricing).toBe(true);
  });

  it('list works without an api key configured (public endpoint)', async () => {
    const fetch = mockFetch([{ status: 200, body: catalogFixture }]);
    const client = new Chronary(clientConfig(fetch, { apiKey: undefined }));

    const result = await client.plans.list();
    expect(result.plans).toHaveLength(3);
    // Confirm no Authorization header was sent
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});
