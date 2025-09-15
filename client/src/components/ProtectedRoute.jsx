import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CircularProgress, Box } from "@mui/material";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    try {
      const target = location.pathname + location.search + location.hash;
      sessionStorage.setItem('postLoginRedirect', target);
    } catch (err) {
      console.warn(
        "Could not save post-login redirect target to sessionStorage:",
        err
      );
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
