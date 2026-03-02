import { describe, expect, it } from 'vitest';
import {
  getDomainFromEmail,
  getDomainFromWebsite,
  isWebsiteEmailDomainMatch,
} from './domainUtils.js';

describe('frontend/domainUtils re-export', () => {
  it('extracts normalized domain from email inputs', () => {
    expect(getDomainFromEmail('Team@Example.COM.')).toBe('example.com');
    expect(getDomainFromEmail('missing-at-symbol')).toBe('');
  });

  it('extracts website domain and strips leading www', () => {
    expect(getDomainFromWebsite('https://www.example.com/docs')).toBe('example.com');
    expect(getDomainFromWebsite('example.org')).toBe('example.org');
  });

  it('compares website/email domain matches using shared logic', () => {
    expect(isWebsiteEmailDomainMatch('example.com', 'admin@example.com')).toBe(true);
    expect(isWebsiteEmailDomainMatch('example.com', 'admin@other.com')).toBe(false);
  });

  it('returns true when one of the domains is invalid', () => {
    expect(isWebsiteEmailDomainMatch('', 'admin@example.com')).toBe(true);
    expect(isWebsiteEmailDomainMatch('example.com', 'bad-email')).toBe(true);
  });
});
