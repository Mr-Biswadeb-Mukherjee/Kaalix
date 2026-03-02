import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../Utils/JWT.utils.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../Services/user.service.js', () => ({
  getUserAccessState: vi.fn(),
  getUserOnboardingState: vi.fn(),
  USER_ACCOUNT_STATUSES: {
    BLOCKED: 'blocked',
    DELETED: 'deleted',
    ACTIVE: 'active',
  },
}));

vi.mock('../Services/adminLifecycle.service.js', () => ({
  purgeExpiredSoftDeletedAdminsIfDue: vi.fn(),
}));

import authMiddleware from './auth.middleware.js';
import { verifyToken } from '../Utils/JWT.utils.js';
import {
  getUserAccessState,
  getUserOnboardingState,
  USER_ACCOUNT_STATUSES,
} from '../Services/user.service.js';
import { purgeExpiredSoftDeletedAdminsIfDue } from '../Services/adminLifecycle.service.js';

const createRes = () => {
  const res = {
    locals: {},
    statusCode: 200,
    body: null,
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

describe('backend/auth.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth token is missing', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = vi.fn();
    const middleware = authMiddleware();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ message: '🔐 Missing token' });
    expect(res.locals.errorReason).toBe('missing_auth_token');
    expect(res.locals.errorCode).toBe('AUTH_TOKEN_MISSING');
    expect(verifyToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when account is blocked', async () => {
    verifyToken.mockResolvedValue({ user_id: 5 });
    purgeExpiredSoftDeletedAdminsIfDue.mockResolvedValue();
    getUserAccessState.mockResolvedValue({ account_status: USER_ACCOUNT_STATUSES.BLOCKED });

    const req = { headers: { authorization: 'Bearer token-1' } };
    const res = createRes();
    const next = vi.fn();
    const middleware = authMiddleware();

    await middleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('token-1', { revoke: true });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'ACCOUNT_BLOCKED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 423 when onboarding is required and not allowed', async () => {
    verifyToken.mockResolvedValue({ user_id: 11, role: 'admin' });
    purgeExpiredSoftDeletedAdminsIfDue.mockResolvedValue();
    getUserAccessState.mockResolvedValue({ account_status: USER_ACCOUNT_STATUSES.ACTIVE });
    getUserOnboardingState.mockResolvedValue({
      required: true,
      mustChangePassword: true,
      mustUpdateProfile: false,
      mustShareLocation: false,
    });

    const req = { headers: { authorization: 'Bearer token-2' } };
    const res = createRes();
    const next = vi.fn();
    const middleware = authMiddleware();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(423);
    expect(res.locals.errorReason).toBe('onboarding_required');
    expect(res.locals.errorCode).toBe('ONBOARDING_REQUIRED');
    expect(res.body).toMatchObject({
      success: false,
      code: 'ONBOARDING_REQUIRED',
    });
    expect(res.body.allowedEndpoints).toMatchObject({
      getProfile: '/api/v3/getprofile',
      updateProfile: '/api/v3/updateprofile',
      changePassword: '/api/v3/changepass',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches user context when onboarding is allowed', async () => {
    verifyToken.mockResolvedValue({ user_id: 21, role: 'sa' });
    purgeExpiredSoftDeletedAdminsIfDue.mockResolvedValue();
    getUserAccessState.mockResolvedValue({ account_status: USER_ACCOUNT_STATUSES.ACTIVE });
    getUserOnboardingState.mockResolvedValue({
      required: true,
      mustChangePassword: true,
      mustUpdateProfile: true,
      mustShareLocation: true,
    });

    const req = { headers: { authorization: 'Bearer token-3' } };
    const res = createRes();
    const next = vi.fn();
    const middleware = authMiddleware({ revoke: false, allowDuringOnboarding: true });

    await middleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('token-3', { revoke: false });
    expect(req.user).toMatchObject({ user_id: 21, onboarding_required: true });
    expect(req.token).toBe('token-3');
    expect(req.onboarding).toMatchObject({ required: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 with revoked token messaging when verification fails', async () => {
    verifyToken.mockRejectedValue(new Error('Token has been revoked or reused'));

    const req = { headers: { authorization: 'Bearer token-4' } };
    const res = createRes();
    const next = vi.fn();
    const middleware = authMiddleware();

    await middleware(req, res, next);

    expect(purgeExpiredSoftDeletedAdminsIfDue).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.locals.errorReason).toBe('auth_token_revoked_or_account_deleted');
    expect(res.locals.errorCode).toBe('Error');
    expect(res.body).toEqual({
      message: 'Your account has been deleted or logged out from all devices.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
