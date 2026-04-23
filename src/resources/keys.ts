import type { CoreClient } from '../client';
import type {
  CreatedScopedApiKey,
  CreateScopedApiKeyParams,
  RequestOptions,
  ScopedApiKey,
} from '../types';

interface ListScopedApiKeysResponse {
  keys: ScopedApiKey[];
}

export class KeysClient {
  constructor(private readonly client: CoreClient) {}

  async create(
    params: CreateScopedApiKeyParams,
    options?: RequestOptions,
  ): Promise<CreatedScopedApiKey> {
    return this.client.request<CreatedScopedApiKey>('POST', '/v1/keys', params, undefined, options);
  }

  async list(options?: RequestOptions): Promise<ScopedApiKey[]> {
    const response = await this.client.request<ListScopedApiKeysResponse>(
      'GET',
      '/v1/keys',
      undefined,
      undefined,
      options,
    );
    return response.keys;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/keys/${id}`, undefined, undefined, options);
  }
}
