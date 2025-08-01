const BAPI = {
  system: {
    auth: {
      method: 'POST',
      endpoint: '/api/v3/auth'
    },
    Dashboard: {
      method: 'GET',
      endpoint: '/api/v3/dashboard'
    },
    TargetConfig: {
      method: 'GET',
      endpoint: '/api/v3/target-config'
    },
    AttackLogic: {
      method: 'GET',
      endpoint: '/api/v3/AttackLogic'
    },
    Modules: {
      method: 'GET',
      endpoint: '/api/v3/Modules'
    },
    Proxy: {
      method: 'GET',
      endpoint: '/api/v3/Proxy'
    },
    AboutUs: {
      method: 'GET',
      endpoint: '/api/v3/AboutUs'
    },
    Documentation: {
      method: 'GET',
      endpoint: '/api/v3/Documentation'
    },
    Settings: {
      method: 'GET',
      endpoint: '/api/v3/Settings'
    },
    Logout: {
      method: 'GET',
      endpoint: '/api/v3/logout'
    },

}
};

export default BAPI;