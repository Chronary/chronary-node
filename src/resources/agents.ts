import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  Agent,
  CreateAgentParams,
  UpdateAgentParams,
  ListAgentsParams,
  PageResponse,
  RequestOptions,
} from '../types';

export class AgentsClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Register your agent with Chronary. Creates a Chronary identity for an agent
   * that already exists in your system, so it can own calendars, events, and webhooks.
   */
  create(params: CreateAgentParams, options?: RequestOptions): APIPromise<Agent> {
    return this.client.request<Agent>('POST', '/v1/agents', params, undefined, options);
  }

  get(id: string, options?: RequestOptions): APIPromise<Agent> {
    return this.client.request<Agent>('GET', `/v1/agents/${id}`, undefined, undefined, options);
  }

  list(params: ListAgentsParams = {}): PageIterator<Agent> {
    const { limit = 50, offset = 0, ...filters } = params;
    return new PageIterator<Agent>(
      (offset, l) =>
        this.client.request<PageResponse<Agent>>('GET', '/v1/agents', undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
      offset,
    );
  }

  update(id: string, params: UpdateAgentParams, options?: RequestOptions): APIPromise<Agent> {
    return this.client.request<Agent>('PATCH', `/v1/agents/${id}`, params, undefined, options);
  }

  delete(id: string, options?: RequestOptions): APIPromise<void> {
    return this.client.request<void>('DELETE', `/v1/agents/${id}`, undefined, undefined, options)._thenUnwrap(() => undefined);
  }
}
