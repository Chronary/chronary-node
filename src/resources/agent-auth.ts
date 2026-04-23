import type { CoreClient } from '../client';
import type {
  AgentSignUpParams,
  AgentSignUpResponse,
  AgentSignUpNewOrgResponse,
  AgentVerifyParams,
  AgentVerifyResponse,
  RequestOptions,
} from '../types';

export class AgentAuthClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Register a new agent + org. Sends an OTP to the provided email.
   *
   * No authentication required — callers may construct a `Chronary` client
   * with no `apiKey` to invoke this method.
   *
   * The response is a discriminated union:
   *   - **New org path** — returns `org_id`, `agent_id`, `api_key`, and
   *     `test_api_key`. The live `api_key` is restricted to the verify
   *     endpoint until the OTP is submitted successfully; after verification
   *     it unlocks the full API. The `test_api_key` works immediately.
   *   - **Existing-org dedup** — returns only `message`. No credentials are
   *     leaked when the email matches an existing org (enumeration defense).
   *
   * Use `isAgentSignUpNewOrg()` to narrow the union before accessing keys.
   *
   * @throws ChronaryError (409 `tos_version_stale`) if `tos_version` is not
   *   the currently-published version — retry with the value from the
   *   `current_version` field on the error body.
   */
  async signUp(
    params: AgentSignUpParams,
    options?: RequestOptions,
  ): Promise<AgentSignUpResponse> {
    return this.client.request<AgentSignUpResponse>(
      'POST',
      '/v1/agent/sign-up',
      params,
      undefined,
      options,
    );
  }

  /**
   * Submit the OTP sent during `signUp()` to unlock the live API key.
   *
   * Must be invoked on a `Chronary` client constructed with the restricted
   * `api_key` returned by `signUp()` — NOT on the client that issued
   * `signUp()` itself (which had no key).
   *
   * @throws ChronaryError (status 400) when the OTP is wrong or expired.
   *   The SDK's `ValidationError` class is reserved for HTTP 422; the
   *   API returns 400 for invalid/expired OTPs, which surfaces as a
   *   generic `ChronaryError` with the original message.
   */
  async verify(
    params: AgentVerifyParams,
    options?: RequestOptions,
  ): Promise<AgentVerifyResponse> {
    return this.client.request<AgentVerifyResponse>(
      'POST',
      '/v1/agent/verify',
      params,
      undefined,
      options,
    );
  }
}

/**
 * Type guard — narrows an `AgentSignUpResponse` to the new-org branch.
 * The existing-org dedup branch returns only `message`, so this is the
 * caller's cue that credentials are present.
 */
export function isAgentSignUpNewOrg(
  response: AgentSignUpResponse,
): response is AgentSignUpNewOrgResponse {
  return 'api_key' in response;
}
