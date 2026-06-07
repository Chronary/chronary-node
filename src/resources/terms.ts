import type { CoreClient } from '../client';
import type { AcceptTermsParams, AcceptTermsResult, RequestOptions } from '../types';

export class TermsClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Re-accept the current Chronary terms of service for the calling org.
   *
   * Use this when a response carries the `Chronary-Terms-Upgrade-Required`
   * header after a material ToS bump — it clears the upgrade requirement for
   * Bearer-key (SDK / MCP) clients that have no console session. Read the
   * current version from `GET /v1/auth/terms/current` and pass it verbatim.
   *
   * **Authentication:** org-level API keys (`chr_sk_*`) only — agent-scoped
   * keys cannot accept org-wide terms (403). A stale version returns 409
   * `tos_version_stale` with the current version in the error body.
   */
  async accept(params: AcceptTermsParams, options?: RequestOptions): Promise<AcceptTermsResult> {
    return this.client.request<AcceptTermsResult>(
      'POST',
      '/v1/terms/accept',
      params,
      undefined,
      options,
    );
  }
}
