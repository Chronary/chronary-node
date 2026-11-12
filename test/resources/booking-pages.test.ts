import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const PAGE = {
  id: 'bkp_abc123',
  org_id: 'org-1',
  calendar_id: 'cal_abc123',
  agent_id: null,
  slug: 'a1b2c3d4e5f6g7h8i9j0k1',
  title: 'Intro call',
  description: null,
  duration_minutes: 30,
  buffer_minutes: 0,
  window_days: 14,
  min_notice_minutes: 0,
  timezone: 'UTC',
  availability_constraints: null,
  active: true,
  bookings_count: 1,
  booking_url: 'https://api.chronary.ai/book/a1b2c3d4e5f6g7h8i9j0k1',
  created_at: '2026-07-14T10:00:00.000Z',
  updated_at: '2026-07-14T10:00:00.000Z',
};

const BOOKING = {
  id: 'evt_abc123',
  booking_page_id: 'bkp_abc123',
  calendar_id: 'cal_abc123',
  start_time: '2026-07-15T16:00:00.000Z',
  end_time: '2026-07-15T16:30:00.000Z',
  status: 'confirmed',
  invitee_name: 'Ada',
  invitee_email: 'ada@example.com',
  invitee_notes: null,
  created_at: '2026-07-14T10:00:00.000Z',
};

describe('BookingPagesClient (#1202)', () => {
  it('list passes calendar_id', async () => {
    const fetch = mockFetch([{ status: 200, body: { data: [PAGE], total: 1, limit: 50, offset: 0 } }]);
    const client = new Chronary(clientConfig(fetch));

    await client.bookingPages.list({ calendar_id: 'cal_abc123' }).getPage();
    expect(fetch.mock.calls[0][0]).toContain('/v1/booking-pages?');
    expect(fetch.mock.calls[0][0]).toContain('calendar_id=cal_abc123');
  });

  it('listBookings GETs one page with limit and cursor', async () => {
    const fetch = mockFetch([{ status: 200, body: { data: [BOOKING], next_cursor: 'next' } }]);
    const client = new Chronary(clientConfig(fetch));

    const page = await client.bookingPages.listBookings('bkp_abc123', { limit: 10, cursor: 'abc' });
    const url = fetch.mock.calls[0][0] as string;
    expect(fetch.mock.calls[0][1]?.method).toBe('GET');
    expect(url).toContain('/v1/booking-pages/bkp_abc123/bookings');
    expect(url).toContain('limit=10');
    expect(url).toContain('cursor=abc');
    expect(page.data[0].invitee_email).toBe('ada@example.com');
    expect(page.next_cursor).toBe('next');
  });

  it('listBookings sends no query params by default', async () => {
    const fetch = mockFetch([{ status: 200, body: { data: [], next_cursor: null } }]);
    const client = new Chronary(clientConfig(fetch));

    const page = await client.bookingPages.listBookings('bkp_abc123');
    expect(fetch.mock.calls[0][0]).not.toContain('?');
    expect(page.next_cursor).toBeNull();
  });

  it('rotateSlug POSTs to /v1/booking-pages/:id/rotate-slug', async () => {
    const rotated = { ...PAGE, slug: 'newslug', booking_url: 'https://api.chronary.ai/book/newslug' };
    const fetch = mockFetch([{ status: 200, body: rotated }]);
    const client = new Chronary(clientConfig(fetch));

    const page = await client.bookingPages.rotateSlug('bkp_abc123');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
    expect(fetch.mock.calls[0][0]).toContain('/v1/booking-pages/bkp_abc123/rotate-slug');
    expect(page.booking_url).toBe('https://api.chronary.ai/book/newslug');
  });
});
