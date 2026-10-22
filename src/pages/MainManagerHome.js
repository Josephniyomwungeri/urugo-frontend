import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import './MainManagerHome.css';

export default function MainManagerHome() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [overview, stats] = await Promise.all([
        axios.get(`${API_URL}/finance-manager/overview`),
        axios.get(`${API_URL}/dashboard/stats`),
      ]);
      setData({ ...overview.data, stats: stats.data });
    } catch {}
  };

  useEffect(() => {
    load();
    const int = setInterval(load, 10000);
    return () => clearInterval(int);
  }, []);

  if (!data) return <div className="uw-loading">Loading overview...</div>;

  return (
    <div className="uw-mmh">
      <h2 className="uw-page-title">
        <i className="bi bi-shield-check"></i> Main Manager Overview
      </h2>

      {/* KPI Cards */}
      <div className="uw-mmh-grid">
        <div className="uw-mmh-card purple" onClick={() => navigate('/finance-manager/reviews')}>
          <i className="bi bi-clipboard-check"></i>
          <div className="uw-mmh-value">{data.pendingReviews}</div>
          <div className="uw-mmh-label">Pending Reviews</div>
        </div>
        <div className="uw-mmh-card blue">
          <i className="bi bi-inbox"></i>
          <div className="uw-mmh-value">{data.totalRequests}</div>
          <div className="uw-mmh-label">Total Requests</div>
        </div>
        <div className="uw-mmh-card green">
          <i className="bi bi-check-circle-fill"></i>
          <div className="uw-mmh-value">{data.approvedByMe}</div>
          <div className="uw-mmh-label">Approved by Me</div>
        </div>
        <div className="uw-mmh-card red">
          <i className="bi bi-x-circle-fill"></i>
          <div className="uw-mmh-value">{data.rejectedByMe}</div>
          <div className="uw-mmh-label">Rejected by Me</div>
        </div>
        <div className="uw-mmh-card orange">
          <i className="bi bi-clipboard-data"></i>
          <div className="uw-mmh-value">{data.usageTotals.used}</div>
          <div className="uw-mmh-label">Total Used</div>
        </div>
        <div className="uw-mmh-card teal">
          <i className="bi bi-box-seam"></i>
          <div className="uw-mmh-value">{data.usageTotals.remaining}</div>
          <div className="uw-mmh-label">Total Remaining</div>
        </div>
      </div>

      {/* Pending Reviews List */}
      <div className="uw-mmh-section">
        <div className="uw-mmh-section-head">
          <h5><i className="bi bi-clipboard-check"></i> Requests Awaiting Review</h5>
          <button className="uw-btn-primary" onClick={() => navigate('/finance-manager/reviews')}>
            View All <i className="bi bi-arrow-right"></i>
          </button>
        </div>
        {data.pendingReviewList.length === 0 ? (
          <p className="uw-empty">Nothing to review right now 🎉</p>
        ) : (
          <div className="uw-table-wrap">
            <table className="uw-excel-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Staff</th>
                  <th>Department</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingReviewList.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td className="uw-bold">{r.staff_name}</td>
                    <td><span className="uw-badge">{r.staff_department}</span></td>
                    <td>{r.product_name}</td>
                    <td><strong>{r.quantity}</strong> {r.unit}</td>
                    <td>
                      <button className="uw-icon-btn purple" onClick={() => navigate('/finance-manager/reviews')}>
                        <i className="bi bi-eye-fill"></i> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="uw-mmh-section">
        <h5><i className="bi bi-activity"></i> Recent Activity</h5>
        <div className="uw-activity-list">
          {data.recentActivity.map((a, i) => (
            <div key={i} className="uw-activity-item">
              <div className={`uw-activity-icon ${a.type}`}>
                <i className={`bi ${
                  a.type === 'stock_in' ? 'bi-box-arrow-in-down' :
                  a.type === 'stock_out' ? 'bi-box-arrow-up' : 'bi-exclamation-triangle'
                }`}></i>
              </div>
              <div className="uw-activity-info">
                <div className="uw-activity-title">
                  {a.type === 'stock_in' && 'Stock In'}
                  {a.type === 'stock_out' && 'Stock Out'}
                  {a.type === 'loss' && 'Loss Recorded'}
                </div>
                <div className="uw-activity-meta">
                  Product #{a.product_id} • Qty {a.quantity} • {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {data.recentActivity.length === 0 && <p className="uw-empty">No activity yet</p>}
        </div>
      </div>
    </div>
  );
}