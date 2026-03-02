import { describe, expect, it } from 'vitest';
import API from './Endpoints.js';

const allEndpointConfigs = (group) => Object.values(group || {});

describe('shared/Endpoints API contract', () => {
  it('keeps key public routes stable', () => {
    expect(API.system.public.login).toEqual({
      method: 'POST',
      endpoint: '/api/v3/auth',
    });
    expect(API.system.public.routeError).toEqual({
      method: 'GET',
      endpoint: '/api/v3/errors',
    });
  });

  it('keeps key protected routes stable', () => {
    expect(API.system.protected.status).toEqual({
      method: 'POST',
      endpoint: '/api/v3/status',
    });
    expect(API.system.protected.organizationAdmins).toEqual({
      method: 'GET',
      endpoint: '/api/v3/organization-admins',
    });
  });

  it('uses /api/v3 prefix for every endpoint entry', () => {
    const entries = [
      ...allEndpointConfigs(API.system.public),
      ...allEndpointConfigs(API.system.protected),
    ];

    for (const config of entries) {
      expect(config.endpoint.startsWith('/api/v3/')).toBe(true);
      expect(typeof config.method).toBe('string');
      expect(config.method.length).toBeGreaterThan(0);
    }
  });
});
