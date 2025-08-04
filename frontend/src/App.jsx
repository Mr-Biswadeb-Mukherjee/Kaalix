import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import MainLayout from './Layout/MainLayout';
import Auth from './Components/Auth';
import { ToastProvider } from './Components/Toast';
import * as Pages from './pages';
import { AuthProvider, useAuth } from './Context/AuthContext';
import ProtectedRoute from './Components/ProtectedRoute';

// A wrapper to update the page title dynamically
function RouteWrapper({ title, children }) {
  useEffect(() => {
    document.title = title || 'Amon';
  }, [title]);

  return children;
}

// Define your route configuration
const routeConfig = [
  { path: 'dashboard', element: <Pages.Dashboard />, title: 'Dashboard | Amon' },
  { path: 'target-config', element: <Pages.TargetConfig />, title: 'Target Config | Amon' },
  { path: 'attack-logic', element: <Pages.AttackLogic />, title: 'Attack Logic | Amon' },
  { path: 'modules', element: <Pages.Modules />, title: 'Modules | Amon' },
  { path: 'proxy', element: <Pages.Proxy />, title: 'Proxy | Amon' },
  { path: 'about', element: <Pages.AboutUs />, title: 'About Us | Amon' },
  { path: 'docs', element: <Pages.Documentation />, title: 'Documentation | Amon' },
  { path: 'settings', element: <Pages.Settings />, title: 'Settings | Amon' },
];

// Handles routing logic and protected routes
function AppRoutes() {
  const navigate = useNavigate();
  const { login } = useAuth(); // Destructuring from context

  const handleAuthSuccess = (data) => {
    login(data.token); // Save token
    navigate("/dashboard");
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

// Root App component with correct provider order
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
