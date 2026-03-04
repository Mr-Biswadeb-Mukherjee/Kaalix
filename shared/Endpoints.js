const API_BASE = "/api/v3";

const API = {
  system: {
    public: {
      login: {
        method: 'POST',
        endpoint: `${API_BASE}/auth`,
      },
      logout: {
        method: 'POST',
        endpoint: `${API_BASE}/logout`,
      },
      verify: {
        method: 'POST',
        endpoint: `${API_BASE}/verify`,
      },
      captcha: {
        method: 'GET',
        endpoint: `${API_BASE}/captcha`,
      },
      captchaRefresh: {
        method: 'POST',
        endpoint: `${API_BASE}/captcha/refresh`,
      },
      routeError: {
        method: 'GET',
        endpoint: `${API_BASE}/errors`,
      },
    },

    protected: {
      dashboard: {
        method: 'POST',
        endpoint: `${API_BASE}/dashboard`,
      },
      dataSources: {
        method: 'POST',
        endpoint: `${API_BASE}/log-sources`,
      },
      detectionRules: {
        method: 'POST',
        endpoint: `${API_BASE}/detection-rules`,
      },
      integrations: {
        method: 'POST',
        endpoint: `${API_BASE}/integrations`,
      },
      logForwarder: {
        method: 'POST',
        endpoint: `${API_BASE}/log-forwarder`,
      },
      aboutUs: {
        method: 'POST',
        endpoint: `${API_BASE}/about-us`,
      },
      documentation: {
        method: 'POST',
        endpoint: `${API_BASE}/documentation`,
      },
      settings: {
        method: 'POST',
        endpoint: `${API_BASE}/settings`,
      },
      status: {
        method: 'POST',
        endpoint: `${API_BASE}/status`,
      },
      changepass: {
        method: 'POST',
        endpoint: `${API_BASE}/changepass`,
      },
      deleteacc: {
        method: 'POST',
        endpoint: `${API_BASE}/deleteacc`,
      },

      getprofile: {
        method: 'GET', 
        endpoint: `${API_BASE}/getprofile`,
      },

      updateprofile: {
        method: 'POST',
        endpoint: `${API_BASE}/updateprofile`,
      },
      updateavatar: {
        method: 'POST',
        endpoint: `${API_BASE}/updateavatar`,
      },
      locationConsent: {
        method: 'POST',
        endpoint: `${API_BASE}/location-consent`,
      },
      locationUpdate: {
        method: 'POST',
        endpoint: `${API_BASE}/location-update`,
      },
      MFA: {
        method: 'POST',
        endpoint: `${API_BASE}/MFA`,
      },
      MFA_verify: {
        method: 'POST',
        endpoint: `${API_BASE}/MFA/verify`,
      },
      organizationAdmins: {
        method: 'GET',
        endpoint: `${API_BASE}/organization-admins`,
      },
      updateOrganizationAdmins: {
        method: 'POST',
        endpoint: `${API_BASE}/organization-admins`,
      },
      managedUsers: {
        method: 'POST',
        endpoint: `${API_BASE}/managed-users`,
      },
      manageAdminAccount: {
        method: 'POST',
        endpoint: `${API_BASE}/managed-users/account-status`,
      },
      notifications: {
        method: 'GET',
        endpoint: `${API_BASE}/notifications`,
      },
      notificationsUnreadCount: {
        method: 'GET',
        endpoint: `${API_BASE}/notifications/unread-count`,
      },
      notificationsMarkRead: {
        method: 'POST',
        endpoint: `${API_BASE}/notifications/read`,
      },
      notificationsMarkAllRead: {
        method: 'POST',
        endpoint: `${API_BASE}/notifications/read-all`,
      },
      realtime: {
        method: 'GET',
        endpoint: `${API_BASE}/realtime`,
      },
      monitoring: {
        method: 'GET',
        endpoint: `${API_BASE}/monitoring`,
      },
      loginHistory: {
        method: 'GET',
        endpoint: `${API_BASE}/login-history`,
      },
      activityLogs: {
        method: 'GET',
        endpoint: `${API_BASE}/activity-logs`,
      },
    },
  },
};

export default API;
