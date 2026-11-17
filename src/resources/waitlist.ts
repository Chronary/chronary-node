import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type {
  WaitlistJoinParams,
  WaitlistJoinResponse,
  RequestOptions,
} from '../types';

export class WaitlistClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Join the Chronary waitlist. Used while open sign-up is gated. Adds the
   * email to the waitlist; an account is created only when a founder approves
   * it and the person accepts the emailed invite.
   *
   * No authentication required — invoke on a `Chronary` client constructed
   * with no `apiKey`.
   *
   * Always resolves to the same `{ waitlisted: true, message }` (HTTP 202),
   * whether the email is new, already on the list, or has an active account,
   * so the response can't be used to look up other people's accounts. Only a
   * new email is sent the confirmation email.
   *
   * @throws ChronaryError (409 `tos_version_stale`) when the supplied
   *   `tos_version` doesn't match the currently-published version.
   * @throws ChronaryError (429 `rate_limit_error`) on the per-IP / per-email
   *   waitlist limiter.
   * @throws ChronaryError (400 `challenge_failed`) while the human check on the
   *   console waitlist form is switched on (#2103). It applies only to that human
   *   form, and an SDK client cannot solve it: an agent signs up with
   *   `agentAuth.signUp` (`POST /v1/agent/sign-up`), which is never challenged.
   */
  join(
    params: WaitlistJoinParams,
    options?: RequestOptions,
  ): APIPromise<WaitlistJoinResponse> {
    return this.client.request<WaitlistJoinResponse>(
      'POST',
      '/v1/waitlist',
      params,
      undefined,
      options,
    );
  }
}
