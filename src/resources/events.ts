import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  ListEventsParams,
  PageResponse,
  RequestOptions,
} from '../types';

export class EventsClient {
  constructor(private readonly client: CoreClient) {}

  async create(calendarId: string, params: CreateEventParams, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'POST', `/v1/calendars/${calendarId}/events`, params, undefined, options,
    );
  }

  async get(calendarId: string, eventId: string, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'GET', `/v1/calendars/${calendarId}/events/${eventId}`, undefined, undefined, options,
    );
  }

  list(params: ListEventsParams = {}): PageIterator<CalendarEvent> {
    const { calendarId, agentId, limit = 50, offset = 0, ...filters } = params;

    let path: string;
    if (agentId) {
      path = `/v1/agents/${agentId}/events`;
    } else if (calendarId) {
      path = `/v1/calendars/${calendarId}/events`;
    } else {
      throw new Error('Either calendarId or agentId is required for events.list()');
    }

    return new PageIterator<CalendarEvent>(
      (offset, l) =>
        this.client.request<PageResponse<CalendarEvent>>('GET', path, undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
      offset,
    );
  }

  async update(calendarId: string, eventId: string, params: UpdateEventParams, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'PATCH', `/v1/calendars/${calendarId}/events/${eventId}`, params, undefined, options,
    );
  }

  async delete(calendarId: string, eventId: string, options?: RequestOptions): Promise<void> {
    await this.client.request<void>(
      'DELETE', `/v1/calendars/${calendarId}/events/${eventId}`, undefined, undefined, options,
    );
  }

  /**
   * Promote a held event (status='hold') to status='confirmed'. Fails with 409
   * if the event is not a hold, or if the hold has already expired.
   */
  async confirm(eventId: string, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'PUT', `/v1/events/${eventId}/confirm`, undefined, undefined, options,
    );
  }

  /**
   * Manually release a held event before its TTL, freeing the slot. Fails with
   * 409 if the event is not a hold.
   */
  async release(eventId: string, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'PUT', `/v1/events/${eventId}/release`, undefined, undefined, options,
    );
  }
}
