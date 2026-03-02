import { describe, expect, it } from 'vitest';
import {
  getDomainFromEmail,
  getDomainFromWebsite,
  isWebsiteEmailDomainMatch,
} from './domainUtils.js';

describe('shared/domainUtils', () => {
  describe('getDomainFromEmail', () => {
    it('extracts and normalizes the domain from an email', () => {
      expect(getDomainFromEmail('  Admin@Example.COM  ')).toBe('example.com');
    });

    it('removes trailing dots in email domains', () => {
      expect(getDomainFromEmail('user@company.com...')).toBe('company.com');
    });

    it('returns an empty string for invalid email inputs', () => {
      expect(getDomainFromEmail('')).toBe('');
      expect(getDomainFromEmail('user@')).toBe('');
      expect(getDomainFromEmail('@company.com')).toBe('');
      expect(getDomainFromEmail('no-at-symbol')).toBe('');
    });
  });

  describe('getDomainFromWebsite', () => {
    it('extracts hostname without scheme and removes www', () => {
      expect(getDomainFromWebsite('WWW.Example.com/path')).toBe('example.com');
    });

    it('removes trailing dots in website hostnames', () => {
      expect(getDomainFromWebsite('https://portal.company.com.')).toBe('portal.company.com');
    });

    it('returns an empty string for invalid website inputs', () => {
      expect(getDomainFromWebsite('')).toBe('');
      expect(getDomainFromWebsite('not a url')).toBe('');
      expect(getDomainFromWebsite('http://')).toBe('');
    });
  });

  describe('isWebsiteEmailDomainMatch', () => {
    it('returns true when normalized domains match', () => {
      expect(isWebsiteEmailDomainMatch('https://www.example.com', 'user@example.com')).toBe(true);
    });

    it('returns false when domains do not match', () => {
      expect(isWebsiteEmailDomainMatch('https://example.com', 'user@other.com')).toBe(false);
    });

    it('returns true when one side is missing or invalid', () => {
      expect(isWebsiteEmailDomainMatch('', 'user@example.com')).toBe(true);
      expect(isWebsiteEmailDomainMatch('https://example.com', 'invalid')).toBe(true);
      expect(isWebsiteEmailDomainMatch('http://', 'user@example.com')).toBe(true);
    });
  });
});
