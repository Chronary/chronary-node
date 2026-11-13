import type { APIPromise } from '../api-promise';
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

  create(
    params: CreateScopedApiKeyParams,
    options?: RequestOptions,
  ): APIPromise<CreatedScopedApiKey> {
    return this.client.request<CreatedScopedApiKey>('POST', '/v1/keys', params, undefined, options);
  }

  list(options?: RequestOptions): APIPromise<ScopedApiKey[]> {
    return this.client.request<ListScopedApiKeysResponse>(
      'GET',
      '/v1/keys',
      undefined,
      undefined,
      options,
    )._thenUnwrap((response) => response.keys);
  }

  delete(id: string, options?: RequestOptions): APIPromise<void> {
    return this.client.request<void>('DELETE', `/v1/keys/${id}`, undefined, undefined, options)._thenUnwrap(() => undefined);
  }
}
