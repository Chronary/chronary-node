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

  async create(params: CreateAgentParams, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>('POST', '/v1/agents', params, undefined, options);
  }

  async get(id: string, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>('GET', `/v1/agents/${id}`, undefined, undefined, options);
  }

  list(params: ListAgentsParams = {}): PageIterator<Agent> {
    const { limit = 50, ...filters } = params;
    return new PageIterator<Agent>(
      (offset, l) =>
        this.client.request<PageResponse<Agent>>('GET', '/v1/agents', undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
    );
  }

  async update(id: string, params: UpdateAgentParams, options?: RequestOptions): Promise<Agent> {
    return this.client.request<Agent>('PATCH', `/v1/agents/${id}`, params, undefined, options);
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/agents/${id}`, undefined, undefined, options);
  }
}
