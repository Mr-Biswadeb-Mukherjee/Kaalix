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
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
  isValidEmailFormat,
} from "../../Utils/businessEmailPolicy";
import {
  getBackendErrorDisplay,
  getBackendErrorMessage,
  parseApiResponse,
} from "../../Utils/apiError";
import RouteError from "./RouteError";
import "./Styles/auth.scss";

const PAGE_LEVEL_LOGIN_ERROR_STATUSES = new Set([429]);

const shouldRenderAuthErrorPage = (err) => {
  const status = typeof err?.status === "number" ? err.status : null;
  if (!status) return false;
  return status >= 500 || PAGE_LEVEL_LOGIN_ERROR_STATUSES.has(status);
};

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
  const [challengeRemainingTime, setChallengeRemainingTime] = useState(0);
  const [authErrorPage, setAuthErrorPage] = useState(null);
  const lastErrorRef = useRef("");
  const challengeExpiredNoticeRef = useRef(false);

  const authEndpoint = API.system.public.login.endpoint;
  const captchaEndpoint = API.system.public.captcha.endpoint;
  const captchaRefreshEndpoint = API.system.public.captchaRefresh.endpoint;
  const formNonce = String(formData.formNonce || "");

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
    loading ||
    !formValid ||
    !formData.captcha?.trim() ||
    remainingTime > 0 ||
    challengeRemainingTime <= 0;

  const handleError = useCallback((msg) => {
    if (msg && lastErrorRef.current !== msg) {
      addToast(msg, "error");
      lastErrorRef.current = msg;
    }
  }, [addToast]);

  const fetchInitialCaptcha = useCallback(async () => {
    try {
      const res = await fetch(captchaEndpoint);
      const data = await parseApiResponse(res);
      const ttlSeconds =
        typeof data?.ttlSeconds === "number" && data.ttlSeconds > 0
          ? data.ttlSeconds
          : 60;
      if (!data?.id || !data?.image || !data?.formNonce || !data?.captchaNonce) {
        throw new Error("Captcha challenge payload is incomplete.");
      }
      setAuthErrorPage(null);
      setCaptchaImage(data.image);
      challengeExpiredNoticeRef.current = false;
      setChallengeRemainingTime(ttlSeconds * 1000);
      setFormData(prev => ({
        ...prev,
        captcha: "",
        captchaId: data.id,
        formNonce: data.formNonce,
        captchaNonce: data.captchaNonce,
      }));
    } catch (err) {
      setChallengeRemainingTime(0);
      setFormData(prev => ({
        ...prev,
        captcha: "",
        captchaId: "",
        formNonce: "",
        captchaNonce: "",
      }));
      addToast(getBackendErrorMessage(err), "error");
      if (shouldRenderAuthErrorPage(err)) {
        setAuthErrorPage(getBackendErrorDisplay(err));
      }
    }
  }, [addToast, captchaEndpoint]);

  useEffect(() => {
    if (canvasRef.current) initBloodFlow(canvasRef.current);
    fetchInitialCaptcha();
  }, [fetchInitialCaptcha]);

  const refreshCaptchaOnly = useCallback(async ({ showError = true } = {}) => {
    if (!formNonce) {
      if (showError) {
        handleError("Form token missing. Refresh captcha to continue.");
      }
      return false;
    }

    if (challengeRemainingTime <= 0) {
      if (showError) {
        handleError("Login form token expired. Refresh captcha to continue.");
      }
      return false;
    }

    try {
      const response = await fetch(captchaRefreshEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formNonce }),
      });

      const data = await parseApiResponse(response);
      const ttlSeconds =
        typeof data?.ttlSeconds === "number" && data.ttlSeconds > 0
          ? data.ttlSeconds
          : 60;

      if (!data?.id || !data?.image || !data?.captchaNonce) {
        throw new Error("Captcha refresh payload is incomplete.");
      }

      setAuthErrorPage(null);
      setCaptchaImage(data.image);
      challengeExpiredNoticeRef.current = false;
      setChallengeRemainingTime(ttlSeconds * 1000);
      setFormData(prev => ({
        ...prev,
        captcha: "",
        captchaId: data.id,
        captchaNonce: data.captchaNonce,
      }));
      return true;
    } catch (err) {
      if (showError) {
        handleError(getBackendErrorMessage(err));
      }
      if (shouldRenderAuthErrorPage(err)) {
        setAuthErrorPage(getBackendErrorDisplay(err));
      }
      if (err?.code === "FORM_NONCE_EXPIRED") {
        setChallengeRemainingTime(0);
        setFormData(prev => ({
          ...prev,
          captcha: "",
          captchaId: "",
          captchaNonce: "",
        }));
      }
      return false;
    }
  }, [
    captchaRefreshEndpoint,
    challengeRemainingTime,
    formNonce,
    handleError,
  ]);

  const handleCaptchaRefresh = useCallback(async () => {
    if (formNonce && challengeRemainingTime > 0) {
      const refreshed = await refreshCaptchaOnly();
      if (refreshed) return;
    }
    await fetchInitialCaptcha();
  }, [
    challengeRemainingTime,
    fetchInitialCaptcha,
    formNonce,
    refreshCaptchaOnly,
  ]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getFieldError = (fieldName, data) => {
    const source = data || {};

    if (fieldName === "email") {
      const email = String(source.email || "").trim().toLowerCase();
      if (!email) return "Email is required.";
      if (!isValidEmailFormat(email)) return "Invalid email address.";
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

  useEffect(() => {
    if (!challengeRemainingTime || challengeRemainingTime <= 0) return;

    const interval = setInterval(() => {
      setChallengeRemainingTime(prev => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [challengeRemainingTime]);

  useEffect(() => {
    if (challengeRemainingTime > 0) return;

    const hasChallenge = Boolean(formData.captchaId || formData.formNonce || formData.captchaNonce);
    if (!hasChallenge || challengeExpiredNoticeRef.current) return;

    challengeExpiredNoticeRef.current = true;
    handleError("Login form challenge expired. Refresh captcha to continue.");
    setFormData(prev => ({
      ...prev,
      captcha: "",
      captchaId: "",
      captchaNonce: "",
    }));
  }, [
    challengeRemainingTime,
    formData.captchaId,
    formData.formNonce,
    formData.captchaNonce,
    handleError,
  ]);

  const handleSubmit = async e => {
    e.preventDefault();

    if (challengeRemainingTime <= 0) {
      handleError("Login form challenge expired. Refresh captcha to continue.");
      return;
    }

    if (!formData.formNonce) {
      handleError("Form token missing. Refresh captcha to continue.");
      return;
    }

    if (!formData.captchaId || !formData.formNonce || !formData.captchaNonce) {
      handleError("Captcha verification required. Refresh captcha and try again.");
      return;
    }

    const failedField = fieldConfig.find(field => !validateForm(field.name, formData, false));
    if (failedField) {
      validateForm(failedField.name, formData, true);
      return;
    }

    setLoading(true);
    setAuthErrorPage(null);

    try {
      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "login",
          ...formData
        })
      });

      const data = await parseApiResponse(response, { requireSuccess: true });

      addToast(`Welcome back, ${data.user.fullName || formData.email}.`, "success");

      localStorage.setItem("token", data.token);
      onAuthSuccess?.(data);
    } catch (err) {
      const hasBackendStatus = typeof err?.status === "number";
      if (err?.data?.lock_info) {
        setLockInfo(err.data.lock_info);
        setRemainingTime(err.data.lock_info.remaining_ms);
      }
      if (hasBackendStatus && shouldRenderAuthErrorPage(err)) {
        setAuthErrorPage(getBackendErrorDisplay(err));
        return;
      }
      handleError(getBackendErrorMessage(err));
      if (err?.code === "FORM_NONCE_EXPIRED") {
        setChallengeRemainingTime(0);
        setFormData(prev => ({
          ...prev,
          captcha: "",
          captchaId: "",
          captchaNonce: "",
        }));
        return;
      }

      setFormData(prev => ({ ...prev, captcha: "" }));
      await refreshCaptchaOnly({ showError: false });
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
          disabled={loading || remainingTime > 0 || challengeRemainingTime <= 0}
        />
        {toggle && (
          <button
            type="button"
            className="auth__toggle-password"
            onClick={() => setShowPassword(s => !s)}
            disabled={loading || remainingTime > 0 || challengeRemainingTime <= 0}
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
            onClick={handleCaptchaRefresh}
            fallback={<div className="auth__captcha-fallback">Loading...</div>}
          />
        ) : (
          <div className="auth__captcha-fallback">Loading...</div>
        )}

        <button
          type="button"
          className="auth__captcha-refresh"
          onClick={handleCaptchaRefresh}
          aria-label="Refresh captcha"
          disabled={loading || remainingTime > 0}
        >
          <Refresh />
        </button>
      </div>

      <div className="auth__challenge-meta" role="status" aria-live="polite">
        {challengeRemainingTime > 0 ? (
          <span>Challenge expires in {formatTime(challengeRemainingTime)}</span>
        ) : (
          <span>Challenge expired. Refresh captcha.</span>
        )}
      </div>

      {renderField(fieldConfig.find(f => f.name === "captcha"))}
    </>
  );

  if (authErrorPage) {
    return (
      <div className="auth">
        <canvas ref={canvasRef} className="auth__canvas" />
        <div className="auth__container">
          <RouteError
            status={authErrorPage.status}
            code={authErrorPage.code}
            title={authErrorPage.title}
            message={authErrorPage.message}
            actionLabel="Back to Login"
            onAction={() => {
              setAuthErrorPage(null);
              if (formNonce && challengeRemainingTime > 0) {
                handleCaptchaRefresh();
                return;
              }
              fetchInitialCaptcha();
            }}
          />
        </div>
      </div>
    );
  }

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
              Authenticate to access the Kaalix security workspace.
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
