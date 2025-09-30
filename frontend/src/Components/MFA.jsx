import React, { useState } from "react";
import Modal from "./Modal";
import "./Styles/MFA.css";
import API from "@amon/shared";
import { useToast } from "../Components/Toast";

const MFA = () => {
  const { addToast } = useToast();
  const token = localStorage.getItem("token");

  // Track which methods are enabled
  const [mfaMethods, setMfaMethods] = useState({
    backup_codes: false,
    google_authenticator: false,
    passkeys: false,
  });

  // Currently active method for modal
  const [activeMethod, setActiveMethod] = useState(null);
  const [loading, setLoading] = useState(false);

  const notify = {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    warning: (msg) => addToast(msg, "warning"),
  };

  const handleToggle = async (method) => {
    try {
      setLoading(true);

      // Call single API for all methods
      const res = await fetch(API.system.protected.MFA.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          enabled: !mfaMethods[method], // toggled value
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update MFA");

      // Update local state
      setMfaMethods((prev) => ({
        ...prev,
        [method]: !prev[method],
      }));

      notify.success(
        `${method.replace("_", " ")} ${
          !mfaMethods[method] ? "enabled" : "disabled"
        } successfully`
      );

      // If enabling, open modal
      if (!mfaMethods[method]) setActiveMethod(method);
    } catch (err) {
      console.error("MFA toggle error:", err);
      notify.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                checked={mfaMethods[key]}
                onChange={() => handleToggle(key)}
                disabled={loading}
              />
              <span className="slider"></span>
            </label>
          </div>
        ))}
      </div>

      {/* Modal for enabling method */}
      {activeMethod && (
        <Modal
          isOpen={!!activeMethod}
          onClose={() => setActiveMethod(null)}
          title={`Setup ${activeMethod.replace("_", " ")}`}
          actions={
            <button
              className="btn btn-save"
              onClick={() => setActiveMethod(null)}
            >
              Done
            </button>
          }
        >
          <p>
            Follow the steps to complete setup for{" "}
            <strong>{activeMethod.replace("_", " ")}</strong>.
          </p>
          {/* Optionally insert QR code, backup codes, or WebAuthn instructions here */}
        </Modal>
      )}
    </section>
  );
};

export default MFA;
