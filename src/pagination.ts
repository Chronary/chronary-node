import type { PageResponse, Page } from './types';

export class PageIterator<T> implements AsyncIterable<T> {
  private readonly fetchPage: (offset: number, limit: number) => PromiseLike<PageResponse<T>>;
  private readonly defaultLimit: number;
  private readonly initialOffset: number;

  constructor(
    fetchPage: (offset: number, limit: number) => PromiseLike<PageResponse<T>>,
    defaultLimit: number = 50,
    initialOffset: number = 0,
  ) {
    this.fetchPage = fetchPage;
    this.defaultLimit = defaultLimit;
    this.initialOffset = initialOffset;
  }

  async getPage(offset: number = this.initialOffset, limit?: number): Promise<Page<T>> {
    const l = limit ?? this.defaultLimit;
    const response = await this.fetchPage(offset, l);
    return {
      ...response,
      hasMore: offset + response.data.length < response.total,
    };
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    let offset = this.initialOffset;
    const limit = this.defaultLimit;

    while (true) {
      const page = await this.fetchPage(offset, limit);
      for (const item of page.data) {
        yield item;
      }
      offset += page.data.length;
      if (offset >= page.total || page.data.length === 0) break;
    }
  }
}
