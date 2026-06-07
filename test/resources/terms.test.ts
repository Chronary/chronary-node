import { describe, expect, it } from 'vitest';
import { Chronary } from '../../src/index';
import { clientConfig, mockFetch } from '../helpers';

const ACCEPTED = {
  accepted_terms_version: '2026-05-11',
  accepted_terms_at: '2026-05-11T00:00:00.000Z',
};

describe('TermsClient', () => {
  it('accept posts the version to /v1/terms/accept', async () => {
    const fetch = mockFetch([{ status: 200, body: ACCEPTED }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.terms.accept({ tos_version: '2026-05-11' });

    expect(result).toEqual(ACCEPTED);
    expect(fetch.mock.calls[0][0]).toContain('/v1/terms/accept');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ tos_version: '2026-05-11' });
  });
});
