import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractEmailDomain,
  isBusinessEmail,
  isPersonalEmail,
  isStrictBusinessEmailModeEnabled,
} from './emailPolicy.utils.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('backend/emailPolicy.utils', () => {
  describe('isStrictBusinessEmailModeEnabled', () => {
    it('defaults to enabled when env variable is missing', () => {
      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', undefined);
      expect(isStrictBusinessEmailModeEnabled()).toBe(true);
    });

    it('treats false-like values as disabled', () => {
      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', 'false');
      expect(isStrictBusinessEmailModeEnabled()).toBe(false);

      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', 'off');
      expect(isStrictBusinessEmailModeEnabled()).toBe(false);

      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', '0');
      expect(isStrictBusinessEmailModeEnabled()).toBe(false);
    });

    it('keeps strict mode enabled for truthy values', () => {
      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', 'true');
      expect(isStrictBusinessEmailModeEnabled()).toBe(true);

      vi.stubEnv('STRICT_BUSINESS_EMAIL_ONLY', 'yes');
      expect(isStrictBusinessEmailModeEnabled()).toBe(true);
    });
  });

  describe('extractEmailDomain', () => {
    it('extracts a normalized email domain', () => {
      expect(extractEmailDomain(' User@Example.COM ')).toBe('example.com');
    });

    it('returns an empty string for invalid values', () => {
      expect(extractEmailDomain('missing-at-symbol')).toBe('');
      expect(extractEmailDomain('user@')).toBe('');
      expect(extractEmailDomain(null)).toBe('');
    });
  });

  describe('domain classification', () => {
    it('detects personal email providers', () => {
      expect(isPersonalEmail('person@gmail.com')).toBe(true);
      expect(isPersonalEmail('PERSON@HOTMAIL.COM')).toBe(true);
    });

    it('accepts valid business emails only', () => {
      expect(isBusinessEmail('dev@company.io')).toBe(true);
      expect(isBusinessEmail('person@gmail.com')).toBe(false);
      expect(isBusinessEmail('invalid-email')).toBe(false);
      expect(isBusinessEmail(null)).toBe(false);
    });
  });
});
