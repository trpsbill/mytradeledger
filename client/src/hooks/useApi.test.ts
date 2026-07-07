import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApi, useApiWithMeta } from './useApi';

// ─── useApi ───────────────────────────────────────────────────────────────────

describe('useApi', () => {
  it('starts with loading=true and data=null', () => {
    const { result } = renderHook(() =>
      useApi(() => new Promise(() => {}))
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates data and clears loading on success', async () => {
    const { result } = renderHook(() =>
      useApi(() => Promise.resolve({ data: [1, 2, 3] }))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears loading on rejection', async () => {
    const { result } = renderHook(() =>
      useApi(() => Promise.reject(new Error('network error')))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network error');
    expect(result.current.data).toBeNull();
  });

  it('falls back to "An error occurred" for non-Error rejections', async () => {
    const { result } = renderHook(() =>
      useApi(() => Promise.reject('plain string'))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('An error occurred');
  });

  it('refetch re-runs the fetcher and updates data', async () => {
    let callCount = 0;
    const { result } = renderHook(() =>
      useApi(() => Promise.resolve({ data: ++callCount }))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);

    result.current.refetch();
    await waitFor(() => expect(result.current.data).toBe(2));
  });
});

// ─── useApiWithMeta ───────────────────────────────────────────────────────────

describe('useApiWithMeta', () => {
  it('initialises with meta=null and loading=true', () => {
    const { result } = renderHook(() =>
      useApiWithMeta(() => new Promise(() => {}))
    );
    expect(result.current.meta).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('populates both data and meta from a successful fetch', async () => {
    const { result } = renderHook(() =>
      useApiWithMeta(() =>
        Promise.resolve({
          data: ['a', 'b'],
          meta: { total: 10, limit: 2, offset: 0 },
        })
      )
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['a', 'b']);
    expect(result.current.meta).toEqual({ total: 10, limit: 2, offset: 0 });
  });

  it('leaves meta=null when the response omits the meta field', async () => {
    const { result } = renderHook(() =>
      useApiWithMeta(() => Promise.resolve({ data: [] }))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('sets error and leaves meta=null on fetch failure', async () => {
    const { result } = renderHook(() =>
      useApiWithMeta(() => Promise.reject(new Error('network error')))
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network error');
    expect(result.current.meta).toBeNull();
  });

  it('clears meta when a refetch fails after a prior success', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ data: [], meta: { total: 5, limit: 25, offset: 0 } })
      .mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useApiWithMeta(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.meta).toEqual({ total: 5, limit: 25, offset: 0 });

    result.current.refetch();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.meta).toBeNull();
  });

  it('updates meta on each refetch', async () => {
    let page = 1;
    const fetcher = vi.fn(() =>
      Promise.resolve({
        data: [] as string[],
        meta: { total: 100, limit: 25, offset: (page - 1) * 25 },
      })
    );
    const { result } = renderHook(() => useApiWithMeta(fetcher, [page]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.meta?.offset).toBe(0);

    page = 2;
    result.current.refetch();
    await waitFor(() => expect(result.current.meta?.offset).toBe(25));
  });
});
