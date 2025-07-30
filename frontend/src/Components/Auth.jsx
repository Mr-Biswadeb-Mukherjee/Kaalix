import React, { useEffect, useRef, useState } from "react";
import {
  Email,
  Lock,
  Person,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { initBloodFlow } from "./BloodRain";
import { useToast } from "./Toast";
import "./Styles/auth.css";

const Auth = ({ onAuthSuccess }) => {
  const canvasRef = useRef(null);
  const { addToast } = useToast();

  const [tabIndex, setTabIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const isLogin = tabIndex === 0;

  const isFormValid = isLogin
    ? formData.email.trim() && formData.password.trim()
    : formData.fullName.trim() &&
      formData.email.trim() &&
      formData.password.trim();

  useEffect(() => {
    if (canvasRef.current) {
      initBloodFlow(canvasRef.current);
    }
  }, []);

  const handleChange = (field) => (e) =>
    setFormData({ ...formData, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, fullName } = formData;

    if (!email || !password || (!isLogin && !fullName)) {
      addToast("Please complete all required fields.", "warning");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v3/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isLogin ? "login" : "register",
          email,
          password,
          fullName: isLogin ? undefined : fullName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        addToast(
          isLogin
            ? `Welcome back, ${data.user?.fullName || email}.`
            : `Registration complete. Welcome, ${data.user?.fullName || fullName}!`,
          "success"
        );

        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        if (typeof onAuthSuccess === "function") {
          onAuthSuccess(data);
        }
      } else {
        addToast(data.message || "Authentication failed.", "error");
      }
    } catch (error) {
      console.error("Auth error:", error);
      addToast("Server error. Please try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <canvas ref={canvasRef} className="matrix-canvas"></canvas>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={tabIndex === 0 ? "tab active" : "tab"}
              onClick={() => setTabIndex(0)}
              disabled={loading}
            >
              Login
            </button>
            <button
              className={tabIndex === 1 ? "tab active" : "tab"}
              onClick={() => setTabIndex(1)}
              disabled={loading}
            >
              Register
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tabIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="auth-header">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <h2 className="auth-title">
                    {isLogin ? "Access Granted" : "Initiate Sequence"}
                  </h2>
                  <p className="auth-subtitle">
                    {isLogin
                      ? "Jack in. Let the matrix validate you."
                      : "Create your operator ID. Get in the game."}
                  </p>
                </motion.div>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {!isLogin && (
                  <div className="custom-input">
                    <Person className="input-icon" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={formData.fullName}
                      onChange={handleChange("fullName")}
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="custom-input">
                  <Email className="input-icon" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange("email")}
                    disabled={loading}
                  />
                </div>

                <div className="custom-input">
                  <Lock className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange("password")}
                    disabled={loading}
                  />
                  <span
                    className="toggle-password"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-btn"
                  disabled={loading || !isFormValid}
                >
                  {loading
                    ? isLogin
                      ? "Validating..."
                      : "Registering..."
                    : isLogin
                    ? "Login to Amon"
                    : "Register for Access"}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Auth;
