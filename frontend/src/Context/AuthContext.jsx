import { createContext, useContext, useState, useEffect } from "react";
import API from "@amon/shared"; // Shared backend/frontend API map
 
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Avoid UI flash before verifying

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
      .then(() => {
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = (token) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    const token = localStorage.getItem("token");

    try {
      if (token) {
        const response = await fetch(API.system.public.logout.endpoint, {
          method: "POST", // ✅ POST to revoke token safely
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("🚨 Logout failed on backend:", errorData.message || response.statusText);
        }
      }
    } catch (err) {
      console.error("🚨 Backend logout error:", err.message);
    } finally {
      localStorage.removeItem("token");
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
