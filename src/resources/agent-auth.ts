import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type {
  AgentSignUpAnonymousParams,
  AgentSignUpAnonymousResponse,
  AgentSignUpParams,
  AgentSignUpResponse,
  AgentSignUpNewOrgResponse,
  AgentVerifyParams,
  AgentVerifyResponse,
  RequestOptions,
} from '../types';

/** Longest `heard_about` the API keeps (#2651); longer text is cut before sending. */
const HEARD_ABOUT_MAX_CHARS = 200;

export class AgentAuthClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Register a new agent + org. Sends an OTP to the provided email.
   *
   * No authentication required — callers may construct a `Chronary` client
   * with no `apiKey` to invoke this method.
   *
   * The response is a discriminated union:
   *   - **New org path** — returns `org_id`, `agent_id`, and `api_key`.
   *     The `api_key` is restricted to the verify endpoint until the OTP
   *     is submitted successfully; after verification it unlocks the full API.
   *   - **Existing-org dedup** — returns only `message`. No credentials are
   *     leaked when the email matches an existing org (enumeration defense).
   *
   * Use `isAgentSignUpNewOrg()` to narrow the union before accessing keys.
   *
   * @throws ChronaryError (409 `tos_version_stale`) if `tos_version` is not
   *   the currently-published version — retry with the value from the
   *   `current_version` field on the error body.
   */
  signUp(
    params: AgentSignUpParams,
    options?: RequestOptions,
  ): APIPromise<AgentSignUpResponse> {
    // `heard_about` is informational: cut to 200 characters (code points) so
    // a long answer never costs the sign-up (#2651).
    const body =
      typeof params.heard_about === 'string'
        ? { ...params, heard_about: Array.from(params.heard_about).slice(0, HEARD_ABOUT_MAX_CHARS).join('') }
        : params;
    return this.client.request<AgentSignUpResponse>(
      'POST',
      '/v1/agent/sign-up',
      body,
      undefined,
      options,
    );
  }

  /**
   * Sign up without an email: a claimable organization (`POST
   * /v1/agent/sign-up/anonymous`). No authentication required.
   *
   * The returned `api_key` works at once at Sandbox limits. The org sends and
   * receives no email and cannot create webhook endpoints or call `verify()`.
   * Hand `claim_url` to the person who should own the calendar before
   * `expires_at` (72 hours); unclaimed, the key stops working and the org and
   * its data are deleted.
   *
   * @throws ChronaryError (409 `tos_version_stale`) if `tos_version` is not
   *   the current version; (429 `rate_limit_error`) over the per-network
   *   budget; (503 `anonymous_signup_disabled`, `signups_paused`,
   *   `anonymous_signup_capacity` or `temporarily_disabled`) when this
   *   sign-up is unavailable.
   *
   * Sent once, without retries, unless `options.maxRetries` says otherwise:
   * the server does not dedupe this POST, so a retry after a lost response
   * (a 5xx or a connection reset after the org was created) would create a
   * second claimable org (#2690).
   */
  signUpAnonymous(
    params: AgentSignUpAnonymousParams,
    options?: RequestOptions,
  ): APIPromise<AgentSignUpAnonymousResponse> {
    return this.client.request<AgentSignUpAnonymousResponse>(
      'POST',
      '/v1/agent/sign-up/anonymous',
      params,
      undefined,
      { ...options, maxRetries: options?.maxRetries ?? 0 },
    );
  }

  /**
   * Submit the OTP sent during `signUp()` to unlock the API key.
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
  verify(
    params: AgentVerifyParams,
    options?: RequestOptions,
  ): APIPromise<AgentVerifyResponse> {
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
