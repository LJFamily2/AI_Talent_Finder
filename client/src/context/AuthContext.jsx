import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

// Create a separate axios instance for auth checks to avoid global interceptors
const authAxios = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Configure axios to include cookies with requests
  axios.defaults.withCredentials = true;

  const setupRefreshTimer = () => {
    // Check auth status every 50 minutes to potentially refresh token
    // Since access token is now 1 hour, refresh at 50 minutes to be safe
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(refreshAccessToken, 50 * 60 * 1000); // 50 minutes
  };

  const refreshAccessToken = async () => {
    try {
      const response = await authAxios.post(`/api/auth/refresh`);

      if (response.data.success) {
        setupRefreshTimer();
        return true;
      }
      throw new Error("Refresh failed");
    } catch (error) {
      // Suppress noisy logs for public/expired sessions
      logout();
      return false;
    }
  };

  useEffect(() => {
    // Only probe session if we have previously logged in
    const hasSession = (() => {
      try { return localStorage.getItem('hasSession') === '1'; } catch { return false; }
    })();
    if (hasSession) {
      checkAuthStatus();
    } else {
      setLoading(false);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await authAxios.get(`/api/auth/me`);
      setUser(response.data.data);
      setupRefreshTimer(); // Set up refresh timer after successful auth
      return response.data.data;
    } catch (error) {
      // Suppress console errors for 401 - this is expected when not logged in
      if (error.response?.status === 401) {
        // Try to refresh token silently
        try {
          await refreshAccessToken();
          // Retry the original request
          const response = await authAxios.get(`/api/auth/me`);
          setUser(response.data.data);
          setupRefreshTimer();
          return response.data.data;
        } catch {
          // Silently fail - user can still use non-authenticated features
          setUser(null);
          return null;
        }
      } else {
        // Only log non-401 errors (network issues, etc.)
        console.log("Auth check failed - allowing public access");
        setUser(null);
        return null;
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAxios.post(`/api/auth/login`, {
        email,
        password,
      });

      if (response.data.success) {
        try { localStorage.setItem('hasSession', '1'); } catch {}
        const u = await checkAuthStatus();
        try { if (u?.name) sessionStorage.setItem('loginWelcomeName', u.name); } catch {}
        setupRefreshTimer();
        return { success: true };
      }

      return { success: false, error: "Login failed" };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "An error occurred",
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await authAxios.post(`/api/auth/register`, {
        name,
        email,
        password,
      });

      if (response.data.success) {
        await checkAuthStatus();
        setupRefreshTimer();
        return { success: true };
      }

      return { success: false, error: "Registration failed" };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "An error occurred",
      };
    }
  };

  const logout = async () => {
    try {
      await authAxios.post(`/api/auth/logout`);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      try { localStorage.removeItem('hasSession'); } catch {}
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
