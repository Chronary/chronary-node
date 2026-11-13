import type { APIPromise } from '../api-promise';
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

  create(params: CreateCalendarParams & { agentId?: string }, options?: RequestOptions): APIPromise<Calendar> {
    const { agentId, ...body } = params;
    const path = agentId ? `/v1/agents/${agentId}/calendars` : '/v1/calendars';
    return this.client.request<Calendar>('POST', path, body, undefined, options);
  }

  get(id: string, options?: RequestOptions): APIPromise<Calendar> {
    return this.client.request<Calendar>('GET', `/v1/calendars/${id}`, undefined, undefined, options);
  }

  list(params: ListCalendarsParams = {}): PageIterator<Calendar> {
    const { agentId, limit = 50, offset = 0, ...filters } = params;
    const path = agentId ? `/v1/agents/${agentId}/calendars` : '/v1/calendars';
    return new PageIterator<Calendar>(
      (offset, l) =>
        this.client.request<PageResponse<Calendar>>('GET', path, undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
      offset,
    );
  }

  update(id: string, params: UpdateCalendarParams, options?: RequestOptions): APIPromise<Calendar> {
    return this.client.request<Calendar>('PATCH', `/v1/calendars/${id}`, params, undefined, options);
  }

  delete(id: string, options?: RequestOptions): APIPromise<void> {
    return this.client.request<void>('DELETE', `/v1/calendars/${id}`, undefined, undefined, options)._thenUnwrap(() => undefined);
  }

  /**
   * Regenerate the calendar's iCal subscribe URL. The old URL stops working
   * (copies cached elsewhere can be served for up to 5 minutes); returns the
   * calendar with its new `ical_url`. Organization keys only.
   */
  rotateIcalToken(id: string, options?: RequestOptions): APIPromise<Calendar> {
    return this.client.request<Calendar>('POST', `/v1/calendars/${id}/ical-token/rotate`, undefined, undefined, options);
  }

  getContext(id: string, options?: RequestOptions): APIPromise<CalendarContext> {
    return this.client.request<CalendarContext>(
      'GET', `/v1/calendars/${id}/context`, undefined, undefined, options,
    );
  }

  setAvailabilityRules(
    id: string,
    params: SetAvailabilityRulesParams,
    options?: RequestOptions,
  ): APIPromise<AvailabilityRules> {
    return this.client.request<AvailabilityRules>(
      'PUT', `/v1/calendars/${id}/availability-rules`, params, undefined, options,
    );
  }

  getAvailabilityRules(id: string, options?: RequestOptions): APIPromise<AvailabilityRules> {
    return this.client.request<AvailabilityRules>(
      'GET', `/v1/calendars/${id}/availability-rules`, undefined, undefined, options,
    );
  }

  deleteAvailabilityRules(id: string, options?: RequestOptions): APIPromise<void> {
    return this.client.request<void>(
      'DELETE', `/v1/calendars/${id}/availability-rules`, undefined, undefined, options,
    )._thenUnwrap(() => undefined);
  }
}
