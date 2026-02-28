import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, onboardingRequired } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (isAuthenticated && onboardingRequired && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  return isAuthenticated ? children : <Navigate to="/" replace />;
};

export default ProtectedRoute;
