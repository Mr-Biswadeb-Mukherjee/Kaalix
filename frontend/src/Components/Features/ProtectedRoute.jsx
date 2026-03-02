import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext";
import ServerRouteError from "./ServerRouteError";

const ProtectedRoute = ({ children, allowedRoles = [], fallback = null }) => {
  const { isAuthenticated, loading, onboardingRequired, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return fallback || <Navigate to="/" replace />;
  }

  if (isAuthenticated && onboardingRequired && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";
    const hasAccess = allowedRoles.some(
      (allowedRole) =>
        typeof allowedRole === "string" &&
        allowedRole.trim().toLowerCase() === normalizedRole
    );
    if (!hasAccess) {
      return <ServerRouteError status={403} />;
    }
  }

  return children;
};

export default ProtectedRoute;
