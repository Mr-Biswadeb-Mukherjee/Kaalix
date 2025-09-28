// App.js

import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import MainLayout from './Layout/MainLayout';
import Auth from './Components/Auth';
import { ToastProvider } from './Components/Toast';
import * as Pages from './pages';
import { AuthProvider, useAuth } from './Context/AuthContext';
import ProtectedRoute from './Components/ProtectedRoute';
import Preloader from './Components/Preloader';

// === Preloader Control Flags ===
const ENABLE_PRELOADER = 0; // 1 = Enable Preloader, 0 = Disable Preloader
const PERSIST_PRELOADER_IN_SESSION = 0; // 1 = Store in sessionStorage after first load, 0 = Always show when enabled

// === Route Wrapper to Dynamically Set Page Title ===
function RouteWrapper({ title, children }) {
  useEffect(() => {
    document.title = title || 'Amon';
  }, [title]);

  return children;
}

// === Define Application Routes with Titles ===
const routeConfig = [
  { path: 'dashboard', element: <Pages.Dashboard />, title: 'Dashboard | Amon' },
  { path: 'target-config', element: <Pages.TargetConfig />, title: 'Target Config | Amon' },
  { path: 'attack-logic', element: <Pages.AttackLogic />, title: 'Attack Logic | Amon' },
  { path: 'modules', element: <Pages.Modules />, title: 'Modules | Amon' },
  { path: 'proxy', element: <Pages.Proxy />, title: 'Proxy | Amon' },
  { path: 'about', element: <Pages.AboutUs />, title: 'About Us | Amon' },
  { path: 'docs', element: <Pages.Documentation />, title: 'Documentation | Amon' },
  { path: 'logs', element: <Pages.Logs />, title: 'Logs | Amon' },
  { path: 'profile', element: <Pages.Profile />, title: 'Profile | Amon' },
];

// === Core Routing Logic with Protected Routes ===
function AppRoutes() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAuthSuccess = (data) => {
    login(data.token);
    navigate("/profile");
  };

  return (
    <Routes>
      {/* Public Route (Login / Auth) */}
      <Route
        path="/"
        element={
          <RouteWrapper title="Authentication | Amon">
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

// === Root App Component with Preloader + Providers ===
function App() {
  const [loading, setLoading] = useState(() => {
    if (!ENABLE_PRELOADER) return false;

    if (PERSIST_PRELOADER_IN_SESSION) {
      const hasLoaded = sessionStorage.getItem("hasLoadedOnce");
      return !hasLoaded;
    }

    return true; // Always show if persistence is off and enabled
  });

  const handlePreloaderFinish = () => {
    if (PERSIST_PRELOADER_IN_SESSION) {
      sessionStorage.setItem("hasLoadedOnce", "true");
    }
    setLoading(false);
  };

  if (loading) {
    return <Preloader onFinish={handlePreloaderFinish} />;
  }

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
