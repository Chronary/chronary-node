import { describe, it, expect, vi } from 'vitest';
import { PageIterator } from '../src/pagination';
import type { PageResponse } from '../src/types';

describe('PageIterator', () => {
  it('iterates through all pages', async () => {
    const fetchPage = vi.fn(async (offset: number, limit: number): Promise<PageResponse<{ id: number }>> => {
      if (offset === 0) return { data: [{ id: 1 }, { id: 2 }], total: 5, limit, offset };
      if (offset === 2) return { data: [{ id: 3 }, { id: 4 }], total: 5, limit, offset };
      return { data: [{ id: 5 }], total: 5, limit, offset };
    });

    const iter = new PageIterator(fetchPage, 2);
    const items: { id: number }[] = [];

    for await (const item of iter) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('handles empty results', async () => {
    const fetchPage = vi.fn(async (): Promise<PageResponse<{ id: number }>> => ({
      data: [],
      total: 0,
      limit: 50,
      offset: 0,
    }));

    const iter = new PageIterator(fetchPage);
    const items: { id: number }[] = [];

    for await (const item of iter) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it('handles single page', async () => {
    const fetchPage = vi.fn(async (): Promise<PageResponse<string>> => ({
      data: ['a', 'b'],
      total: 2,
      limit: 50,
      offset: 0,
    }));

    const iter = new PageIterator(fetchPage);
    const items: string[] = [];

    for await (const item of iter) {
      items.push(item);
    }

    expect(items).toEqual(['a', 'b']);
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it('getPage returns Page with hasMore', async () => {
    const fetchPage = vi.fn(async (): Promise<PageResponse<string>> => ({
      data: ['a', 'b'],
      total: 5,
      limit: 2,
      offset: 0,
    }));

    const iter = new PageIterator(fetchPage, 2);
    const page = await iter.getPage();

    expect(page.data).toEqual(['a', 'b']);
    expect(page.total).toBe(5);
    expect(page.hasMore).toBe(true);
  });

  it('getPage hasMore is false on last page', async () => {
    const fetchPage = vi.fn(async (): Promise<PageResponse<string>> => ({
      data: ['c'],
      total: 3,
      limit: 2,
      offset: 2,
    }));

    const iter = new PageIterator(fetchPage, 2);
    const page = await iter.getPage(2);

    expect(page.hasMore).toBe(false);
  });

  it('respects custom limit', async () => {
    const fetchPage = vi.fn(async (_offset: number, limit: number): Promise<PageResponse<number>> => ({
      data: [1],
      total: 1,
      limit,
      offset: 0,
    }));

    const iter = new PageIterator(fetchPage, 10);
    for await (const _ of iter) { /* consume */ }

    expect(fetchPage).toHaveBeenCalledWith(0, 10);
  });
});
