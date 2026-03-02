import { describe, expect, it } from 'vitest';
import {
  defaultErrorCode,
  defaultErrorMessage,
  defaultErrorTitle,
  normalizeHttpStatus,
  resolveErrorMeta,
} from './httpErrors.utils.js';

describe('backend/httpErrors.utils', () => {
  describe('normalizeHttpStatus', () => {
    it('keeps valid HTTP error statuses', () => {
      expect(normalizeHttpStatus(404)).toBe(404);
      expect(normalizeHttpStatus(500)).toBe(500);
    });

    it('falls back to 500 for invalid statuses', () => {
      expect(normalizeHttpStatus(200)).toBe(500);
      expect(normalizeHttpStatus(0)).toBe(500);
      expect(normalizeHttpStatus('404')).toBe(500);
      expect(normalizeHttpStatus(undefined)).toBe(500);
    });
  });

  describe('error defaults', () => {
    it('returns known defaults for mapped HTTP statuses', () => {
      expect(defaultErrorCode(404)).toBe('NOT_FOUND');
      expect(defaultErrorMessage(404)).toBe('Requested route was not found.');
      expect(defaultErrorTitle(404)).toBe('Not found');
    });

    it('returns generic defaults for unmapped statuses', () => {
      expect(defaultErrorCode(418)).toBe('HTTP_418_ERROR');
      expect(defaultErrorMessage(418)).toBe('Request failed.');
      expect(defaultErrorTitle(418)).toBe('Request failed');
    });
  });

  describe('resolveErrorMeta', () => {
    it('returns fully resolved metadata for known status', () => {
      expect(resolveErrorMeta(401)).toEqual({
        status: 401,
        code: 'UNAUTHORIZED',
        title: 'Unauthorized',
        message: 'Unauthorized request.',
      });
    });

    it('normalizes invalid input before resolving metadata', () => {
      expect(resolveErrorMeta(123)).toEqual({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        title: 'Server error',
        message: 'Internal server error.',
      });
    });
  });
});
