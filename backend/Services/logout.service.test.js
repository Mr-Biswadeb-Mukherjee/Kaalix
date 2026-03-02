import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./status.service.js', () => ({
  resetPublicIPAndLocation: vi.fn(),
}));

import logoutHandler from './logout.service.js';
import { resetPublicIPAndLocation } from './status.service.js';

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    revokeToken: undefined,
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };
  return res;
};

describe('backend/logout.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer token is missing', async () => {
    const req = { headers: { authorization: '' } };
    const res = createRes();

    await logoutHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Unauthorized: No valid token provided',
    });
    expect(resetPublicIPAndLocation).not.toHaveBeenCalled();
  });

  it('returns 500 when revokeToken is not available on response object', async () => {
    const req = { headers: { authorization: 'Bearer token-123' } };
    const res = createRes();

    await logoutHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Server misconfiguration: revokeToken unavailable',
    });
    expect(resetPublicIPAndLocation).not.toHaveBeenCalled();
  });

  it('revokes token, clears IP cache, and returns success', async () => {
    const req = { headers: { authorization: 'Bearer token-xyz' } };
    const res = createRes();
    res.revokeToken = vi.fn(async () => {});

    await logoutHandler(req, res);

    expect(res.revokeToken).toHaveBeenCalledWith('token-xyz');
    expect(resetPublicIPAndLocation).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Logout successful. Token revoked and cache cleared.',
    });
  });

  it('returns 500 when revokeToken throws', async () => {
    const req = { headers: { authorization: 'Bearer token-xyz' } };
    const res = createRes();
    res.revokeToken = vi.fn(async () => {
      throw new Error('redis failure');
    });

    await logoutHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Server error during logout',
    });
    expect(resetPublicIPAndLocation).not.toHaveBeenCalled();
  });
});
