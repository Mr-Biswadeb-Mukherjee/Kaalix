const API = {
  system: {
    public: {
      login: {
        method: 'POST',
        endpoint: '/api/v3/auth',
        handler: 'auth',
      },
      logout: {
        method: 'POST',
        endpoint: '/api/v3/logout',
        handler: 'logout',
      },
      verify: {
        method: 'POST',
        endpoint: '/api/v3/verify',
        handler: 'verify',

      },
      captcha: {
        method: 'GET',
        endpoint: '/api/v3/captcha',
        handler: 'captchaHandler',

      },
    },

    protected: {
      dashboard: {
        method: 'POST',
        endpoint: '/api/v3/dashboard',
        handler: 'dashboard',
      },
      targetConfig: {
        method: 'POST',
        endpoint: '/api/v3/tar-config',
        handler: 'targetConfig',
      },
      attackLogic: {
        method: 'POST',
        endpoint: '/api/v3/attack-logic',
        handler: 'attackLogic',
      },
      modules: {
        method: 'POST',
        endpoint: '/api/v3/modules',
        handler: 'modules',
      },
      proxy: {
        method: 'POST',
        endpoint: '/api/v3/proxy',
        handler: 'proxy',
      },
      aboutUs: {
        method: 'POST',
        endpoint: '/api/v3/about-us',
        handler: 'aboutUs',
      },
      documentation: {
        method: 'POST',
        endpoint: '/api/v3/documentation',
        handler: 'documentation',
      },
      settings: {
        method: 'POST',
        endpoint: '/api/v3/settings',
        handler: 'settings',
      
      },
    },
  },
};

export default API;
