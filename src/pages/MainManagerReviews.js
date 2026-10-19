import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import RequisitionForm from '../components/RequisitionForm';
import './MainManagerReviews.css';

export default function MainManagerReviews() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [requisitionFor, setRequisitionFor] = useState(null);

  // 🔑 Permission state
  const [canReview, setCanReview] = useState(false);
  const [permLoading, setPermLoading] = useState(true);
  const [permSaving, setPermSaving] = useState(false);

  const { showToast } = useNotifications();

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/requests`);
      setRequests(res.data);
    } catch { /* silent */ }
  };

  const loadPermission = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings/permissions`);
      setCanReview(!!res.data.stock_manager_can_review);
    } catch { /* silent */ }
    finally { setPermLoading(false); }
  };

  useEffect(() => {
    load();
    loadPermission();
    const int = setInterval(() => { load(); loadPermission(); }, 8000);
    const handler = () => { load(); loadPermission(); };
    window.addEventListener('uw:refresh', handler);
    return () => {
      clearInterval(int);
      window.removeEventListener('uw:refresh', handler);
    };
  }, []);

  const togglePermission = async () => {
    if (permSaving) return;
    setPermSaving(true);
    try {
      const res = await axios.put(`${API_URL}/settings/permissions/stock-manager`, {
        can_review: !canReview,
      });
      setCanReview(!!res.data.stock_manager_can_review);
      showToast(
        res.data.stock_manager_can_review
          ? 'Permission granted to Stock Manager'
          : 'Stock Manager review permission restricted',
        'success'
      );
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update permission', 'error');
    } finally {
      setPermSaving(false);
    }
  };

  const loadHistory = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/requests/${id}/history`);
      setHistory(res.data);
    } catch {
      setHistory([]);
    }
  };

  const openDetails = (r) => {
    setSelected(r);
    setComment('');
    loadHistory(r.id);
  };

  const submitReview = async (action) => {
    try {
      await axios.put(`${API_URL}/requests/${selected.id}/review`, { action, comment });
      showToast(
        `Request ${action === 'approve' ? 'approved' : 'rejected'}`,
        'success'
      );
      setSelected(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const departments = useMemo(() => {
    const set = new Set();
    requests.forEach((r) => {
      if (r.staff_department) set.add(r.staff_department);
    });
    return Array.from(set).sort();
  }, [requests]);

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (deptFilter !== 'all' && r.staff_department !== deptFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const matches =
        (r.staff_name || '').toLowerCase().includes(s) ||
        (r.staff_email || '').toLowerCase().includes(s) ||
        (r.product_name || '').toLowerCase().includes(s);
      if (!matches) return false;
    }
    return true;
  });

  const statusBadge = (s) => {
    const map = {
      pending: 'orange',
      pending_review: 'purple',
      reviewed: 'green',
      approved: 'green',
      rejected: 'red',
      completed: 'green',
      received: 'blue',
      cancelled: 'red',
    };
    return `uw-badge ${map[s] || ''}`;
  };

  const statusLabel = (s) => s.replace('_', ' ');

  return (
    <div className="uw-mmr">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-clipboard-check"></i> Requests Review
        </h2>

        {/* 🔑 Permission toggle box */}
        <div
          className="uw-permission-box"
          style={{
            marginBottom: 10,
            padding: '12px 16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 600, color: '#0a1f44' }}>
            <i className="bi bi-shield-lock"></i> Stock Manager Review Access:
          </span>
          <button
            className="uw-btn-primary"
            onClick={togglePermission}
            disabled={permSaving || permLoading}
            style={{
              minWidth: 170,
              background: canReview ? '#dc3545' : '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: permSaving || permLoading ? 'not-allowed' : 'pointer',
              opacity: permSaving || permLoading ? 0.7 : 1,
            }}
            title={
              canReview
                ? 'Click to restrict the Stock Manager from reviewing directly'
                : 'Click to grant the Stock Manager permission to review/approve requests directly'
            }
          >
            {permSaving
              ? 'Saving…'
              : canReview
              ? '🔒 Restricted'
              : '✅ Give Permission'}
          </button>
          <span
            style={{
              fontSize: '0.85rem',
              color: canReview ? '#16a34a' : '#dc3545',
              fontWeight: 500,
            }}
          >
            {canReview
              ? 'Stock Manager can review, approve & complete directly.'
              : 'Stock Manager must send requests to you for review.'}
          </span>
        </div>

        <div className="uw-filter-tabs">
          {['pending_review', 'reviewed', 'rejected', 'completed', 'received', 'all'].map((f) => (
            <button
              key={f}
              className={`uw-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Search + Department filter ===== */}
      <div className="uw-toolbar" style={{ marginBottom: 14 }}>
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input
            className="form-control"
            placeholder="Search by staff name, email, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="uw-dept-filter">
          <i className="bi bi-building"></i>
          <select
            className="form-control"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <span className="uw-count">{filtered.length} request(s)</span>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Staff</th>
              <th>Department</th>
              <th>Product</th>
              <th>Requested</th>
              <th>Received</th>
              <th>Unit</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Reviewed By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const received = r.received_quantity != null ? r.received_quantity : r.quantity;
              const changed = received !== r.quantity;
              const isNew = !!r.is_new_product;
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td className="uw-bold">{r.staff_name}</td>
                  <td><span className="uw-badge">{r.staff_department}</span></td>
                  <td>
                    {r.product_name || '—'}
                    {isNew && (
                      <span
                        className="uw-badge purple"
                        style={{ marginLeft: 8, fontSize: '0.68rem' }}
                        title={
                          r.product_id
                            ? `Recorded as product #${r.product_id}`
                            : 'New product — not yet in inventory'
                        }
                      >
                        {r.product_id ? `NEW → #${r.product_id}` : 'NEW PRODUCT'}
                      </span>
                    )}
                  </td>
                  <td><strong>{r.quantity}</strong></td>
                  <td>
                    <span className={changed ? 'uw-badge orange' : ''}>
                      <strong>{received}</strong>
                    </span>
                  </td>
                  <td>{r.requested_unit || r.product_unit}</td>
                  <td title={r.reason || ''}>
                    {r.reason
                      ? r.reason.length > 35
                        ? `${r.reason.slice(0, 35)}…`
                        : r.reason
                      : '—'}
                  </td>
                  <td>
                    <span className={statusBadge(r.status)}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td>
                    {r.reviewer_name ? (
                      <span
                        className="uw-badge"
                        style={{ background: '#e0e7ff', color: '#3730a3' }}
                      >
                        {r.reviewer_name}
                      </span>
                    ) : r.stock_manager_name ? (
                      <span
                        className="uw-badge"
                        style={{ background: '#dcfce7', color: '#166534' }}
                      >
                        {r.stock_manager_name} (Stock)
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {r.status === 'received' && r.product_id && (
                      <button
                        className="uw-icon-btn purple"
                        onClick={() => setRequisitionFor(r)}
                        title="Open Requisition Form"
                      >
                        <i className="bi bi-file-earmark-text"></i> Requisition
                      </button>
                    )}
                    <button
                      className="uw-icon-btn blue"
                      onClick={() => openDetails(r)}
                      title="View details"
                    >
                      <i className="bi bi-eye-fill"></i> View
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan="12" className="uw-no-data">No requests</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details modal */}
      {selected && (
        <div className="uw-modal-overlay" onClick={() => setSelected(null)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="uw-modal-head">
              <h4>Review Request #{selected.id}</h4>
              <button onClick={() => setSelected(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body">
              <div className="uw-detail-row"><strong>Staff:</strong> {selected.staff_name}</div>
              <div className="uw-detail-row"><strong>Email:</strong> {selected.staff_email}</div>
              <div className="uw-detail-row"><strong>Department:</strong> {selected.staff_department}</div>

              <div className="uw-detail-row">
                <strong>Product:</strong> {selected.product_name || '—'}
                {selected.is_new_product && (
                  <span
                    className="uw-badge purple"
                    style={{ marginLeft: 8 }}
                    title={
                      selected.product_id
                        ? `Recorded as product #${selected.product_id}`
                        : 'New product — not yet in inventory'
                    }
                  >
                    {selected.product_id
                      ? `NEW → #${selected.product_id}`
                      : 'NEW PRODUCT'}
                  </span>
                )}
              </div>

              {selected.is_new_product && (
                <div className="uw-detail-row">
                  <strong>Category / Unit:</strong>{' '}
                  {selected.new_product_category || 'Other'} /{' '}
                  {selected.new_product_unit || 'pieces'}
                </div>
              )}

              <div className="uw-detail-row">
                <strong>Requested Quantity:</strong> {selected.quantity}{' '}
                {selected.requested_unit || selected.product_unit}
              </div>
              <div className="uw-detail-row">
                <strong>Received Quantity:</strong>{' '}
                {selected.received_quantity != null ? selected.received_quantity : selected.quantity}{' '}
                {selected.requested_unit || selected.product_unit}
                {selected.received_quantity != null &&
                  selected.received_quantity !== selected.quantity && (
                    <span className="uw-badge orange" style={{ marginLeft: 8 }}>
                      Adjusted by Stock Manager
                    </span>
                  )}
              </div>
              <div className="uw-detail-row">
                <strong>Reason:</strong> {selected.reason || '—'}
              </div>
              <div className="uw-detail-row">
                <strong>Status:</strong>{' '}
                <span className={statusBadge(selected.status)}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <div className="uw-detail-row">
                <strong>Requested:</strong> {new Date(selected.created_at).toLocaleString()}
              </div>

              {selected.reviewer_name && (
                <div className="uw-detail-row">
                  <strong>Reviewed By:</strong> {selected.reviewer_name}
                </div>
              )}
              {selected.stock_manager_name && !selected.reviewer_name && (
                <div className="uw-detail-row">
                  <strong>Reviewed By (Stock):</strong> {selected.stock_manager_name}
                </div>
              )}
              {selected.manager_notes && (
                <div className="uw-detail-row">
                  <strong>Stock Manager Notes:</strong> {selected.manager_notes}
                </div>
              )}
              {selected.reviewer_notes && (
                <div className="uw-detail-row">
                  <strong>Reviewer Notes:</strong> {selected.reviewer_notes}
                </div>
              )}

              {history.length > 0 && (
                <>
                  <h5 style={{ marginTop: 18, color: '#0a1f44' }}>History</h5>
                  <div className="uw-history">
                    {history.map((h) => (
                      <div key={h.id} className="uw-history-item">
                        <div className="uw-history-title">
                          <i className="bi bi-clock-history"></i>{' '}
                          {h.action.replace('_', ' ')} — {h.reviewer_name || 'System'}
                        </div>
                        {h.comment && (
                          <div className="uw-history-comment">"{h.comment}"</div>
                        )}
                        <div className="uw-history-time">
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {selected.status === 'pending_review' && (
                <>
                  <div style={{ marginTop: 16 }}>
                    <label
                      style={{
                        fontWeight: 600,
                        color: '#0a1f44',
                        marginBottom: 6,
                        display: 'block',
                      }}
                    >
                      Your Comment (optional)
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Explain your decision..."
                    />
                  </div>
                  <div className="uw-modal-actions">
                    <button
                      className="uw-btn-secondary"
                      onClick={() => submitReview('reject')}
                    >
                      <i className="bi bi-x-lg"></i> Reject
                    </button>
                    <button
                      className="uw-btn-primary"
                      onClick={() => submitReview('approve')}
                    >
                      <i className="bi bi-check-lg"></i> Approve
                    </button>
                  </div>
                </>
              )}

              {selected.status === 'received' && selected.product_id && (
                <div className="uw-modal-actions">
                  <button
                    className="uw-btn-primary"
                    onClick={() => { setRequisitionFor(selected); setSelected(null); }}
                  >
                    <i className="bi bi-file-earmark-text"></i> Open Requisition Form
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requisition modal */}
      {requisitionFor && (
        <RequisitionForm
          request={requisitionFor}
          onClose={() => setRequisitionFor(null)}
        />
      )}
    </div>
  );
}