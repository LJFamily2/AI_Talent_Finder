import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import { CssBaseline } from "@mui/material";
import CVUpload from "./pages/CVUpload";
import CVVerification from "./pages/CVVerification";
import ResearcherProfile from "./pages/ResearcherProfile";
import SearchAuthor from "./pages/SearchAuthor";

import SearchInterface from "./pages/SearchInterface";
import SearchStart from "./pages/SearchStart";
import LandingPage from "./pages/LandingPage";
import SavedResearchers from "./pages/SavedResearchers";

function App() {
  return (
    <BrowserRouter>
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
          <Route path="/verify-cv" element={<CVUpload />} />
          <Route path="/cv-verification" element={<CVVerification />} />
          <Route path="/search-tool" element={<SearchStart />} />
          <Route path="/search-interface" element={<SearchInterface />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/landing-page" element={<LandingPage/>} />

          <Route path="/researcher-profile" element={<ResearcherProfile />} />
          <Route path="/saved-researchers" element={<SavedResearchers />} />
          <Route path="/search-author" element={<SearchAuthor />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
