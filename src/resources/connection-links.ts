import type { CoreClient } from '../client';
import type { RequestOptions } from '../types';

export interface CreateConnectionLinkParams {
  capabilities: Array<'availability' | 'publishing'>;
  publication_policy?: 'none' | 'confirmed' | 'confirmed_tentative';
}

export interface ConnectionLink {
  id: string;
  calendar_id: string;
  setup_url?: string | null;
  status: 'awaiting_human' | 'in_progress' | 'completed' | 'declined' | 'expired' | 'cancelled';
  expires_at: string;
  connection_id?: string | null;
  reused?: boolean;
}

export class ConnectionLinksClient {
  constructor(private readonly client: CoreClient) {}

  async create(calendarId: string, params: CreateConnectionLinkParams, options?: RequestOptions): Promise<ConnectionLink> {
    return this.client.request<ConnectionLink>('POST', `/v1/calendars/${calendarId}/connection-links`, params, undefined, options);
  }

  async get(id: string, options?: RequestOptions): Promise<ConnectionLink> {
    return this.client.request<ConnectionLink>('GET', `/v1/connection-links/${id}`, undefined, undefined, options);
  }

  async cancel(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/connection-links/${id}`, undefined, undefined, options);
  }
}
