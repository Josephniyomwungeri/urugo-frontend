import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const { notifications, markOneRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => setOpen(!open);

  // ✅ NEW: click a notification → mark that one as read
  const handleClickItem = (n) => {
    if (!n.is_read) markOneRead(n.id);
    // Optional: navigate to n.link if you use react-router
    // if (n.link) navigate(n.link);
  };

  return (
    <div className="uw-notif-wrap" ref={ref}>
      <button className="uw-notif-btn" onClick={handleOpen}>
        <i className="bi bi-bell-fill"></i>
        {unread > 0 && <span className="uw-notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="uw-notif-panel">
          <div className="uw-notif-header">
            <strong>Notifications</strong>
            {unread > 0 && <span className="uw-notif-count">{unread} new</span>}
          </div>
          <div className="uw-notif-list">
            {notifications.length === 0 && <p className="uw-notif-empty">No notifications</p>}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`uw-notif-item ${!n.is_read ? 'uw-notif-unread' : 'uw-notif-read'}`}
                onClick={() => handleClickItem(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClickItem(n); }}
              >
                <div className="uw-notif-title">{n.title}</div>
                <div className="uw-notif-msg">{n.message}</div>
                <div className="uw-notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}