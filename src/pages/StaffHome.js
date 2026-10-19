import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import './StaffHome.css';

export default function StaffHome() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/requests`).then(res => setRequests(res.data)).catch(() => {});
  }, []);

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="uw-sh">
      <h2 className="uw-page-title">
        <i className="bi bi-speedometer2"></i> Hello, {user?.full_name}
      </h2>
      <p style={{ color: '#6c7a92', marginBottom: 22 }}>
        Department: <strong>{user?.department}</strong>
      </p>

      <div className="uw-stat-grid">
        <div className="uw-stat-card">
          <div className="uw-stat-icon blue"><i className="bi bi-inbox"></i></div>
          <div>
            <div className="uw-stat-label">Total Requests</div>
            <div className="uw-stat-value">{counts.total}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon orange"><i className="bi bi-hourglass-split"></i></div>
          <div>
            <div className="uw-stat-label">Pending</div>
            <div className="uw-stat-value">{counts.pending}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon green"><i className="bi bi-check-circle"></i></div>
          <div>
            <div className="uw-stat-label">Approved</div>
            <div className="uw-stat-value">{counts.approved}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon purple"><i className="bi bi-box-arrow-up"></i></div>
          <div>
            <div className="uw-stat-label">Completed</div>
            <div className="uw-stat-value">{counts.completed}</div>
          </div>
        </div>
      </div>

      <div className="uw-card" style={{ marginTop: 20 }}>
        <h5><i className="bi bi-info-circle"></i> Getting Started</h5>
        <p style={{ color: '#4a5568' }}>
          Use the sidebar to submit a new product request or track the status of your existing requests.
          You can cancel any request that is still pending.
        </p>
      </div>
    </div>
  );
}