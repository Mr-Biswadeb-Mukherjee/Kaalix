import React, { useEffect, useRef, useState } from "react";
import {
  Email, Lock, Person, Visibility, VisibilityOff, Security, Refresh
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { initBloodFlow } from "./BloodRain";
import { useToast } from "./Toast";
import API from "@amon/shared";
import SafeImage from "./safeImage";
import "./Styles/auth.css";

const Auth = ({ onAuthSuccess }) => {
  const canvasRef = useRef(null);
  const { addToast } = useToast();

  const [tabIndex, setTabIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [captchaImage, setCaptchaImage] = useState(null);
  const [lockInfo, setLockInfo] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const lastErrorRef = useRef("");

  const isLogin = tabIndex === 0;
  const authEndpoint = API.system.public.login.endpoint;
  
  const fieldConfig = [
    { name: "fullName", icon: Person, type: "text", placeholder: "Full Name", show: !isLogin, required: true },
    { name: "email", icon: Email, type: "email", placeholder: "Email", show: true, required: true },
    { name: "password", icon: Lock, type: showPassword ? "text" : "password", placeholder: "Password", show: true, toggle: true, required: true },
    { name: "captcha", icon: Security, type: "text", placeholder: "Enter Captcha", show: true, required: true }
  ];

  const fetchCaptcha = async () => {
    try {
      const res = await fetch(API.system.public.captcha.endpoint);
      const data = await res.json();
      setCaptchaImage(data.image);
      setFormData(prev => ({ ...prev, captchaId: data.id }));
    } catch {
      addToast("Error loading CAPTCHA.", "error");
    }
  };

  useEffect(() => {
    if (canvasRef.current) initBloodFlow(canvasRef.current);
    fetchCaptcha();
  }, [tabIndex]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleError = (msg) => {
    if (msg && lastErrorRef.current !== msg) {
      addToast(msg, "error");
      lastErrorRef.current = msg;
    }
  };

  const validateForm = async (field = null) => {
    try {
      const res = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isLogin ? "login" : "register",
          ...formData,
          validateOnly: true
        })
      });
      const data = await res.json();
      setFormValid(data.valid);

      if (!data.valid && Array.isArray(data.errors)) {
        const relevantError = data.errors.find(msg =>
          msg.toLowerCase().includes(field?.toLowerCase())
        );
        handleError(relevantError);
      } else {
        lastErrorRef.current = "";
      }
    } catch {
      handleError("Validation failed due to server error.");
      setFormValid(false);
    }
  };

  // ⬇️ Countdown timer effect for lockout
  useEffect(() => {
    if (!remainingTime || remainingTime <= 0) return;

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1000) {
          clearInterval(interval);
          setLockInfo(null);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let field of fieldConfig.filter(f => f.show && f.required)) {
      if (!formData[field.name]?.trim()) {
        addToast(`${field.placeholder} is required.`, "error");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = { type: isLogin ? "login" : "register", ...formData };
      if (isLogin) delete payload.fullName;

      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        handleError(data.message || "Authentication failed.");

        // ⬇️ Capture lock info if account is locked
        if (data.lock_info) {
          setLockInfo(data.lock_info);
          setRemainingTime(data.lock_info.remaining_ms);
        }

        setFormData({});
        fetchCaptcha();
        return;
      }

      // ✅ Success flow
      if (isLogin) {
        addToast(
          `Welcome back, ${data.user.fullName || formData.email}.`,
          "success"
        );
        localStorage.setItem("token", data.token);
        onAuthSuccess?.(data);
      } else {
        addToast(
          `Registration complete. You can now log in, ${data.user.fullName || formData.fullName}!`,
          "success"
        );
        setFormData({});
        setTabIndex(0);
        fetchCaptcha();
      }
    } catch {
      handleError("Server error. Please try again later.");
      setFormData({});
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const renderField = ({ name, icon: Icon, type, placeholder, toggle }) => (
    <div key={name} className="custom-input">
      <Icon className="input-icon" />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={formData[name] || ""}
        onChange={handleChange}
        onBlur={() => validateForm(name)}
        disabled={loading || (remainingTime > 0)}
      />
      {toggle && (
        <span
          className="toggle-password"
          onClick={() => setShowPassword(s => !s)}
        >
          {showPassword ? <VisibilityOff /> : <Visibility />}
        </span>
      )}
    </div>
  );

  const renderCaptcha = () => (
    <React.Fragment key="captcha">
      <div className="captcha-container">
        {captchaImage ? (
          <SafeImage
            src={captchaImage}
            alt="Captcha"
            className="captcha-image"
            onClick={fetchCaptcha}
            fallback={<div className="captcha-placeholder">Loading...</div>}
          />
        ) : null}
        <button type="button" className="captcha-refresh" onClick={fetchCaptcha}>
          <Refresh />
        </button>
      </div>
      {renderField(fieldConfig.find(f => f.name === "captcha"))}
    </React.Fragment>
  );

  // ⬇️ Helper to format remainingTime
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000).toString().padStart(2, "0");
    const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="auth-wrapper">
      <canvas ref={canvasRef} className="matrix-canvas"></canvas>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-tabs">
            {["Login", "Register"].map((label, idx) => (
              <button
                key={label}
                className={tabIndex === idx ? "tab active" : "tab"}
                onClick={() => setTabIndex(idx)}
                disabled={loading}
              >
                {label}
              </button>
            ))}
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
                  <h4 className="auth-subtitle">
                    {isLogin
                      ? "Jack in. Let the matrix validate you."
                      : "Create your operator ID. Get in the game."}
                  </h4>
                </motion.div>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {fieldConfig.filter(f => f.show).map(field =>
                  field.name === "captcha" ? renderCaptcha() : renderField(field)
                )}

                {/* ⬇️ Inline lockout countdown display */}
                {lockInfo && remainingTime > 0 && (
                  <div className="lock-timer-container">
                    <span className="lock-message">Your account is locked. Try again in</span>
                    <span className="lock-timer">{formatTime(remainingTime)}</span>
                  </div>
                )}


                <button
                  type="submit"
                  className="auth-btn"
                  disabled={loading || !formValid || !formData.captcha?.trim() || (remainingTime > 0)}
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
