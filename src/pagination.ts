import { ChronaryError } from './error';
import type { PageResponse, Page } from './types';

/**
 * Fetches one page. `cursor` is set when the iterator follows a `next_cursor`
 * (#2691); a list that accepts cursors sends it with `offset` 0 (the API
 * rejects a cursor combined with a non-zero offset).
 */
export type FetchPage<T> = (offset: number, limit: number, cursor?: string) => PromiseLike<PageResponse<T>>;

/**
 * Auto-paginating list result.
 *
 * Lists that return `next_cursor` (agents, calendars, and the org-wide events
 * list) are walked by cursor, so iteration is not limited by the API's cap on
 * `offset` (10,000). Lists without cursors are walked by offset.
 */
export class PageIterator<T> implements AsyncIterable<T> {
  private readonly fetchPage: FetchPage<T>;
  private readonly defaultLimit: number;
  private readonly initialOffset: number;

  constructor(
    fetchPage: FetchPage<T>,
    defaultLimit: number = 50,
    initialOffset: number = 0,
  ) {
    this.fetchPage = fetchPage;
    this.defaultLimit = defaultLimit;
    this.initialOffset = initialOffset;
  }

  /**
   * Fetch one page. Pass the previous page's `next_cursor` as `cursor` to
   * page past the offset cap on lists that have cursors (`offset` is then
   * ignored and sent as 0).
   */
  async getPage(offset: number = this.initialOffset, limit?: number, cursor?: string): Promise<Page<T>> {
    const l = limit ?? this.defaultLimit;
    const response = cursor ? await this.fetchPage(0, l, cursor) : await this.fetchPage(offset, l);
    const hasMore =
      response.next_cursor !== undefined
        ? response.next_cursor !== null
        : offset + response.data.length < response.total;
    return { ...response, hasMore };
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    let offset = this.initialOffset;
    let cursor: string | undefined;
    const limit = this.defaultLimit;

    while (true) {
      const page = cursor ? await this.fetchPage(0, limit, cursor) : await this.fetchPage(offset, limit);
      for (const item of page.data) {
        yield item;
      }
      if (page.data.length === 0) break;
      offset += page.data.length;
      // A list with cursors says `next_cursor` on every page: follow it, and
      // stop at null. Without one, page by offset until `total`.
      if (page.next_cursor !== undefined) {
        if (!page.next_cursor) break;
        // The cursor just sent coming back would page forever.
        if (page.next_cursor === cursor) {
          throw new ChronaryError('The API returned the same next_cursor twice; stopping.', 0);
        }
        cursor = page.next_cursor;
        continue;
      }
      if (offset >= page.total) break;
    }
  }
}
