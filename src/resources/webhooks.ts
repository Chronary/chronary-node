import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  ListWebhooksParams,
  ListWebhookDeliveriesParams,
  WebhookDeliveryListResponse,
  PageResponse,
  RequestOptions,
} from '../types';

export class WebhooksClient {
  constructor(private readonly client: CoreClient) {}

  async create(params: CreateWebhookParams, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>('POST', '/v1/webhooks', params, undefined, options);
  }

  async get(id: string, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>('GET', `/v1/webhooks/${id}`, undefined, undefined, options);
  }

  list(params: ListWebhooksParams = {}): PageIterator<Webhook> {
    const { limit = 20, offset = 0, ...filters } = params;
    return new PageIterator<Webhook>(
      (offset, l) =>
        this.client.request<PageResponse<Webhook>>('GET', '/v1/webhooks', undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
      offset,
    );
  }

  async update(id: string, params: UpdateWebhookParams, options?: RequestOptions): Promise<Webhook> {
    return this.client.request<Webhook>('PATCH', `/v1/webhooks/${id}`, params, undefined, options);
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/webhooks/${id}`, undefined, undefined, options);
  }

  async listDeliveries(
    webhookId: string,
    params: ListWebhookDeliveriesParams = {},
    options?: RequestOptions,
  ): Promise<WebhookDeliveryListResponse> {
    const { limit = 20, offset = 0, status, include_payload } = params;
    return this.client.request<WebhookDeliveryListResponse>(
      'GET',
      `/v1/webhooks/${webhookId}/deliveries`,
      undefined,
      { limit, offset, ...(status !== undefined && { status }), ...(include_payload !== undefined && { include_payload }) },
      options,
    );
  }
}
