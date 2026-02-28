import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import MainLayout from './Layout/MainLayout';
import Auth from './Components/Features/Auth';
import { ToastProvider } from './Components/UI/Toast';
import * as Pages from './pages';
import { AuthProvider, useAuth } from './Context/AuthContext';
import ProtectedRoute from './Components/Features/ProtectedRoute';

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
];

// === Core Routing Logic with Protected Routes ===
function AppRoutes() {
  const navigate = useNavigate();
  const { login } = useAuth();

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

      {/* Protected Routes inside MainLayout */}
      <Route path="/" element={<MainLayout />}>
        {routeConfig.map(({ path, element, title }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <RouteWrapper title={title}>{element}</RouteWrapper>
              </ProtectedRoute>
            }
          />
        ))}
      </Route>
    </Routes>
  );
}

// === Root App Component ===
function App() {
  return (
    <ToastProvider>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ToastProvider>
  );
}

export default App;
