import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;


// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies in requests
});

// Add request interceptor - no need to manually add auth token anymore
// Cookies will be sent automatically
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login for protected routes
      // Public routes like CV verification should not force login
      const currentPath = window.location.pathname;
      const publicRoutes = [
        "/verify-cv",
        "/verify-cv/results",
        "/search-tool",
        "/search-interface",
        "/landing-page",
        "/",
        "/search-author",
        "/researcher-profile",
      ];

      const isPublicRoute = publicRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // Only redirect if we're not on a public route and not already on login/register
      if (
        !isPublicRoute &&
        !currentPath.includes("/login") &&
        !currentPath.includes("/register")
      ) {
        try {
          const target =
            window.location.pathname + window.location.search + window.location.hash;
          sessionStorage.setItem("postLoginRedirect", target);
        } catch (err) {
          // In some environments (e.g., Safari private mode), sessionStorage may throw
          // Log a non-blocking warning so we don't swallow errors silently
          // and still proceed with redirect to login.
          console.warn(
            "Could not save post-login redirect target to sessionStorage:",
            err
          );
        }
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
