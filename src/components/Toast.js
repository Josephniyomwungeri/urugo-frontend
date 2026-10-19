import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import './Toast.css';

export default function ToastContainer() {
  const { toasts } = useNotifications();
  return (
    <div className="uw-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`uw-toast uw-toast-${t.type}`}>
          <i className={`bi ${
            t.type === 'success' ? 'bi-check-circle-fill' :
            t.type === 'error' ? 'bi-x-circle-fill' :
            t.type === 'warning' ? 'bi-exclamation-triangle-fill' :
            'bi-info-circle-fill'
          }`}></i>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}