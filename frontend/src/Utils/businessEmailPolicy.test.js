import { describe, expect, it } from 'vitest';
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
  isValidEmailFormat,
} from './businessEmailPolicy.js';

describe('frontend businessEmailPolicy', () => {
  it('exports a stable business-email validation message', () => {
    expect(BUSINESS_EMAIL_REQUIRED_MESSAGE).toContain('business email');
  });

  describe('isValidEmailFormat', () => {
    it('accepts a valid business email format', () => {
      expect(isValidEmailFormat('admin@company.com')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(isValidEmailFormat('')).toBe(false);
      expect(isValidEmailFormat('no-at-symbol')).toBe(false);
      expect(isValidEmailFormat('user@localhost')).toBe(false);
      expect(isValidEmailFormat('user@@company.com')).toBe(false);
      expect(isValidEmailFormat(' user @company.com ')).toBe(false);
    });
  });

  describe('isPersonalEmail', () => {
    it('detects known personal providers', () => {
      expect(isPersonalEmail('person@gmail.com')).toBe(true);
      expect(isPersonalEmail('PERSON@OUTLOOK.COM')).toBe(true);
    });

    it('returns false for business domains or invalid values', () => {
      expect(isPersonalEmail('engineer@company.org')).toBe(false);
      expect(isPersonalEmail('invalid-email')).toBe(false);
      expect(isPersonalEmail(null)).toBe(false);
    });
  });
});
