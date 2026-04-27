import type { CoreClient } from '../client';
import type {
  FeedbackAcceptedResponse,
  RequestOptions,
  SubmitFeedbackParams,
} from '../types';

export class FeedbackClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Submit structured feedback (bug, feature, or friction) to Chronary.
   *
   * Rate-limited to 25 submissions per day per organization (UTC day) for
   * live-mode keys. **Test-mode keys (`chr_sk_test_*`) bypass the cap
   * entirely** so synthetic test traffic doesn't contend with real users'
   * feedback budget. Available on all plans, including free. The 26th
   * submission with a live key returns HTTP 429 with a `Retry-After`
   * header set to the seconds until the next UTC midnight.
   */
  async submit(
    params: SubmitFeedbackParams,
    options?: RequestOptions,
  ): Promise<FeedbackAcceptedResponse> {
    return this.client.request<FeedbackAcceptedResponse>(
      'POST',
      '/v1/feedback',
      params,
      undefined,
      options,
    );
  }
}
