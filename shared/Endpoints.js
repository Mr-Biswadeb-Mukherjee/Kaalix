const API = {
  system: {
    auth: {
      login: {
        method: 'POST',
        endpoint: '/api/v3/auth',
      },
      logout: {
        method: 'POST',
        endpoint: '/api/v3/logout',
      },
      verify: {
        method: 'POST',
        endpoint: '/api/v3/verify',
      },
    },

    protected: {
      dashboard: {
        method: 'GET',
        endpoint: '/api/v3/dashboard',
      },
      targetConfig: {
        method: 'GET',
        endpoint: '/api/v3/target-config',
      },
      attackLogic: {
        method: 'GET',
        endpoint: '/api/v3/attack-logic',
      },
      modules: {
        method: 'GET',
        endpoint: '/api/v3/modules',
      },
      proxy: {
        method: 'GET',
        endpoint: '/api/v3/proxy',
      },
      aboutUs: {
        method: 'GET',
        endpoint: '/api/v3/about-us',
      },
      documentation: {
        method: 'GET',
        endpoint: '/api/v3/documentation',
      },
      settings: {
        method: 'GET',
        endpoint: '/api/v3/settings',
      },
    },
  },
};

export default API;
