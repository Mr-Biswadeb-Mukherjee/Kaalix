import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Security,
  Refresh
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { initBloodFlow } from "../Animation/BloodRain";
import { useToast } from "../UI/Toast";
import API from "@amon/shared";
import SafeImage from "../UI/safeImage";
import logo from "../../assets/LOGO/logo_512.png";
import "./Styles/auth.scss";

const BUSINESS_EMAIL_REQUIRED_MESSAGE =
  "Only business email addresses are allowed. Personal email providers are not permitted.";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const personalEmailDomainSet = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "rediffmail.com",
  "qq.com",
  "163.com",
  "126.com",
]);

const getEmailDomain = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return normalized.slice(atIndex + 1);
};

const isPersonalEmail = (email) => personalEmailDomainSet.has(getEmailDomain(email));

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
    {
      name: "email",
      icon: Email,
      type: "email",
      placeholder: "Email",
      autoComplete: "email",
      required: true
    },
    {
      name: "password",
      icon: Lock,
      type: showPassword ? "text" : "password",
      placeholder: "Password",
      autoComplete: "current-password",
      toggle: true,
      required: true
    },
    {
      name: "captcha",
      icon: Security,
      type: "text",
      placeholder: "Captcha Code",
      autoComplete: "off",
      required: true
    }
  ];

  const isFormDisabled =
    loading || !formValid || !formData.captcha?.trim() || remainingTime > 0;

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch(API.system.public.captcha.endpoint);
      const data = await res.json();
      setCaptchaImage(data.image);
      setFormData(prev => ({ ...prev, captchaId: data.id }));
    } catch {
      addToast("Error loading CAPTCHA.", "error");
    }
  }, [addToast]);

  useEffect(() => {
    if (canvasRef.current) initBloodFlow(canvasRef.current);
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleError = msg => {
    if (msg && lastErrorRef.current !== msg) {
      addToast(msg, "error");
      lastErrorRef.current = msg;
    }
  };

  const getFieldError = (fieldName, data) => {
    const source = data || {};

    if (fieldName === "email") {
      const email = String(source.email || "").trim().toLowerCase();
      if (!email) return "Email is required.";
      if (!emailRegex.test(email)) return "Invalid email address.";
      if (isPersonalEmail(email)) return BUSINESS_EMAIL_REQUIRED_MESSAGE;
      return "";
    }

    if (fieldName === "password") {
      return source.password?.trim() ? "" : "Password is required.";
    }

    if (fieldName === "captcha") {
      return source.captcha?.trim() ? "" : "Captcha Code is required.";
    }

    return "";
  };

  const validateForm = (fieldName, data = formData, showError = true) => {
    const error = getFieldError(fieldName, data);
    if (showError && error) {
      handleError(error);
    } else if (!error) {
      lastErrorRef.current = "";
    }
    return !error;
  };

  useEffect(() => {
    const nextFormValid = ["email", "password", "captcha"].every(
      fieldName => !getFieldError(fieldName, formData)
    );
    setFormValid(nextFormValid);
  }, [formData]);

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

  const handleSubmit = async e => {
    e.preventDefault();

    const failedField = fieldConfig.find(field => !validateForm(field.name, formData, false));
    if (failedField) {
      validateForm(failedField.name, formData, true);
      return;
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

      addToast(`Welcome back, ${data.user.fullName || formData.email}.`, "success");

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

  const formatTime = ms => {
    const minutes = Math.floor(ms / 60000)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor((ms % 60000) / 1000)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const renderField = ({
    name,
    icon: Icon,
    type,
    placeholder,
    autoComplete,
    toggle
  }) => (
    <div className="auth__input-wrapper">
      <label className="auth__label" htmlFor={`auth-${name}`}>
        {placeholder}
      </label>
      <div className="auth__input">
        <Icon className="auth__input-icon" />
        <input
          id={`auth-${name}`}
          className="auth__input-field"
          name={name}
          type={type}
          placeholder={`Enter ${placeholder.toLowerCase()}`}
          value={formData[name] || ""}
          onChange={(e) => {
            handleChange(e);

            if (name === "email") {
              const nextData = { ...formData, email: e.target.value };
              const emailError = getFieldError("email", nextData);
              if (emailError === BUSINESS_EMAIL_REQUIRED_MESSAGE) {
                handleError(emailError);
              } else if (!emailError) {
                lastErrorRef.current = "";
              }
            }
          }}
          onBlur={() => validateForm(name)}
          autoComplete={autoComplete}
          disabled={loading || remainingTime > 0}
        />
        {toggle && (
          <button
            type="button"
            className="auth__toggle-password"
            onClick={() => setShowPassword(s => !s)}
            disabled={loading || remainingTime > 0}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <VisibilityOff /> : <Visibility />}
          </button>
        )}
      </div>
    </div>
  );

  const renderCaptcha = () => (
    <>
      <div className="auth__captcha">
        {captchaImage ? (
          <SafeImage
            src={captchaImage}
            alt="Captcha"
            className="auth__captcha-image"
            onClick={fetchCaptcha}
            fallback={<div className="auth__captcha-fallback">Loading...</div>}
          />
        ) : (
          <div className="auth__captcha-fallback">Loading...</div>
        )}

        <button
          type="button"
          className="auth__captcha-refresh"
          onClick={fetchCaptcha}
          aria-label="Refresh captcha"
          disabled={loading || remainingTime > 0}
        >
          <Refresh />
        </button>
      </div>

      {renderField(fieldConfig.find(f => f.name === "captcha"))}
    </>
  );

  return (
    <div className="auth">
      <canvas ref={canvasRef} className="auth__canvas" />

      <div className="auth__container">
        <motion.div
          className="auth__card"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="auth__logo" aria-hidden="true">
            <img src={logo} alt="Kaalix" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            <h2 className="auth__title">Secure Login</h2>
            <h4 className="auth__subtitle">
              Authenticate to access the Kaalix SIEM workspace.
            </h4>
          </motion.div>

          <form onSubmit={handleSubmit} className="auth__form">
            {fieldConfig.map(field => (
              <React.Fragment key={field.name}>
                {field.name === "captcha" ? renderCaptcha() : renderField(field)}
              </React.Fragment>
            ))}

            {lockInfo && remainingTime > 0 && (
              <div className="auth__lock-container" role="status" aria-live="polite">
                <span className="auth__lock-message">
                  Account is temporarily locked. Try again in
                </span>
                <span className="auth__lock-timer">{formatTime(remainingTime)}</span>
              </div>
            )}

            <motion.button
              whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
              type="submit"
              className={`auth__button ${isFormDisabled ? "auth__button--disabled" : ""}`}
              disabled={isFormDisabled}
            >
              {loading ? "Validating..." : "Login to Kaalix"}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
