import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);

    // Fire a global event that any page can listen to for data reload
    window.dispatchEvent(new CustomEvent('uw:refresh'));

    // Also nudge the notification system to poll now
    window.dispatchEvent(new CustomEvent('uw:refresh-notifications'));

    // Give the UI a nice spinning feedback for ~700ms
    setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <nav className="uw-navbar">
      <div className="uw-navbar-left">
        <button className="uw-menu-btn" onClick={onMenuClick} title="Toggle menu">
          <i className="bi bi-list"></i>
        </button>
        <div className="uw-logo">
          <i className="bi bi-box-seam-fill"></i>
          <span>Urugo Woc</span>
        </div>
      </div>

      <div className="uw-navbar-right">
        {/* Refresh button */}
        <button
          className={`uw-refresh-btn ${refreshing ? 'uw-refreshing' : ''}`}
          onClick={handleRefresh}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <i className="bi bi-arrow-clockwise"></i>
        </button>

        <NotificationBell />

        <div className="uw-user-chip">
          <i className="bi bi-person-circle"></i>
          <div>
            <div className="uw-user-name">{user?.full_name}</div>
            <div className="uw-user-role">
              {user?.role === 'finance_manager'
                ? 'Finance Manager'
                : user?.role === 'manager'
                ? 'Stock Manager'
                : `${user?.department} Staff`}
            </div>
          </div>
        </div>

        <button className="uw-logout-btn" onClick={logout} title="Logout">
          <i className="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
  );
}