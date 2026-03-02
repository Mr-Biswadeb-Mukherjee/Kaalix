import { afterEach, describe, expect, it } from 'vitest';
import { secureRandomFloat } from './secureRandom.js';

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const setCrypto = (value) => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    writable: true,
    value,
  });
};

afterEach(() => {
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  } else {
    delete globalThis.crypto;
  }
});

describe('secureRandomFloat', () => {
  it('returns 0 when random source is minimum', () => {
    setCrypto({
      getRandomValues(values) {
        values[0] = 0;
        return values;
      },
    });

    expect(secureRandomFloat()).toBe(0);
  });

  it('returns a value lower than 1 when random source is maximum', () => {
    setCrypto({
      getRandomValues(values) {
        values[0] = 0xffffffff;
        return values;
      },
    });

    const result = secureRandomFloat();
    expect(result).toBeLessThan(1);
    expect(result).toBeGreaterThan(0.999999999);
  });

  it('throws when Web Crypto API is unavailable', () => {
    setCrypto(undefined);
    expect(() => secureRandomFloat()).toThrow('Web Crypto API is unavailable in this environment.');
  });
});
