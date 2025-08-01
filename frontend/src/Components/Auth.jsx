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
import FAPI from "../FAPIs/FAPIs";
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
  const [formValid, setFormValid] = useState(false);
  const lastErrorRef = useRef("");

  const isLogin = tabIndex === 0;

  useEffect(() => {
    if (canvasRef.current) {
      initBloodFlow(canvasRef.current);
    }
  }, []);

  const handleChange = (field) => (e) =>
    setFormData({ ...formData, [field]: e.target.value });

  const validateForm = async (fieldToValidate = null) => {
    const { email, password, fullName } = formData;

    try {
      const res = await fetch(FAPI.system.auth.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isLogin ? "login" : "register",
          email,
          password,
          fullName,
          validateOnly: true,
        }),
      });

      const data = await res.json();

      setFormValid(data.valid);

      if (!data.valid && Array.isArray(data.errors)) {
        const relevantError = data.errors.find((msg) =>
          msg.toLowerCase().includes(fieldToValidate?.toLowerCase())
        );

        if (relevantError && lastErrorRef.current !== relevantError) {
          addToast(relevantError, "error");
          lastErrorRef.current = relevantError;
        }
      } else {
        lastErrorRef.current = "";
      }
    } catch (err) {
      console.error("Validation error:", err);
      addToast("Validation failed due to server error.", "error");
      setFormValid(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, fullName } = formData;

    setLoading(true);
    try {
      const response = await fetch(FAPI.system.auth.endpoint, {
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
                      onBlur={() => validateForm("name")}
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
                    onBlur={() => validateForm("email")}
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
                    onBlur={() => validateForm("password")}
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
                  disabled={loading || !formValid}
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
