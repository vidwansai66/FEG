import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sportsClient } from './sportsClient.js';

describe('SportsClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should successfully call resolve endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'resolved', mockData: true })
    } as unknown as Response);

    const result = await sportsClient.resolve({ eventQuery: 'Chelsea' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: 'resolved', mockData: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/sports/resolve');
    expect(options.method).toBe('POST');
  });

  it('should correctly handle HTTP 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 'not_found' })
    } as unknown as Response);

    const result = await sportsClient.getOdds({ selectionIds: ['bad_id'] });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toEqual({ status: 'not_found' });
  });

  it('should correctly handle HTTP 409', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ status: 'validation_failed', code: 'ODDS_CHANGED' })
    } as unknown as Response);

    const result = await sportsClient.confirmDemoBet({ legs: [] });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toEqual({ status: 'validation_failed', code: 'ODDS_CHANGED' });
  });

  it('should correctly handle HTTP 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Unparseable json'); },
      statusText: 'Internal Server Error'
    } as unknown as Response);

    const result = await sportsClient.validateSlip({ legs: [] });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe('Internal Server Error');
  });

  it('should timeout if request takes too long', async () => {
    global.fetch = vi.fn().mockImplementation((url: RequestInfo | URL, options?: RequestInit) => {
      return new Promise((resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });
    
    const promise = sportsClient.resolve({ eventQuery: 'Chelsea' });
    
    await vi.advanceTimersByTimeAsync(5000);
    
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error.message).toContain('timed out after 5000ms');
  });

  it('should handle network failures gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));
    
    const result = await sportsClient.resolve({ eventQuery: 'Chelsea' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error.message).toBe('fetch failed');
  });
});
