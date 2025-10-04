import React, { useState, useEffect } from "react";
import Modal from "../UI/Modal";
import "./Styles/MFA.css";
import API from "@amon/shared";
import { useToast } from "../UI/Toast";
import SafeImage from '../UI/safeImage';

const MFA = () => {
  const { addToast } = useToast();
  const token = localStorage.getItem("token");

  const [mfaMethods, setMfaMethods] = useState({
    backup_codes: "disabled",
    google_authenticator: "disabled",
    passkeys: "disabled",
  });
  const [activeMethod, setActiveMethod] = useState(null); // setup in progress
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmDisableMethod, setConfirmDisableMethod] = useState(null); // method to confirm disabling

  const notify = {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
  };

  // ----------------- Fetch current MFA status -----------------
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API.system.protected.MFA.endpoint}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.status) {
          setMfaMethods((prev) => ({ ...prev, ...data.status }));
        }
      } catch (err) {
        console.error("Failed to fetch MFA status:", err);
      }
    };
    fetchStatus();
  }, [token]);

  // ----------------- Toggle MFA -----------------
  const handleToggle = async (method) => {
    try {
      setLoading(true);

      const action = mfaMethods[method] === "enabled" ? "disable" : "setup";

      if (action === "disable") {
        // Open confirmation modal instead of disabling immediately
        setConfirmDisableMethod(method);
        return;
      }

      // Setup flow
      const res = await fetch(API.system.protected.MFA.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ method, action }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to update MFA");
      }

      const data = await res.json();

      if (data.qrBlob) {
        const blob = new Blob([new Uint8Array(data.qrBlob.data)], { type: "image/png" });
        const qrDataUrl = URL.createObjectURL(blob);

        setQrCodeUrl(qrDataUrl);
        setActiveMethod(method); // open OTP verification modal
      }
    } catch (err) {
      console.error("MFA toggle error:", err);
      notify.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------- Verify OTP -----------------
  const handleVerifyOtp = async () => {
    if (!otp.trim()) return notify.error("Please enter the OTP code");

    try {
      setVerifying(true);

      const res = await fetch(`${API.system.protected.MFA.endpoint}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ method: activeMethod, token: otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed");

      setMfaMethods((prev) => ({ ...prev, [activeMethod]: "enabled" }));
      notify.success("MFA verified and enabled successfully");

      // Revoke QR ObjectURL to free memory
      if (qrCodeUrl) URL.revokeObjectURL(qrCodeUrl);

      // Reset modal and OTP state
      setActiveMethod(null);
      setQrCodeUrl(null);
      setOtp("");
    } catch (err) {
      console.error("OTP verification error:", err);
      notify.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // ----------------- Confirm Disable MFA -----------------
  const handleConfirmDisable = async () => {
    if (!confirmDisableMethod) return;

    try {
      setLoading(true);
      const method = confirmDisableMethod;

      const res = await fetch(API.system.protected.MFA.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ method, action: "disable" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to disable MFA");

      setMfaMethods((prev) => ({ ...prev, [method]: "disabled" }));
      notify.success(`${method.replace("_", " ")} disabled successfully`);
    } catch (err) {
      console.error("MFA disable error:", err);
      notify.error(err.message);
    } finally {
      setLoading(false);
      setConfirmDisableMethod(null); // close confirmation modal
    }
  };

  const getCheckboxState = (status) => status === "enabled";
  const getLabel = (status) => (status === "enabled" ? "Enabled" : "Disabled");

  return (
    <section className="mfa-section">
      <h3 className="mfa-heading">Multi-Factor Authentication</h3>
      <p className="mfa-description">
        Add an extra layer of security to your account by enabling MFA methods.
      </p>

      <div className="mfa-list">
        {[
          { key: "backup_codes", label: "Backup Codes" },
          { key: "google_authenticator", label: "Google Authenticator" },
          { key: "passkeys", label: "Passkeys" },
        ].map(({ key, label }) => (
          <div className="mfa-item" key={key}>
            <span>{label}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={getCheckboxState(mfaMethods[key])}
                onChange={() => handleToggle(key)}
                disabled={loading || activeMethod !== null || confirmDisableMethod !== null}
              />
              <span className="slider"></span>
            </label>
            
          </div>
        ))}
      </div>

      {/* OTP Verification Modal */}
      {activeMethod && qrCodeUrl && (
      <Modal
        isOpen={!!activeMethod}
        onClose={() => {
          if (!verifying) {
            if (qrCodeUrl) URL.revokeObjectURL(qrCodeUrl); // cleanup
            setActiveMethod(null);
            setQrCodeUrl(null);
            setOtp("");
          }
        }}
        title={`Setup ${activeMethod.replace("_", " ")}`}
      >
      <div className="otp-setup-modal">
        <div className="qr-section">
          <SafeImage src={qrCodeUrl} alt="MFA QR Code" className="qr-image" />
          <p className="qr-text">Scan this QR code with your Authenticator App</p>
        </div>

        <div className="divider" />

        <div className="otp-section">
          <label htmlFor="otp" className="otp-label">
            Enter OTP from Authenticator
          </label>
          <input
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            className="otp-input-styled"
            disabled={verifying}
          />
          <button
            className="btn btn-verify"
            onClick={handleVerifyOtp}
            disabled={verifying}
          >
            {verifying ? "Verifying..." : "Verify & Enable"}
          </button>
        </div>
      </div>
      </Modal>
      )}

      {/* Disable Confirmation Modal */}
      {confirmDisableMethod && (
        <Modal
          isOpen={!!confirmDisableMethod}
          onClose={() => setConfirmDisableMethod(null)}
          title={`Disable ${confirmDisableMethod.replace("_", " ")}?`}
          actions={
            <>
              <button
                className="btn btn-cancel"
                onClick={() => setConfirmDisableMethod(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDisable}
                disabled={loading}
              >
                {loading ? "Disabling..." : "Disable"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to disable{" "}
            <strong>{confirmDisableMethod.replace("_", " ")}</strong>? This action
            will remove all associated MFA data for this method.
          </p>
        </Modal>
      )}
    </section>
  );
};

export default MFA;
