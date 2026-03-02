import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import MainLayout from './Layout/MainLayout';
import Auth from './Components/Features/Auth';
import { ToastProvider } from './Components/UI/Toast';
import * as Pages from './pages';
import { AuthProvider, useAuth } from './Context/AuthContext';
import { RealtimeProvider } from './Context/RealtimeContext';
import ProtectedRoute from './Components/Features/ProtectedRoute';
import ServerRouteError from './Components/Features/ServerRouteError';
import { isMobileDevice } from './Utils/mobileDevice';

// === Route Wrapper to Dynamically Set Page Title ===
function RouteWrapper({ title, children }) {
  useEffect(() => {
    document.title = title || 'Kaalix';
  }, [title]);

  return children;
}

// === Define Application Routes with Titles ===
const routeConfig = [
  { path: 'dashboard', element: <Pages.Dashboard />, title: 'Security Dashboard | Kaalix' },
  { path: 'data-sources', element: <Pages.DataSources />, title: 'Data Sources | Kaalix' },
  { path: 'detection-rules', element: <Pages.DetectionRules />, title: 'Detection Rules | Kaalix' },
  { path: 'integrations', element: <Pages.Integrations />, title: 'Integrations | Kaalix' },
  { path: 'log-forwarder', element: <Pages.LogForwarder />, title: 'Log Forwarder | Kaalix' },
  { path: 'about', element: <Pages.AboutUs />, title: 'About Us | Kaalix' },
  { path: 'docs', element: <Pages.Documentation />, title: 'Documentation | Kaalix' },
  { path: 'logs', element: <Pages.Logs />, title: 'Logs | Kaalix' },
  { path: 'profile', element: <Pages.Profile />, title: 'Profile | Kaalix' },
  {
    path: 'organization-admins',
    element: <Pages.OrganizationAdmins />,
    title: 'Organization Admins | Kaalix',
    allowedRoles: ['sa'],
  },
];

// === Core Routing Logic with Protected Routes ===
function AppRoutes() {
  const navigate = useNavigate();
  const { login, onboardingRequired } = useAuth();
  const dashboardFallbackPath = onboardingRequired ? '/profile' : '/dashboard';
  const dashboardActionLabel = onboardingRequired ? 'Complete Setup' : 'Go to Dashboard';

  const handleAuthSuccess = (data) => {
    login(data.token, data.user || data);
    navigate("/profile");
  };

  return (
    <Routes>
      {/* Public Route (Login / Auth) */}
      <Route
        path="/"
        element={
          <RouteWrapper title="Authentication | Kaalix">
            <Auth onAuthSuccess={handleAuthSuccess} />
          </RouteWrapper>
        }
      />

      <Route
        path="/error/:statusCode"
        element={
          <RouteWrapper title="Error | Kaalix">
            <Pages.RouteErrorPage />
          </RouteWrapper>
        }
      />
      <Route
        path="/mobile-blocked"
        element={
          <RouteWrapper title="Access Restricted | Kaalix">
            <Pages.MobileBlockedPage source="server-policy" />
          </RouteWrapper>
        }
      />

      {/* Protected Routes inside MainLayout */}
      <Route path="/" element={<MainLayout />}>
        {routeConfig.map(({ path, element, title, allowedRoles = [] }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <RouteWrapper title={title}>{element}</RouteWrapper>
              </ProtectedRoute>
            }
          />
        ))}
        <Route
          path="*"
          element={
            <ProtectedRoute fallback={<Navigate to="/error/404" replace />}>
              <RouteWrapper title="404 Not Found | Kaalix">
                <ServerRouteError
                  status={404}
                  actionLabel={dashboardActionLabel}
                  onAction={() => navigate(dashboardFallbackPath, { replace: true })}
                />
              </RouteWrapper>
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/error/404" replace />} />
    </Routes>
  );
}

// === Root App Component ===
function App() {
  const [mobileBlocked, setMobileBlocked] = useState(() => isMobileDevice());

  useEffect(() => {
    const evaluate = () => setMobileBlocked(isMobileDevice());
    evaluate();
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);
    return () => {
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('orientationchange', evaluate);
    };
  }, []);

  if (mobileBlocked) {
    return <Pages.MobileBlockedPage source="frontend-guard" />;
  }

  return (
    <ToastProvider>
      <Router>
        <AuthProvider>
          <RealtimeProvider>
            <AppRoutes />
          </RealtimeProvider>
        </AuthProvider>
      </Router>
    </ToastProvider>
  );
}

export default App;
