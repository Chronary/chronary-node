import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import type { AuditLogResponse, ListAuditLogParams, RequestOptions } from '../types';

export class AuditLogClient {
  constructor(private readonly client: CoreClient) {}

  list(params?: ListAuditLogParams, options?: RequestOptions): APIPromise<AuditLogResponse> {
    // CoreClient.request serializes the query map into the URL; passing
    // `undefined` values strips them. Keeps the path literal static so the
    // surface-coverage audit script can match it against the canonical route.
    const query: Record<string, string | number | boolean | undefined> = {
      from: params?.from,
      to: params?.to,
      action: params?.action,
      actor_key_prefix: params?.actor_key_prefix,
      actor_type: params?.actor_type,
      actor_id: params?.actor_id,
      request_id: params?.request_id,
      resource: params?.resource,
      status_class: params?.status_class,
      category: params?.category,
      cursor: params?.cursor,
      limit: params?.limit,
    };
    return this.client.request<AuditLogResponse>('GET', '/v1/audit-log', undefined, query, options);
  }
}
