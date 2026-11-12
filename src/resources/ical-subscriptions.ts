import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  ICalSubscription,
  CreateICalSubscriptionParams,
  UpdateICalSubscriptionParams,
  ListICalSubscriptionsParams,
  PageResponse,
  RequestOptions,
} from '../types';

export class ICalSubscriptionsClient {
  constructor(private readonly client: CoreClient) {}

  async create(agentId: string, params: CreateICalSubscriptionParams, options?: RequestOptions): Promise<ICalSubscription> {
    return this.client.request<ICalSubscription>(
      'POST', `/v1/agents/${agentId}/ical-subscriptions`, params, undefined, options,
    );
  }

  async get(id: string, options?: RequestOptions): Promise<ICalSubscription> {
    return this.client.request<ICalSubscription>(
      'GET', `/v1/ical-subscriptions/${id}`, undefined, undefined, options,
    );
  }

  list(params: ListICalSubscriptionsParams & { agentId: string }): PageIterator<ICalSubscription> {
    const { agentId, limit = 50, offset = 0, ...filters } = params;
    return new PageIterator<ICalSubscription>(
      (offset, l) =>
        this.client.request<PageResponse<ICalSubscription>>(
          'GET', `/v1/agents/${agentId}/ical-subscriptions`, undefined,
          { ...filters, limit: l, offset },
        ),
      limit,
      offset,
    );
  }

  async update(id: string, params: UpdateICalSubscriptionParams, options?: RequestOptions): Promise<ICalSubscription> {
    return this.client.request<ICalSubscription>(
      'PATCH', `/v1/ical-subscriptions/${id}`, params, undefined, options,
    );
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>(
      'DELETE', `/v1/ical-subscriptions/${id}`, undefined, undefined, options,
    );
  }

  /**
   * Start an immediate fetch of the feed. Resolves with `{ status: 'syncing' }`
   * as soon as the fetch has started; read the subscription a few seconds later
   * for `last_synced_at` / `last_error`. A paused feed rejects with 409, and a
   * second sync of the same feed within a minute rejects with 429.
   */
  async sync(id: string, options?: RequestOptions): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(
      'POST', `/v1/ical-subscriptions/${id}/sync`, undefined, undefined, options,
    );
  }

  /** Stop polling the feed until it is resumed. Pausing a paused feed changes nothing. */
  async pause(id: string, options?: RequestOptions): Promise<ICalSubscription> {
    return this.client.request<ICalSubscription>(
      'POST', `/v1/ical-subscriptions/${id}/pause`, undefined, undefined, options,
    );
  }

  /** Return a paused or failing feed to polling and clear `last_error`. */
  async resume(id: string, options?: RequestOptions): Promise<ICalSubscription> {
    return this.client.request<ICalSubscription>(
      'POST', `/v1/ical-subscriptions/${id}/resume`, undefined, undefined, options,
    );
  }
}
