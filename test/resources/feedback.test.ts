import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

describe('FeedbackClient', () => {
  it('submit → 202 accepted', async () => {
    const fetch = mockFetch([{ status: 202, body: { status: 'accepted' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.feedback.submit({
      type: 'bug',
      message: 'Availability endpoint returns empty slots for UTC+13 timezones.',
    });

    expect(result.status).toBe('accepted');
    expect(fetch.mock.calls[0][0]).toContain('/v1/feedback');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    const sent = JSON.parse((fetch.mock.calls[0][1]?.body as string) ?? '{}');
    expect(sent.type).toBe('bug');
    expect(sent.message).toMatch(/Availability/);
  });

  it('submit with context field', async () => {
    const fetch = mockFetch([{ status: 202, body: { status: 'accepted' } }]);
    const client = new Chronary(clientConfig(fetch));

    await client.feedback.submit({
      type: 'friction',
      message: 'Hit friction on the scheduling proposal flow today.',
      context: { sdk_name: 'chronary-ts', sdk_version: '0.4.2' },
    });

    const sent = JSON.parse((fetch.mock.calls[0][1]?.body as string) ?? '{}');
    expect(sent.context).toEqual({ sdk_name: 'chronary-ts', sdk_version: '0.4.2' });
  });
});
