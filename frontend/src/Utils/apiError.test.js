import { describe, expect, it } from 'vitest';
import {
  getBackendErrorDisplay,
  getBackendErrorMessage,
  parseApiResponse,
} from './apiError.js';

const mockResponse = ({
  ok = true,
  status = 200,
  statusText = 'OK',
  payload = {},
  jsonReject = false,
} = {}) => ({
  ok,
  status,
  statusText,
  json: jsonReject
    ? async () => {
      throw new Error('Invalid JSON');
    }
    : async () => payload,
});

describe('frontend apiError utilities', () => {
  describe('parseApiResponse', () => {
    it('returns parsed payload for successful responses', async () => {
      const payload = { success: true, data: { id: 1 } };
      const result = await parseApiResponse(mockResponse({ payload }));
      expect(result).toEqual(payload);
    });

    it('throws a normalized backend error for non-ok responses', async () => {
      const response = mockResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        jsonReject: true,
      });

      await expect(parseApiResponse(response)).rejects.toMatchObject({
        status: 401,
        code: 'HTTP_401_ERROR',
        backendTitle: 'Request failed',
        backendMessage: 'Unauthorized',
        data: {},
      });
    });

    it('throws when requireSuccess is set and payload marks failure', async () => {
      const response = mockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        payload: {
          success: false,
          code: 'VALIDATION_FAILED',
          title: 'Validation error',
          message: 'Invalid payload',
        },
      });

      await expect(parseApiResponse(response, { requireSuccess: true })).rejects.toMatchObject({
        status: 200,
        code: 'VALIDATION_FAILED',
        backendTitle: 'Validation error',
        backendMessage: 'Invalid payload',
      });
    });
  });

  describe('getBackendErrorMessage', () => {
    it('formats backend-style errors with status and code', () => {
      const message = getBackendErrorMessage({
        status: 404,
        code: 'NOT_FOUND',
        backendMessage: 'Resource missing',
      });

      expect(message).toBe('404 NOT_FOUND: Resource missing');
    });

    it('falls back to the generic message for empty input', () => {
      expect(getBackendErrorMessage(null)).toBe('Request failed.');
    });

    it('returns plain error message when status is absent', () => {
      expect(getBackendErrorMessage(new Error('Network down'))).toBe('Network down');
    });
  });

  describe('getBackendErrorDisplay', () => {
    it('builds display-friendly defaults for unknown input', () => {
      expect(getBackendErrorDisplay(undefined)).toEqual({
        status: 500,
        code: 'HTTP_500_ERROR',
        title: 'Request failed',
        message: 'Request failed.',
      });
    });

    it('prefers backend-provided values when present', () => {
      expect(
        getBackendErrorDisplay({
          status: 429,
          code: 'TOO_MANY_REQUESTS',
          backendTitle: 'Retry later',
          backendMessage: 'Rate limit exceeded',
        })
      ).toEqual({
        status: 429,
        code: 'TOO_MANY_REQUESTS',
        title: 'Retry later',
        message: 'Rate limit exceeded',
      });
    });
  });
});
