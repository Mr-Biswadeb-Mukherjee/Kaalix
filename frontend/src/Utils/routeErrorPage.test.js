import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRouteErrorDetails, getFallbackErrorDetails } from './routeErrorPage.js';

const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

const setFetch = (value) => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value,
  });
};

afterEach(() => {
  if (originalFetchDescriptor) {
    Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
  } else {
    delete globalThis.fetch;
  }
});

const mockResponse = ({ ok = true, status = 200, statusText = 'OK', payload = {} } = {}) => ({
  ok,
  status,
  statusText,
  json: async () => payload,
});

describe('frontend routeErrorPage', () => {
  it('builds fallback details with normalized status code', () => {
    expect(getFallbackErrorDetails('invalid')).toEqual({
      status: 500,
      code: 'HTTP_500_ERROR',
      title: 'Request failed',
      message: 'Request failed.',
    });
  });

  it('returns backend route error details when API call succeeds', async () => {
    const fetchSpy = vi.fn(async () =>
      mockResponse({
        ok: true,
        payload: {
          success: true,
          error: {
            title: 'Route missing',
            message: 'The requested endpoint does not exist.',
          },
        },
      })
    );
    setFetch(fetchSpy);

    const result = await fetchRouteErrorDetails(404);

    expect(fetchSpy).toHaveBeenCalledWith('/api/v3/errors/404', { method: 'GET' });
    expect(result).toEqual({
      status: 404,
      code: 'HTTP_404_ERROR',
      title: 'Route missing',
      message: 'The requested endpoint does not exist.',
    });
  });

  it('returns normalized backend error display when API response fails', async () => {
    setFetch(
      vi.fn(async () =>
        mockResponse({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          payload: {
            code: 'TOO_MANY_REQUESTS',
            title: 'Retry later',
            message: 'Rate limit exceeded',
          },
        })
      )
    );

    const result = await fetchRouteErrorDetails(429);

    expect(result).toEqual({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      title: 'Retry later',
      message: 'Rate limit exceeded',
    });
  });

  it('falls back to generic details when network request throws', async () => {
    setFetch(
      vi.fn(async () => {
        throw new Error('Network down');
      })
    );

    const result = await fetchRouteErrorDetails(403);
    expect(result).toEqual(getFallbackErrorDetails(403));
  });
});
