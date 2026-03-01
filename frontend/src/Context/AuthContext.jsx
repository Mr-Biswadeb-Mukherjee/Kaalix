/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import API from "@amon/shared"; // Shared backend/frontend API map
 
const AuthContext = createContext();
const defaultOnboardingState = Object.freeze({
  mustChangePassword: false,
  mustUpdateProfile: false,
  mustShareLocation: false,
  required: false,
});

const normalizeOnboarding = (onboarding) => {
  const mustChangePassword = Boolean(onboarding?.mustChangePassword);
  const mustUpdateProfile = Boolean(onboarding?.mustUpdateProfile);
  const mustShareLocation = Boolean(onboarding?.mustShareLocation);
  const required =
    typeof onboarding?.required === "boolean"
      ? onboarding.required
      : (mustChangePassword || mustUpdateProfile || mustShareLocation);

  return {
    mustChangePassword,
    mustUpdateProfile,
    mustShareLocation,
    required,
  };
};

const normalizeUser = (user) => {
  if (!user || typeof user !== "object") return null;
  const role =
    typeof user.role === "string" ? user.role.trim().toLowerCase() : null;

  return {
    user_id: typeof user.user_id === "string" ? user.user_id : null,
    username: typeof user.username === "string" ? user.username : null,
    email: typeof user.email === "string" ? user.email : null,
    fullName: typeof user.fullName === "string" ? user.fullName : null,
    role: role || null,
  };
};

const isSameOnboarding = (a, b) =>
  Boolean(a?.mustChangePassword) === Boolean(b?.mustChangePassword) &&
  Boolean(a?.mustUpdateProfile) === Boolean(b?.mustUpdateProfile) &&
  Boolean(a?.mustShareLocation) === Boolean(b?.mustShareLocation) &&
  Boolean(a?.required) === Boolean(b?.required);

const isSameUser = (a, b) =>
  (a?.user_id || null) === (b?.user_id || null) &&
  (a?.username || null) === (b?.username || null) &&
  (a?.email || null) === (b?.email || null) &&
  (a?.fullName || null) === (b?.fullName || null) &&
  (a?.role || null) === (b?.role || null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Avoid UI flash before verifying
  const [onboarding, setOnboarding] = useState(defaultOnboardingState);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(API.system.public.verify.endpoint, {
      method: "POST", // ✅ use POST for sensitive operations
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Token invalid");
        return res.json();
      })
      .then((data) => {
        setIsAuthenticated(true);
        setOnboarding(normalizeOnboarding(data?.onboarding));
        const normalizedUser = normalizeUser(data?.user);
        setCurrentUser((prev) =>
          isSameUser(prev, normalizedUser) ? prev : normalizedUser
        );
      })
      .catch(() => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setOnboarding(defaultOnboardingState);
        setCurrentUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setOnboarding(defaultOnboardingState);
    setCurrentUser(null);
  }, []);

  const login = useCallback((token, userData = null) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
    const nextOnboarding = normalizeOnboarding(userData?.onboarding);
    const normalizedUser = normalizeUser(userData);
    setOnboarding((prev) =>
      isSameOnboarding(prev, nextOnboarding) ? prev : nextOnboarding
    );
    setCurrentUser((prev) =>
      isSameUser(prev, normalizedUser) ? prev : normalizedUser
    );
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      clearSession();
      return { success: true, blocked: false };
    }

    try {
      const response = await fetch(API.system.public.logout.endpoint, {
        method: "POST", // ✅ POST to revoke token safely
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 423 && errorData?.onboarding) {
          const nextOnboarding = normalizeOnboarding(errorData.onboarding);
          setOnboarding((prev) =>
            isSameOnboarding(prev, nextOnboarding) ? prev : nextOnboarding
          );
          return {
            success: false,
            blocked: true,
            message: errorData.message || "Complete required setup before logging out.",
          };
        }
        return {
          success: false,
          blocked: false,
          message: errorData.message || response.statusText || "Logout failed.",
        };
      }

      clearSession();
      return { success: true, blocked: false };
    } catch (err) {
      return {
        success: false,
        blocked: false,
        message: err.message || "Network error during logout.",
      };
    }
  }, [clearSession]);

  const updateOnboarding = useCallback((nextOnboarding) => {
    const normalized = normalizeOnboarding(nextOnboarding);
    setOnboarding((prev) =>
      isSameOnboarding(prev, normalized) ? prev : normalized
    );
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        loading,
        onboarding,
        onboardingRequired: onboarding.required,
        updateOnboarding,
        currentUser,
        role: currentUser?.role || null,
        isSuperAdmin: currentUser?.role === "sa",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
