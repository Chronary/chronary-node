import type { CoreClient } from '../client';
import type { RequestOptions } from '../types';

export interface CreateConnectionLinkParams {
  capabilities: Array<'availability' | 'publishing'>;
  publication_policy?: 'none' | 'confirmed' | 'confirmed_tentative';
}

export type ConnectionLinkStatus = 'awaiting_human' | 'in_progress' | 'completed' | 'declined' | 'expired' | 'cancelled';

export interface ConnectionLink {
  id: string;
  calendar_id: string;
  setup_url?: string | null;
  status: ConnectionLinkStatus;
  expires_at: string;
  connection_id?: string | null;
  reused?: boolean;
  requesting_agent_id?: string | null;
  requested_capabilities?: Array<'availability' | 'publishing'>;
  requested_publication_policy?: 'confirmed' | 'confirmed_tentative' | null;
  created_at?: string;
}

export interface ListConnectionLinksParams {
  status?: ConnectionLinkStatus;
  calendar_id?: string;
  /** 1–100, default 50. */
  limit?: number;
}

export class ConnectionLinksClient {
  constructor(private readonly client: CoreClient) {}

  async create(calendarId: string, params: CreateConnectionLinkParams, options?: RequestOptions): Promise<ConnectionLink> {
    return this.client.request<ConnectionLink>('POST', `/v1/calendars/${calendarId}/connection-links`, params, undefined, options);
  }

  /** Setup links, newest first. An agent-scoped key sees only its own calendars' links. */
  async list(params: ListConnectionLinksParams = {}, options?: RequestOptions): Promise<{ data: ConnectionLink[] }> {
    const { status, calendar_id, limit } = params;
    return this.client.request<{ data: ConnectionLink[] }>(
      'GET',
      '/v1/connection-links',
      undefined,
      { ...(status !== undefined && { status }), ...(calendar_id !== undefined && { calendar_id }), ...(limit !== undefined && { limit }) },
      options,
    );
  }

  async get(id: string, options?: RequestOptions): Promise<ConnectionLink> {
    return this.client.request<ConnectionLink>('GET', `/v1/connection-links/${id}`, undefined, undefined, options);
  }

  async cancel(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/connection-links/${id}`, undefined, undefined, options);
  }
}
