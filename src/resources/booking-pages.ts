import type { APIPromise } from '../api-promise';
import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  BookingPage,
  CreateBookingPageParams,
  UpdateBookingPageParams,
  ListBookingPagesParams,
  ListBookingsParams,
  BookingList,
  BookingSlotsResponse,
  SubmitBookingParams,
  BookingSubmissionResult,
  PageResponse,
  RequestOptions,
} from '../types';

export class BookingPagesClient {
  constructor(private readonly client: CoreClient) {}

  create(params: CreateBookingPageParams, options?: RequestOptions): APIPromise<BookingPage> {
    return this.client.request<BookingPage>('POST', '/v1/booking-pages', params, undefined, options);
  }

  get(id: string, options?: RequestOptions): APIPromise<BookingPage> {
    return this.client.request<BookingPage>('GET', `/v1/booking-pages/${id}`, undefined, undefined, options);
  }

  list(params: ListBookingPagesParams = {}): PageIterator<BookingPage> {
    const { limit = 50, offset = 0, ...filters } = params;
    return new PageIterator<BookingPage>(
      (offset, l) =>
        this.client.request<PageResponse<BookingPage>>('GET', '/v1/booking-pages', undefined, {
          ...filters,
          limit: l,
          offset,
        }),
      limit,
      offset,
    );
  }

  update(id: string, params: UpdateBookingPageParams, options?: RequestOptions): APIPromise<BookingPage> {
    return this.client.request<BookingPage>('PATCH', `/v1/booking-pages/${id}`, params, undefined, options);
  }

  delete(id: string, options?: RequestOptions): APIPromise<void> {
    return this.client.request<void>('DELETE', `/v1/booking-pages/${id}`, undefined, undefined, options)._thenUnwrap(() => undefined);
  }

  /**
   * One page of the bookings made through a booking page, newest start first,
   * with the invitee's details. Pass the returned `next_cursor` as `cursor`
   * for the next page (null on the last page). Bookings made before this
   * endpoint was released are not linked to their page.
   */
  listBookings(id: string, params: ListBookingsParams = {}, options?: RequestOptions): APIPromise<BookingList> {
    return this.client.request<BookingList>('GET', `/v1/booking-pages/${id}/bookings`, undefined, { ...params }, options);
  }

  /**
   * Replace the page's public link. The old `/book/<slug>` stops working at
   * once; returns the page with its new `slug` and `booking_url`.
   */
  rotateSlug(id: string, options?: RequestOptions): APIPromise<BookingPage> {
    return this.client.request<BookingPage>('POST', `/v1/booking-pages/${id}/rotate-slug`, undefined, undefined, options);
  }

  /**
   * Public: list available slots for a booking page by its slug. No API key is
   * required for this endpoint (the slug is the credential); any key set on the
   * client is simply ignored by the server.
   */
  listSlots(slug: string, params: { from?: string; to?: string } = {}, options?: RequestOptions): APIPromise<BookingSlotsResponse> {
    return this.client.request<BookingSlotsResponse>('GET', `/book/${slug}/slots`, undefined, params, options);
  }

  /**
   * Public: submit a booking against a page's slug. Creates a confirmed event
   * on the underlying calendar and fires an `event.created` webhook with a
   * `booking_page_id` correlation field.
   */
  submit(slug: string, params: SubmitBookingParams, options?: RequestOptions): APIPromise<BookingSubmissionResult> {
    return this.client.request<BookingSubmissionResult>('POST', `/book/${slug}`, params, undefined, options);
  }
}
