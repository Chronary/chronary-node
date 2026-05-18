import type { CoreClient } from '../client';
import type {
  WaitlistJoinParams,
  WaitlistJoinResponse,
  RequestOptions,
} from '../types';

export class WaitlistClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Join the Chronary waitlist (#442). Used during private preview when open
   * signup is gated. Creates a real organization row flagged as
   * `is_waitlisted: true`; an admin flips the flag to activate the account.
   *
   * No authentication required — invoke on a `Chronary` client constructed
   * with no `apiKey`.
   *
   * Idempotent on repeat hits: a second call with the same email returns
   * the existing waitlisted org instead of erroring. An active (non-waitlisted)
   * account at the same email returns 409 `email_taken`.
   *
   * @throws ChronaryError (409 `email_taken`) when an active account already
   *   exists for this email — direct the user to sign-in instead.
   * @throws ChronaryError (409 `tos_version_stale`) when the supplied
   *   `tos_version` doesn't match the currently-published version.
   * @throws ChronaryError (429 `rate_limit_error`) on the per-IP / per-email
   *   waitlist limiter.
   */
  async join(
    params: WaitlistJoinParams,
    options?: RequestOptions,
  ): Promise<WaitlistJoinResponse> {
    return this.client.request<WaitlistJoinResponse>(
      'POST',
      '/v1/waitlist',
      params,
      undefined,
      options,
    );
  }
}
