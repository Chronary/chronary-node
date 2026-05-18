import type { CoreClient } from '../client';
import type { AuditLogResponse, ListAuditLogParams, RequestOptions } from '../types';

export class AuditLogClient {
  constructor(private readonly client: CoreClient) {}

  async list(params?: ListAuditLogParams, options?: RequestOptions): Promise<AuditLogResponse> {
    // CoreClient.request serializes the query map into the URL; passing
    // `undefined` values strips them. Keeps the path literal static so the
    // surface-coverage audit script can match it against the canonical route.
    const query: Record<string, string | number | boolean | undefined> = {
      from: params?.from,
      to: params?.to,
      action: params?.action,
      actor_key_prefix: params?.actor_key_prefix,
      cursor: params?.cursor,
      limit: params?.limit,
    };
    return this.client.request<AuditLogResponse>('GET', '/v1/audit-log', undefined, query, options);
  }
}
