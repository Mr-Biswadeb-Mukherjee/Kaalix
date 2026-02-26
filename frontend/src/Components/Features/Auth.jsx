import React, { useEffect, useRef, useState } from "react";
import {
  Email, Lock, Visibility, VisibilityOff, Security, Refresh
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { initBloodFlow } from "../Animation/BloodRain";
import { useToast } from "../UI/Toast";
import API from "@amon/shared";
import SafeImage from "../UI/safeImage";
import "./Styles/auth.css";

const Auth = ({ onAuthSuccess }) => {
  const canvasRef = useRef(null);
  const { addToast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [captchaImage, setCaptchaImage] = useState(null);
  const [lockInfo, setLockInfo] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const lastErrorRef = useRef("");

  const authEndpoint = API.system.public.login.endpoint;

  const fieldConfig = [
    { name: "email", icon: Email, type: "email", placeholder: "Email", required: true },
    { name: "password", icon: Lock, type: showPassword ? "text" : "password", placeholder: "Password", toggle: true, required: true },
    { name: "captcha", icon: Security, type: "text", placeholder: "Enter Captcha", required: true }
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
  }, []);

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
          type: "login",
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

    for (let field of fieldConfig) {
      if (!formData[field.name]?.trim()) {
        addToast(`${field.placeholder} is required.`, "error");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "login",
          ...formData
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        handleError(data.message || "Authentication failed.");

        if (data.lock_info) {
          setLockInfo(data.lock_info);
          setRemainingTime(data.lock_info.remaining_ms);
        }

        setFormData({});
        fetchCaptcha();
        return;
      }

      addToast(
        `Welcome back, ${data.user.fullName || formData.email}.`,
        "success"
      );

      localStorage.setItem("token", data.token);
      onAuthSuccess?.(data);

    } catch {
      handleError("Server error. Please try again later.");
      setFormData({});
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000).toString().padStart(2, "0");
    const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
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
        disabled={loading || remainingTime > 0}
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
    <>
      <div className="captcha-container">
        {captchaImage && (
          <SafeImage
            src={captchaImage}
            alt="Captcha"
            className="captcha-image"
            onClick={fetchCaptcha}
            fallback={<div className="captcha-placeholder">Loading...</div>}
          />
        )}
        <button type="button" className="captcha-refresh" onClick={fetchCaptcha}>
          <Refresh />
        </button>
      </div>
      {renderField(fieldConfig.find(f => f.name === "captcha"))}
    </>
  );

  return (
    <div className="auth-wrapper">
      <canvas ref={canvasRef} className="matrix-canvas"></canvas>

      <div className="auth-container">
        <div className="auth-card">

          <div className="auth-header">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="auth-title">Access Granted</h2>
              <h4 className="auth-subtitle">
                Jack in. Let the matrix validate you.
              </h4>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {fieldConfig.map(field =>
              field.name === "captcha"
                ? renderCaptcha()
                : renderField(field)
            )}

            {lockInfo && remainingTime > 0 && (
              <div className="lock-timer-container">
                <span className="lock-message">
                  Your account is locked. Try again in
                </span>
                <span className="lock-timer">
                  {formatTime(remainingTime)}
                </span>
              </div>
            )}

            <button
              type="submit"
              className="auth-btn"
              disabled={
                loading ||
                !formValid ||
                !formData.captcha?.trim() ||
                remainingTime > 0
              }
            >
              {loading ? "Validating..." : "Login to Amon"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Auth;