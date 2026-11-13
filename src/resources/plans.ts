import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type { PlansListResponse, RequestOptions } from '../types';

export class PlansClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Fetch the public plan catalog (`GET /v1/plans`).
   *
   * Returns all sellable tiers (free, developer, pro) plus the enterprise
   * tier with `custom_pricing: true`. No authentication required.
   * Responses are cacheable for 5 minutes at the edge.
   */
  list(options?: RequestOptions): APIPromise<PlansListResponse> {
    return this.client.request<PlansListResponse>('GET', '/v1/plans', undefined, undefined, options);
  }
}
