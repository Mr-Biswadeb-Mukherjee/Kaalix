import { createContext, useContext, useState, useEffect, useCallback } from "react";
import API from "@amon/shared"; // Shared backend/frontend API map
 
const AuthContext = createContext();
const defaultOnboardingState = Object.freeze({
  mustChangePassword: false,
  mustUpdateProfile: false,
  required: false,
});

const normalizeOnboarding = (onboarding) => {
  const mustChangePassword = Boolean(onboarding?.mustChangePassword);
  const mustUpdateProfile = Boolean(onboarding?.mustUpdateProfile);
  const required =
    typeof onboarding?.required === "boolean"
      ? onboarding.required
      : (mustChangePassword || mustUpdateProfile);

  return {
    mustChangePassword,
    mustUpdateProfile,
    required,
  };
};

const isSameOnboarding = (a, b) =>
  Boolean(a?.mustChangePassword) === Boolean(b?.mustChangePassword) &&
  Boolean(a?.mustUpdateProfile) === Boolean(b?.mustUpdateProfile) &&
  Boolean(a?.required) === Boolean(b?.required);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Avoid UI flash before verifying
  const [onboarding, setOnboarding] = useState(defaultOnboardingState);

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
      })
      .catch(() => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setOnboarding(defaultOnboardingState);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setOnboarding(defaultOnboardingState);
  }, []);

  const login = useCallback((token, userData = null) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
    const nextOnboarding = normalizeOnboarding(userData?.onboarding);
    setOnboarding((prev) =>
      isSameOnboarding(prev, nextOnboarding) ? prev : nextOnboarding
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
            message: errorData.message || "Complete first-time setup before logging out.",
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
