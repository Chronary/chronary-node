import type { CoreClient } from '../client';
import type { Usage, RequestOptions } from '../types';

export class UsageClient {
  constructor(private readonly client: CoreClient) {}

  async get(options?: RequestOptions): Promise<Usage> {
    return this.client.request<Usage>('GET', '/v1/usage', undefined, undefined, options);
  }
}
