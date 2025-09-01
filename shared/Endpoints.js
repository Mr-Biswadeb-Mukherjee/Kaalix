const API = {
  system: {
    public: {
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
      captcha: {
        method: 'GET',
        endpoint: '/api/v3/captcha',

      },
    },

    protected: {
      dashboard: {
        method: 'POST',
        endpoint: '/api/v3/dashboard',
      },
      targetConfig: {
        method: 'POST',
        endpoint: '/api/v3/tar-config',
      },
      attackLogic: {
        method: 'POST',
        endpoint: '/api/v3/attack-logic',
      },
      modules: {
        method: 'POST',
        endpoint: '/api/v3/modules',
      },
      proxy: {
        method: 'POST',
        endpoint: '/api/v3/proxy',
      },
      aboutUs: {
        method: 'POST',
        endpoint: '/api/v3/about-us',
      },
      documentation: {
        method: 'POST',
        endpoint: '/api/v3/documentation',
      },
      settings: {
        method: 'POST',
        endpoint: '/api/v3/settings',
      },
      status:{
        method: 'POST',
        endpoint: '/api/v3/status',
      },
      changepass: {
        method: 'POST',
        endpoint: '/api/v3/changepass',
      },
      deleteacc: {
        method: 'POST',
        endpoint: '/api/v3/deleteacc',
      },
    },
  },
};

export default API;
