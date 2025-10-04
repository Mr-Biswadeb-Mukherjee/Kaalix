import React, { useEffect, useRef } from "react";
import "./Styles/Modal.css";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  scrollable = false,
}) => {
  const modalRef = useRef();

  useEffect(() => {
    const handleKeyDown = (e) => e.key === "Escape" && onClose();
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={handleOutsideClick}>
      <div
        ref={modalRef}
        className={`modal-content ${scrollable ? "modal-scrollable" : ""}`}
      >
        {title && (
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <button
              onClick={onClose}
              className="modal-close"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        )}

        <div className="modal-body">{children}</div>

        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};

export default Modal;
