import { describe, it, expect, vi } from 'vitest';
import { Chronary, isAgentSignUpNewOrg } from '../../src/index';
import { ChronaryError, ConnectionError } from '../../src/error';
import { mockFetch, clientConfig } from '../helpers';

const NEW_ORG_RESPONSE = {
  org_id: 'org_abc123',
  agent_id: 'agt_abc123',
  api_key: 'chr_sk_restricted_abc',
  message: 'Verification code sent to email',
};

const EXISTING_ORG_RESPONSE = {
  message: 'Verification code sent to email',
};

describe('AgentAuthClient', () => {
  describe('signUp', () => {
    it('posts to /v1/agent/sign-up and returns new-org credentials', async () => {
      const fetch = mockFetch([{ status: 200, body: NEW_ORG_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));

      const result = await client.agentAuth.signUp({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
      });

      expect(result).toEqual(NEW_ORG_RESPONSE);
      expect(isAgentSignUpNewOrg(result)).toBe(true);
      if (isAgentSignUpNewOrg(result)) {
        // Type-narrowed end-to-end; this field is only reachable on the new-org branch.
        expect(result.api_key).toBe('chr_sk_restricted_abc');
      }

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('https://api.test.chronary.ai/v1/agent/sign-up');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
      });
    });

    it('sends the optional heard_about text when given (#2651)', async () => {
      const fetch = mockFetch([{ status: 200, body: NEW_ORG_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));

      await client.agentAuth.signUp({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
        heard_about: 'My user found you in a search',
      });

      const [, init] = fetch.mock.calls[0];
      expect(JSON.parse(init?.body as string)).toMatchObject({ heard_about: 'My user found you in a search' });
    });

    it('cuts heard_about to 200 characters before sending, keeping an emoji whole (#2651)', async () => {
      const fetch = mockFetch([{ status: 200, body: NEW_ORG_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));
      const params = {
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
        heard_about: `${'a'.repeat(199)}\u{1F4C5}${'b'.repeat(100)}`,
      };

      await client.agentAuth.signUp(params);

      const [, init] = fetch.mock.calls[0];
      expect(JSON.parse(init?.body as string).heard_about).toBe(`${'a'.repeat(199)}\u{1F4C5}`);
      // The caller's object is not changed.
      expect(params.heard_about).toHaveLength(199 + 2 + 100);
    });

    it('returns the opaque response on existing-org dedup', async () => {
      const fetch = mockFetch([{ status: 200, body: EXISTING_ORG_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));

      const result = await client.agentAuth.signUp({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
      });

      expect(result).toEqual(EXISTING_ORG_RESPONSE);
      expect(isAgentSignUpNewOrg(result)).toBe(false);
    });

    it('works without an apiKey (unauthenticated client)', async () => {
      const fetch = mockFetch([{ status: 200, body: NEW_ORG_RESPONSE }]);
      const client = new Chronary({
        baseUrl: 'https://api.test.chronary.ai',
        fetch,
        maxRetries: 0,
      });

      await client.agentAuth.signUp({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
      });

      const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('propagates 409 tos_version_stale as an error', async () => {
      const fetch = mockFetch([
        {
          status: 409,
          body: {
            error: {
              type: 'tos_version_stale',
              message: 'The submitted terms-of-service version is out of date',
              current_version: '2026-05-01',
              request_id: 'req_test1',
            },
          },
        },
      ]);
      const client = new Chronary(clientConfig(fetch));

      await expect(
        client.agentAuth.signUp({
          email: 'alice@example.com',
          agent_name: 'Alice Bot',
          tos_version: '2026-01-01',
        }),
      ).rejects.toThrow(/out of date/);
    });

    it('includes an Idempotency-Key header (mutating request)', async () => {
      const fetch = mockFetch([{ status: 200, body: NEW_ORG_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));

      await client.agentAuth.signUp({
        email: 'alice@example.com',
        agent_name: 'Alice Bot',
        tos_version: '2026-04-17',
      });

      const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBeTruthy();
    });
  });

  describe('signUpAnonymous', () => {
    const ANON_RESPONSE = {
      org_id: '11111111-2222-3333-4444-555555555555',
      agent_id: 'agt_anon',
      api_key: 'chr_sk_anon',
      claim_url: 'https://console.chronary.ai/claim/anonymous#token=tok',
      expires_at: '2026-11-20T12:00:00.000Z',
      plan: 'free-agent-unverified',
    };

    it('posts to /v1/agent/sign-up/anonymous without auth and returns the key and claim link', async () => {
      const fetch = mockFetch([{ status: 201, body: ANON_RESPONSE }]);
      const client = new Chronary({ baseUrl: 'https://api.test.chronary.ai', fetch, maxRetries: 0 });

      const result = await client.agentAuth.signUpAnonymous({ agent_name: 'Playground', tos_version: '2026-04-17' });

      expect(result).toEqual(ANON_RESPONSE);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('https://api.test.chronary.ai/v1/agent/sign-up/anonymous');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ agent_name: 'Playground', tos_version: '2026-04-17' });
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it('sends source when given', async () => {
      const fetch = mockFetch([{ status: 201, body: ANON_RESPONSE }]);
      const client = new Chronary(clientConfig(fetch));
      await client.agentAuth.signUpAnonymous({ agent_name: 'P', tos_version: 'v', source: 'playground' });
      expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toMatchObject({ source: 'playground' });
    });

    it('propagates 503 anonymous_signup_disabled as an error', async () => {
      const fetch = mockFetch([
        {
          status: 503,
          body: { error: { type: 'anonymous_signup_disabled', message: 'Sign-up without an email is not available.', request_id: 'req_1' } },
        },
      ]);
      const client = new Chronary(clientConfig(fetch));
      await expect(client.agentAuth.signUpAnonymous({ agent_name: 'P', tos_version: 'v' })).rejects.toBeInstanceOf(ChronaryError);
    });

    // #2690: the server does not dedupe this POST, so a retry after a lost
    // response creates a second claimable org. It is sent once, even on a
    // client whose default maxRetries is 2.
    it('does not retry a 500 (sends exactly one request)', async () => {
      const fetch = mockFetch([
        { status: 500, body: { error: { type: 'api_error', message: 'x', request_id: 'req_1' } } },
        { status: 201, body: ANON_RESPONSE },
      ]);
      const client = new Chronary({ baseUrl: 'https://api.test.chronary.ai', fetch });
      await expect(client.agentAuth.signUpAnonymous({ agent_name: 'P', tos_version: 'v' })).rejects.toBeInstanceOf(ChronaryError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry a connection reset (sends exactly one request)', async () => {
      const fetch = vi.fn(async () => {
        if (fetch.mock.calls.length === 1) throw new TypeError('fetch failed: ECONNRESET');
        return new Response(JSON.stringify(ANON_RESPONSE), { status: 201 });
      });
      const client = new Chronary({ baseUrl: 'https://api.test.chronary.ai', fetch });
      await expect(client.agentAuth.signUpAnonymous({ agent_name: 'P', tos_version: 'v' })).rejects.toBeInstanceOf(ConnectionError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries when the caller opts in with maxRetries', async () => {
      const fetch = mockFetch([
        { status: 503, body: { error: { type: 'temporarily_disabled', message: 'x', request_id: 'req_1' } } },
        { status: 201, body: ANON_RESPONSE },
      ]);
      const client = new Chronary({ baseUrl: 'https://api.test.chronary.ai', fetch });
      vi.useFakeTimers();
      try {
        const p = client.agentAuth.signUpAnonymous({ agent_name: 'P', tos_version: 'v' }, { maxRetries: 1 });
        await vi.runAllTimersAsync();
        await expect(p).resolves.toEqual(ANON_RESPONSE);
      } finally {
        vi.useRealTimers();
      }
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('verify', () => {
    it('posts to /v1/agent/verify with Authorization header', async () => {
      const fetch = mockFetch([
        { status: 200, body: { verified: true, message: 'Full access unlocked' } },
      ]);
      const client = new Chronary({
        apiKey: 'chr_sk_restricted_abc',
        baseUrl: 'https://api.test.chronary.ai',
        fetch,
        maxRetries: 0,
      });

      const result = await client.agentAuth.verify({ otp: '123456' });

      expect(result.verified).toBe(true);
      expect(result.message).toBe('Full access unlocked');

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe('https://api.test.chronary.ai/v1/agent/verify');
      expect(init?.method).toBe('POST');
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer chr_sk_restricted_abc');
      expect(JSON.parse(init?.body as string)).toEqual({ otp: '123456' });
    });

    it('includes an Idempotency-Key header (mutating request)', async () => {
      const fetch = mockFetch([
        { status: 200, body: { verified: true, message: 'Full access unlocked' } },
      ]);
      const client = new Chronary(clientConfig(fetch));

      await client.agentAuth.verify({ otp: '123456' });

      const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBeTruthy();
    });

    it('surfaces a ChronaryError with the API message on bad OTP (400)', async () => {
      const fetch = mockFetch([
        {
          status: 400,
          body: {
            error: {
              type: 'validation_error',
              message: 'Invalid or expired verification code',
              request_id: 'req_test1',
            },
          },
        },
      ]);
      const client = new Chronary(clientConfig(fetch));

      await expect(
        client.agentAuth.verify({ otp: '000000' }),
      ).rejects.toThrow(ChronaryError);
      await expect(
        client.agentAuth.verify({ otp: '000000' }),
      ).rejects.toThrow(/Invalid or expired/);
    });
  });
});

describe('isAgentSignUpNewOrg', () => {
  it('returns true when api_key is present', () => {
    expect(isAgentSignUpNewOrg(NEW_ORG_RESPONSE)).toBe(true);
  });

  it('returns false for existing-org dedup response', () => {
    expect(isAgentSignUpNewOrg(EXISTING_ORG_RESPONSE)).toBe(false);
  });
});
