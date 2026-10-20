import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './LoginModal.css';

const REMEMBER_KEY = 'uw_remembered_login';

export default function LoginModal({ show, onClose }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inline error message (shown as a banner inside the modal)
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // Auto-fill saved credentials when modal opens
  useEffect(() => {
    if (!show) return;
    setErrorMsg('');
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setEmail(parsed.email || '');
        setPin(parsed.pin || '');
        setRemember(true);
      } else {
        setEmail('');
        setPin('');
        setRemember(false);
      }
    } catch {
      /* ignore bad JSON */
    }
  }, [show]);

  // Clear error whenever the user edits email or PIN.
  // Uses functional updater so `errorMsg` is not read inside the effect
  // (avoids the "missing dependency" lint warning entirely).
  useEffect(() => {
    setErrorMsg((prev) => (prev ? '' : prev));
  }, [email, pin]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post(`${API_URL}/login`, { email, pin });

      // Handle "Remember me"
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, pin }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      // 1. Update auth context first (triggers re-render of App)
      login(res.data.user, res.data.token);
      showToast(`Welcome ${res.data.user.full_name}!`, 'success');

      // 2. Reset modal state
      setEmail('');
      setPin('');
      setRemember(false);
      setErrorMsg('');
      onClose();

      // 3. Navigate after a short delay to let auth state commit
      const role = res.data.user.role;
      const target =
        role === 'main_manager' ? '/main-manager' :
        role === 'manager'      ? '/manager'      :
                                  '/staff';

      setTimeout(() => navigate(target, { replace: true }), 50);
    } catch (err) {
      // Friendly, actionable error messaging
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error;

      let message;
      if (!err.response) {
        // Network / server down
        message =
          'Unable to reach the server. Please check your internet connection or contact the Stock Manager.';
      } else if (status === 401 || status === 400) {
        // Wrong email or PIN
        message =
          'Invalid email or PIN. Please enter valid credentials or contact the Stock Manager for assistance.';
      } else if (status >= 500) {
        message =
          'The server encountered an error. Please try again or contact the Stock Manager.';
      } else {
        message =
          serverMsg ||
          'Login failed. Please enter valid credentials or contact the Stock Manager.';
      }

      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForget = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setEmail('');
    setPin('');
    setRemember(false);
    setErrorMsg('');
    showToast('Saved credentials cleared', 'info');
  };

  const canSubmit = !loading && email.trim() && pin.trim();

  return (
    <div className="uw-modal-overlay" onClick={onClose}>
      <div className="uw-login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="uw-login-header">
          <i className="bi bi-box-seam-fill"></i>
          <h3>Urugo Woc LS</h3>
          <p>Enter your email and PIN to continue</p>
        </div>

        {/* Inline error banner */}
        {errorMsg && (
          <div className="uw-login-error" role="alert">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="uw-login-form">
          <div className="uw-input-group">
            <label>
              <i className="bi bi-envelope-fill"></i> Email
            </label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@urugowoc.org"
              autoComplete="username"
              required
            />
          </div>

          <div className="uw-input-group">
            <label>
              <i className="bi bi-key-fill"></i> PIN
            </label>
            <div className="uw-pin-wrap">
              <input
                type={showPin ? 'text' : 'password'}
                className="form-control"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. WH1234"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="uw-pin-toggle"
                onClick={() => setShowPin(!showPin)}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                <i className={`bi ${showPin ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
              </button>
            </div>
          </div>

          <div className="uw-remember-row">
            <label className="uw-remember-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me on this device</span>
            </label>
            {localStorage.getItem(REMEMBER_KEY) && (
              <button
                type="button"
                className="uw-forget-btn"
                onClick={handleForget}
                title="Forget saved credentials"
              >
                Forget
              </button>
            )}
          </div>

          <button className="uw-btn-primary" disabled={!canSubmit}>
            {loading ? (
              <>
                <i className="bi bi-arrow-repeat uw-spin"></i> Logging in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i> Login
              </>
            )}
          </button>

          <button type="button" className="uw-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}