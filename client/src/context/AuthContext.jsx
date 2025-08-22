import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Configure axios to include cookies with requests
  axios.defaults.withCredentials = true;

  const setupRefreshTimer = () => {
    // Check auth status every 14 minutes to potentially refresh token
    // This is safer since we can't decode httpOnly cookies on client
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(refreshAccessToken, 14 * 60 * 1000); // 14 minutes
  };

  const refreshAccessToken = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`);

      if (response.data.success) {
        setupRefreshTimer();
        return true;
      }
      throw new Error("Refresh failed");
    } catch (error) {
      console.error("Error refreshing token:", error);
      logout();
      return false;
    }
  };

  useEffect(() => {
    // Check if user is logged in by trying to get current user
    // Cookies will be sent automatically if they exist
    checkAuthStatus();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
      setUser(response.data.data);
      setupRefreshTimer(); // Set up refresh timer after successful auth
    } catch (error) {
      if (error.response?.status === 401) {
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          // Retry the original request
          const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
          setUser(response.data.data);
          setupRefreshTimer();
        } else {
          logout();
        }
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password,
      });

      if (response.data.success) {
        await checkAuthStatus();
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
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
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
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
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
