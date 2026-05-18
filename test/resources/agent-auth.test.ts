import { describe, it, expect } from 'vitest';
import { Chronary, isAgentSignUpNewOrg } from '../../src/index';
import { ChronaryError } from '../../src/error';
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
