import type { CoreClient, QueryValue } from '../client';
import { PageIterator } from '../pagination';
import type {
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  ListWebhooksParams,
  ListWebhookDeliveriesParams,
  WebhookDeliveryListResponse,
  WebhookDeliveryDetail,
  SendTestWebhookParams,
  WebhookTestSent,
  WebhookReplaySent,
  RotateWebhookSecretParams,
  RotatedWebhookSecret,
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
    const { limit = 20, offset = 0, ...filters } = params;
    const query: Record<string, QueryValue> = { limit, offset };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) query[key] = value;
    }
    return this.client.request<WebhookDeliveryListResponse>(
      'GET',
      `/v1/webhooks/${webhookId}/deliveries`,
      undefined,
      query,
      options,
    );
  }

  /** One delivery with its payload and every attempt, oldest first. */
  async getDelivery(
    webhookId: string,
    deliveryId: string,
    options?: RequestOptions,
  ): Promise<WebhookDeliveryDetail> {
    return this.client.request<WebhookDeliveryDetail>(
      'GET',
      `/v1/webhooks/${webhookId}/deliveries/${deliveryId}`,
      undefined,
      undefined,
      options,
    );
  }

  /**
   * Send a signed sample payload of one event type to the endpoint. The
   * delivery is marked `is_test`, carries `X-Chronary-Test: 1`, makes one
   * attempt and does not count toward the monthly quota. Poll `getDelivery`
   * with the returned `delivery_id` for the result. Limited to 10 per minute.
   */
  async sendTest(
    webhookId: string,
    params: SendTestWebhookParams,
    options?: RequestOptions,
  ): Promise<WebhookTestSent> {
    return this.client.request<WebhookTestSent>(
      'POST',
      `/v1/webhooks/${webhookId}/test`,
      params,
      undefined,
      options,
    );
  }

  /**
   * Send a `failed` or `dropped` delivery again as a new delivery with its
   * own `delivery_id` (Developer or Pro). The stored payload goes out unchanged, signed
   * with the endpoint's current secret, with an `X-Chronary-Replay-Of`
   * header. It follows the normal retry schedule and counts toward the
   * monthly delivery quota. The endpoint must be active. Sent with an
   * `Idempotency-Key` (generated, or `options.idempotencyKey`), so a retry
   * returns the same replay. Limited to 30 per minute.
   */
  async replayDelivery(
    webhookId: string,
    deliveryId: string,
    options?: RequestOptions,
  ): Promise<WebhookReplaySent> {
    return this.client.request<WebhookReplaySent>(
      'POST',
      `/v1/webhooks/${webhookId}/deliveries/${deliveryId}/replay`,
      undefined,
      undefined,
      options,
    );
  }

  /**
   * Rotate the endpoint's signing secret (Developer or Pro). The new secret is returned
   * once and signs `X-Signature` from the next attempt. The replaced secret
   * keeps signing `X-Signature-Previous` until `expire_old_in` has passed
   * (default `24h`; `now` drops it at once), so receivers can switch
   * without rejecting deliveries. `verifySignature` accepts either header.
   */
  async rotateSecret(
    webhookId: string,
    params: RotateWebhookSecretParams = {},
    options?: RequestOptions,
  ): Promise<RotatedWebhookSecret> {
    return this.client.request<RotatedWebhookSecret>(
      'POST',
      `/v1/webhooks/${webhookId}/secret/rotate`,
      params,
      undefined,
      options,
    );
  }
}
