import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  ListEventsParams,
  DeleteEventOptions,
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

  /**
   * Delete an event (or, for a recurring series, the whole series). Pass
   * `occurrence_start` to cancel just one occurrence of a recurring series
   * instead — the series lives on and the updated series master is returned.
   * Plain deletes resolve to void. With `occurrence_start`, fails with 400 if
   * the timestamp is not an active occurrence, or 409 if the event is not a
   * recurring series.
   */
  async delete(calendarId: string, eventId: string, options?: DeleteEventOptions): Promise<CalendarEvent | void> {
    const { occurrence_start, ...requestOptions } = options ?? {};
    return this.client.request<CalendarEvent | void>(
      'DELETE',
      `/v1/calendars/${calendarId}/events/${eventId}`,
      undefined,
      occurrence_start !== undefined ? { occurrence_start } : undefined,
      requestOptions,
    );
  }

  /**
   * Fetch an event by ID alone. The calendar is resolved internally from the
   * event, so no calendar ID is required.
   */
  async getById(eventId: string, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'GET', `/v1/events/${eventId}`, undefined, undefined, options,
    );
  }

  /**
   * Update an event by ID alone. The calendar is resolved internally from the
   * event, so no calendar ID is required.
   */
  async updateById(eventId: string, params: UpdateEventParams, options?: RequestOptions): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(
      'PATCH', `/v1/events/${eventId}`, params, undefined, options,
    );
  }

  /**
   * Delete an event by ID alone. The calendar is resolved internally from the
   * event, so no calendar ID is required. Pass `occurrence_start` to cancel
   * just one occurrence of a recurring series — the series lives on and the
   * updated series master is returned; plain deletes resolve to void. With
   * `occurrence_start`, fails with 400 if the timestamp is not an active
   * occurrence, or 409 if the event is not a recurring series.
   */
  async deleteById(eventId: string, options?: DeleteEventOptions): Promise<CalendarEvent | void> {
    const { occurrence_start, ...requestOptions } = options ?? {};
    return this.client.request<CalendarEvent | void>(
      'DELETE',
      `/v1/events/${eventId}`,
      undefined,
      occurrence_start !== undefined ? { occurrence_start } : undefined,
      requestOptions,
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
