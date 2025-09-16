import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import loginPageBackground from "../assets/login-page-bg.jpg";
import rmitLogoRedWhite from "../assets/rmit-logo-red-white.png";
import eyeIcon from "../assets/eye-on.png";
import eyeOffIcon from "../assets/eye-off.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      setEmail("");
      setPassword("");
      navigate("/saved-researchers");
    } else {
      setError(result.error);
    }
  };

  return (
    <div
      className="min-h-screen min-w-full w-full h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginPageBackground})` }}
    >
      <div className="absolute top-8 left-8 flex items-center space-x-6">
        <a href="/landing-page">
          <img
            src={rmitLogoRedWhite}
            alt="RMIT Logo"
            className="w-28 h-auto z-10"
          />
        </a>
        <a href="/landing-page">
          <h1 className="text-white text-3xl font-bold ml-4 tracking-wide drop-shadow-lg">Talent Finder</h1>
        </a>
      </div>
      <div className="bg-white bg-opacity-85 rounded-2xl shadow-2xl px-10 py-15 w-full max-w-md mx-auto flex flex-col justify-center">
        <h1 className="text-3xl font-bold text-center mb-3">Login</h1>
        <p className="text-center text-md mb-13">Enter your credentials to sign in</p>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-6 text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
          <div>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base mb-2"
              placeholder="Email address"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 text-base mb-2"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              className="absolute right-5 top-6 -translate-y-1/2 focus:outline-none"
              tabIndex={-1}
            >
              <img
                src={showPassword ? eyeOffIcon : eyeIcon}
                alt={showPassword ? "Hide password" : "Show password"}
                className="w-5 h-5 opacity-70 hover:opacity-100"
                style={{ filter: 'invert(34%) sepia(98%) saturate(2100%) hue-rotate(210deg) brightness(95%) contrast(101%)' }}
              />
            </button>
            {/* <p className="absolute right-0 bottom-0 text-sm text-blue-600 cursor-pointer hover:underline mb-1 mr-1">Forgot password?</p> */}
          </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors mt-2 shadow-md mb-2"
          >
            Sign In
          </button>
          <p className="mt-8 text-sm text-center">New here? <span className="text-blue-600">Contact your admin</span></p>
        </form>
      </div>
    </div>
  );
};

export default Login;
