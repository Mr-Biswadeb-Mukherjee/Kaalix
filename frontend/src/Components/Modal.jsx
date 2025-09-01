// Modal.jsx
import React, { useEffect, useRef } from "react";
import "./Styles/Modal.css";

const Modal = ({ isOpen, onClose, title, children, actions, size = "md", scrollable = false }) => {
  const modalRef = useRef();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on outside click
  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={handleOutsideClick}>
      <div
        ref={modalRef}
        className={`modal-content modal-${size} ${scrollable ? "modal-scrollable" : ""}`}
      >
        {/* Header */}
        {title && (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button onClick={onClose} className="modal-close" aria-label="Close modal">
              &times;
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Actions */}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};

export default Modal;
