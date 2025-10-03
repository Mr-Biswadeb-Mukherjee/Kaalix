// Toast.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import './Styles/toast.css';

// Optional: MUI icons (remove if not using Material UI)
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

const ToastContext = createContext();

const iconMap = {
  success: <CheckCircleIcon className="toast-icon" />,
  error: <ErrorIcon className="toast-icon" />,
  info: <InfoIcon className="toast-icon" />,
  warning: <WarningIcon className="toast-icon" />
};

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const timers = toasts.map(({ id }) =>
      setTimeout(() => removeToast(id), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(({ id, message, type }) => (
          <div key={id} className={`toast ${type}`}>
            {iconMap[type]}
            <span>{message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
