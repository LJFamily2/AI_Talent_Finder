import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./components/Dashboard";
import { CssBaseline } from "@mui/material";
<<<<<<< Updated upstream:client/src/App.js
import CVUpload from "./components/CVUpload"; 

=======
import CVUpload from "./pages/CVUpload";
import SearchPublications from './pages/SearchPublications';
>>>>>>> Stashed changes:client/src/App.jsx

function App() {
  return (
    <Router>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />  
          <Route path="/upload-cv"
            element={
              <ProtectedRoute>
                <CVUpload />
              </ProtectedRoute>
            }
          />
<<<<<<< Updated upstream:client/src/App.js
=======
          <Route path="/verify-cv" element={<CVUpload />} />
>>>>>>> Stashed changes:client/src/App.jsx
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/search" element={<SearchPublications />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
