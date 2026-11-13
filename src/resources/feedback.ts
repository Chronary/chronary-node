import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type {
  FeedbackAcceptedResponse,
  RequestOptions,
  SubmitFeedbackParams,
} from '../types';

export class FeedbackClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Submit structured feedback (bug, feature, friction, or support) to Chronary.
   *
   * Rate-limited to 25 submissions per day per organization (UTC day).
   * Available on all plans, including free. The 26th submission returns
   * HTTP 429 with a `Retry-After` header set to the seconds until the
   * next UTC midnight.
   */
  submit(
    params: SubmitFeedbackParams,
    options?: RequestOptions,
  ): APIPromise<FeedbackAcceptedResponse> {
    return this.client.request<FeedbackAcceptedResponse>(
      'POST',
      '/v1/feedback',
      params,
      undefined,
      options,
    );
  }
}
