import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const setupTokens = (accessToken, refreshToken) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    // Set up refresh timer
    const decoded = jwtDecode(accessToken);
    const expiryTime = decoded.exp * 1000; // convert to milliseconds
    const timeUntilRefresh = expiryTime - Date.now() - 60000; // Refresh 1 minute before expiry

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(refreshAccessToken, timeUntilRefresh);
  };

  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await axios.post(
        "http://localhost:5000/api/auth/refresh",
        {
          refreshToken,
        }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      setupTokens(accessToken, newRefreshToken);
      return true;
    } catch (error) {
      console.error("Error refreshing token:", error);
      logout();
      return false;
    }
  };

  useEffect(() => {
    // Check if user is logged in
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (accessToken && refreshToken) {
      setupTokens(accessToken, refreshToken);
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
      const response = await axios.get("http://localhost:5000/api/auth/me");
      setUser(response.data.data);
    } catch (error) {
      if (error.response?.status === 401) {
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          // Retry the original request
          const response = await axios.get("http://localhost:5000/api/auth/me");
          setUser(response.data.data);
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
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          email,
          password,
        }
      );
      const { accessToken, refreshToken } = response.data;
      setupTokens(accessToken, refreshToken);
      await checkAuthStatus();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "An error occurred",
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/register",
        {
          name,
          email,
          password,
        }
      );
      const { accessToken, refreshToken } = response.data;
      setupTokens(accessToken, refreshToken);
      await checkAuthStatus();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "An error occurred",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    delete axios.defaults.headers.common["Authorization"];
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
