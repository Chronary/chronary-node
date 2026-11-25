import { describe, expect, it, vi } from 'vitest';
import { Chronary } from '../src/index';
import { clientConfig } from './helpers';

// bughunt-BH-080 (#2691): with NOC_QUERY_CAPS on, every list rejects
// `offset > 10000` with 400 validation_error. The auto-pagers paged by offset
// only, so iterating more than 10,000 rows threw partway, even on lists that
// return `next_cursor`. They now follow `next_cursor` where the list has one.

const MAX_OFFSET = 10_000;
const ROWS = 12_000;

interface Seen {
  offsets: number[];
  cursors: string[];
}

/**
 * A fake API holding ROWS rows that enforces the deep-offset cap.
 * `withCursor` lists return `next_cursor` (base64 of the next index, null on
 * the last page) and accept `cursor`, rejecting cursor plus a non-zero offset
 * as the API does; the others are offset-only and carry no `next_cursor`.
 */
function cappedApi(withCursor: (path: string) => boolean, seen: Seen) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const cursor = url.searchParams.get('cursor');
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (offset > MAX_OFFSET) {
      return json(400, { error: { type: 'validation_error', message: 'offset must be at most 10000', param: 'offset' } });
    }
    const cursorList = withCursor(url.pathname);
    if (cursor !== null && (!cursorList || offset > 0)) {
      return json(400, { error: { type: 'validation_error', message: 'cursor and offset cannot be combined' } });
    }
    seen.offsets.push(offset);
    if (cursor !== null) seen.cursors.push(cursor);

    const start = cursor !== null ? Number(atob(cursor)) : offset;
    const data = Array.from({ length: Math.max(0, Math.min(limit, ROWS - start)) }, (_, i) => ({ id: `row_${start + i}` }));
    const next = start + data.length;
    const body: Record<string, unknown> = { data, total: ROWS, limit, offset };
    if (cursorList) body.next_cursor = next < ROWS ? btoa(String(next)) : null;
    return json(200, body);
  });
}

const allCursor = () => true;

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe('bughunt-BH-080 auto-pagination past the 10,000-row offset cap', () => {
  it('events.listAll() yields all 12,000 rows by following next_cursor', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(allCursor, seen) as unknown as typeof fetch));

    const rows = await collect(client.events.listAll({ limit: 100 }));
    expect(rows).toHaveLength(ROWS);
    expect(new Set(rows.map((r) => r.id)).size).toBe(ROWS);
    expect(Math.max(...seen.offsets)).toBe(0);
    expect(seen.cursors).toHaveLength(ROWS / 100 - 1);
  });

  it('agents.list() and calendars.list() (org and agent-scoped) follow next_cursor', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(allCursor, seen) as unknown as typeof fetch));

    expect(await collect(client.agents.list({ limit: 200 }))).toHaveLength(ROWS);
    expect(await collect(client.calendars.list({ limit: 200 }))).toHaveLength(ROWS);
    expect(await collect(client.calendars.list({ agentId: 'agt_1', limit: 200 }))).toHaveLength(ROWS);
  });

  it('drops a caller-supplied starting offset once it switches to a cursor', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(allCursor, seen) as unknown as typeof fetch));

    const rows = await collect(client.events.listAll({ limit: 1000, offset: 500 }));
    expect(rows).toHaveLength(ROWS - 500);
    expect(rows[0].id).toBe('row_500');
    expect(seen.offsets).toEqual([500, ...Array(seen.offsets.length - 1).fill(0)]);
  });

  it('starts from a caller-supplied cursor', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(allCursor, seen) as unknown as typeof fetch));

    const rows = await collect(client.agents.list({ limit: 200, cursor: btoa('11000') }));
    expect(rows).toHaveLength(1000);
    expect(rows[0].id).toBe('row_11000');
  });

  it('getPage() returns next_cursor and takes a cursor for the next page', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(allCursor, seen) as unknown as typeof fetch));

    const iter = client.events.listAll({ limit: 100 });
    const first = await iter.getPage();
    expect(first.next_cursor).toBe(btoa('100'));
    expect(first.hasMore).toBe(true);
    const second = await iter.getPage(0, 100, first.next_cursor!);
    expect(second.data[0].id).toBe('row_100');
    const last = await iter.getPage(0, 100, btoa('11900'));
    expect(last.next_cursor).toBeNull();
    expect(last.hasMore).toBe(false);
  });

  it('a list without cursors still pages by offset (and stops at total)', async () => {
    const seen: Seen = { offsets: [], cursors: [] };
    const client = new Chronary(clientConfig(cappedApi(() => false, seen) as unknown as typeof fetch));

    const rows = await collect(client.events.list({ calendarId: 'cal_1', limit: 2000 }));
    // Offset-only: everything up to the cap is reachable; offset 12,000 is never asked for.
    expect(rows).toHaveLength(ROWS);
    expect(seen.cursors).toEqual([]);
    expect(seen.offsets).toEqual([0, 2000, 4000, 6000, 8000, 10_000]);
  });

  it('stops with an error when a list returns the cursor it was just sent', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'a' }], total: 5, limit: 1, offset: 0, next_cursor: 'same' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Chronary(clientConfig(fetch as unknown as typeof globalThis.fetch));
    await expect(collect(client.agents.list({ limit: 1 }))).rejects.toThrow(/same next_cursor/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
