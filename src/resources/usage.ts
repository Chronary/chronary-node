import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type { Usage, UsageHistory, UsageHistoryParams, RequestOptions } from '../types';

export class UsageClient {
  constructor(private readonly client: CoreClient) {}

  get(options?: RequestOptions): APIPromise<Usage> {
    return this.client.request<Usage>('GET', '/v1/usage', undefined, undefined, options);
  }

  /**
   * Monthly totals for the last 1-12 UTC calendar months (default 6), oldest
   * first, ending with the current partial month. Org-level keys only; not
   * counted toward API calls.
   */
  history(params?: UsageHistoryParams, options?: RequestOptions): APIPromise<UsageHistory> {
    const query: Record<string, string | number | boolean | undefined> = { months: params?.months };
    return this.client.request<UsageHistory>('GET', '/v1/usage/history', undefined, query, options);
  }
}
