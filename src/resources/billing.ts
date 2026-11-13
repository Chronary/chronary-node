import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type {
  BillingSummary,
  CreateUpgradeRequestParams,
  RequestOptions,
  UpgradeRequest,
} from '../types';

export class UpgradeRequestsClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Ask a human to upgrade this account's plan. Org keys (`chr_sk_`) only.
   * Returns an `approval_url` to hand to your human. Honors `idempotencyKey`;
   * if `reused` is true a request is already pending — poll it instead.
   */
  create(params: CreateUpgradeRequestParams = {}, options?: RequestOptions): APIPromise<UpgradeRequest> {
    return this.client.request<UpgradeRequest>('POST', '/v1/billing/upgrade-requests', params, undefined, options);
  }

  /** Poll an upgrade request (at most once a minute). */
  get(id: string, options?: RequestOptions): APIPromise<UpgradeRequest> {
    return this.client.request<UpgradeRequest>('GET', `/v1/billing/upgrade-requests/${id}`, undefined, undefined, options);
  }

  /** Withdraw a pending upgrade request. */
  cancel(id: string, options?: RequestOptions): APIPromise<UpgradeRequest> {
    return this.client.request<UpgradeRequest>('POST', `/v1/billing/upgrade-requests/${id}/cancel`, undefined, undefined, options);
  }
}

export class BillingClient {
  readonly upgradeRequests: UpgradeRequestsClient;

  constructor(private readonly client: CoreClient) {
    this.upgradeRequests = new UpgradeRequestsClient(client);
  }

  /** Read-only billing summary for the org (plan, status, upgrade options, pending upgrade request). */
  get(options?: RequestOptions): APIPromise<BillingSummary> {
    return this.client.request<BillingSummary>('GET', '/v1/billing', undefined, undefined, options);
  }
}
