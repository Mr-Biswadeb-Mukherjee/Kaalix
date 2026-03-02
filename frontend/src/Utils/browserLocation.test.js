import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

const setNavigator = (value) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value,
  });
};

const setFetch = (value) => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value,
  });
};

const loadModule = async () => {
  vi.resetModules();
  return import('./browserLocation.js');
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  } else {
    delete globalThis.navigator;
  }

  if (originalFetchDescriptor) {
    Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
  } else {
    delete globalThis.fetch;
  }
});

describe('frontend browserLocation', () => {
  it('returns null when geolocation API is unavailable', async () => {
    setNavigator({});
    const { getBrowserLocationLabel } = await loadModule();

    await expect(getBrowserLocationLabel()).resolves.toBeNull();
  });

  it('returns coordinate fallback when reverse geocode fails', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition(resolve) {
          resolve({
            coords: { latitude: 12.345678, longitude: 98.7654321 },
          });
        },
      },
    });

    const fetchSpy = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    }));
    setFetch(fetchSpy);

    const { getBrowserLocationLabel } = await loadModule();
    const result = await getBrowserLocationLabel();

    expect(result).toBe('12.34568, 98.76543');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches successful label and avoids duplicate lookups', async () => {
    const geoSpy = vi.fn((resolve) =>
      resolve({
        coords: { latitude: 22.5726, longitude: 88.3639 },
      })
    );
    setNavigator({ geolocation: { getCurrentPosition: geoSpy } });

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        address: {
          city: 'Kolkata',
          country: 'India',
        },
      }),
    }));
    setFetch(fetchSpy);

    const { getBrowserLocationLabel } = await loadModule();

    const first = await getBrowserLocationLabel();
    const second = await getBrowserLocationLabel();

    expect(first).toBe('Kolkata, India');
    expect(second).toBe('Kolkata, India');
    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('applies failure cooldown after a geolocation error', async () => {
    const geoSpy = vi.fn((_, reject) => reject(new Error('Denied')));
    setNavigator({ geolocation: { getCurrentPosition: geoSpy } });
    setFetch(vi.fn());

    const { getBrowserLocationLabel } = await loadModule();

    const first = await getBrowserLocationLabel();
    const second = await getBrowserLocationLabel();

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(geoSpy).toHaveBeenCalledTimes(1);
  });
});
