import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  Calendar,
  CreateCalendarParams,
  UpdateCalendarParams,
  ListCalendarsParams,
  CalendarContext,
  AvailabilityRules,
  SetAvailabilityRulesParams,
  PageResponse,
  RequestOptions,
} from '../types';

export class CalendarsClient {
  constructor(private readonly client: CoreClient) {}

  async create(params: CreateCalendarParams & { agentId?: string }, options?: RequestOptions): Promise<Calendar> {
    const { agentId, ...body } = params;
    const path = agentId ? `/v1/agents/${agentId}/calendars` : '/v1/calendars';
    return this.client.request<Calendar>('POST', path, body, undefined, options);
  }

  async get(id: string, options?: RequestOptions): Promise<Calendar> {
    return this.client.request<Calendar>('GET', `/v1/calendars/${id}`, undefined, undefined, options);
  }

  list(params: ListCalendarsParams = {}): PageIterator<Calendar> {
    const { agentId, limit = 50, ...filters } = params;
    const path = agentId ? `/v1/agents/${agentId}/calendars` : '/v1/calendars';
    return new PageIterator<Calendar>(
      (offset, l) =>
        this.client.request<PageResponse<Calendar>>('GET', path, undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
    );
  }

  async update(id: string, params: UpdateCalendarParams, options?: RequestOptions): Promise<Calendar> {
    return this.client.request<Calendar>('PATCH', `/v1/calendars/${id}`, params, undefined, options);
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/calendars/${id}`, undefined, undefined, options);
  }

  async getContext(id: string, options?: RequestOptions): Promise<CalendarContext> {
    return this.client.request<CalendarContext>(
      'GET', `/v1/calendars/${id}/context`, undefined, undefined, options,
    );
  }

  async setAvailabilityRules(
    id: string,
    params: SetAvailabilityRulesParams,
    options?: RequestOptions,
  ): Promise<AvailabilityRules> {
    return this.client.request<AvailabilityRules>(
      'PUT', `/v1/calendars/${id}/availability-rules`, params, undefined, options,
    );
  }

  async getAvailabilityRules(id: string, options?: RequestOptions): Promise<AvailabilityRules> {
    return this.client.request<AvailabilityRules>(
      'GET', `/v1/calendars/${id}/availability-rules`, undefined, undefined, options,
    );
  }

  async deleteAvailabilityRules(id: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>(
      'DELETE', `/v1/calendars/${id}/availability-rules`, undefined, undefined, options,
    );
  }
}
