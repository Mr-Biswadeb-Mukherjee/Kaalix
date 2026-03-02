import { describe, expect, it } from 'vitest';
import {
  getDomainFromEmail,
  getDomainFromWebsite,
  isWebsiteEmailDomainMatch,
} from './domain.utils.js';

describe('backend/domain.utils re-export', () => {
  it('extracts a normalized domain from email values', () => {
    expect(getDomainFromEmail(' Admin@Example.COM. ')).toBe('example.com');
    expect(getDomainFromEmail('missing-at')).toBe('');
  });

  it('extracts website domain and removes leading www', () => {
    expect(getDomainFromWebsite('https://www.Example.com/path')).toBe('example.com');
    expect(getDomainFromWebsite('')).toBe('');
  });

  it('matches website and email domains when both are valid', () => {
    expect(isWebsiteEmailDomainMatch('company.io', 'user@company.io')).toBe(true);
    expect(isWebsiteEmailDomainMatch('company.io', 'user@other.io')).toBe(false);
  });

  it('returns true when one side is invalid or missing', () => {
    expect(isWebsiteEmailDomainMatch('', 'user@company.io')).toBe(true);
    expect(isWebsiteEmailDomainMatch('company.io', 'invalid-email')).toBe(true);
  });
});
