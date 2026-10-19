import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import RequisitionForm from '../components/RequisitionForm';
import './ManagerRequests.css';

const ALL_CATEGORIES = ['Food', 'Medical', 'WASH', 'Vehicles', 'Equipment', 'Office', 'Other'];
const ALL_UNITS = ['pieces', 'kg', 'litres', 'boxes', 'cartons', 'bags', 'packs', 'bottles'];
const CURRENCIES = ['USD', 'EUR', 'RWF', 'KES', 'UGX', 'TZS'];

const emptyInventoryForm = {
  quantity: 0,
  unit_price: 0,
  currency: 'USD',
  batch_number: '',
  expiry_date: '',
  supplier: '',
  min_stock: 10,
  category: 'Other',
};

export default function ManagerRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [editingReceived, setEditingReceived] = useState({});
  const [requisitionFor, setRequisitionFor] = useState(null);
  const { showToast } = useNotifications();

  // 🔑 Permission state
  const [canReviewDirectly, setCanReviewDirectly] = useState(false);

  // 🆕 Record-inventory modal state
  const [recordFor, setRecordFor] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(emptyInventoryForm);
  const [savingInventory, setSavingInventory] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/requests`);
      setRequests(res.data);
      setEditingReceived({});
    } catch {
      showToast('Failed to load requests', 'error');
    }
  };

  const loadPermission = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings/permissions`);
      setCanReviewDirectly(!!res.data.stock_manager_can_review);
    } catch { /* silent */ }
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

  const loadHistory = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/requests/${id}/history`);
      setHistory(res.data);
    } catch { setHistory([]); }
  };

  const openDetails = (r) => {
    setSelected(r);
    loadHistory(r.id);
  };

  const updateStatus = async (id, status, notes = '') => {
    try {
      await axios.put(`${API_URL}/requests/${id}/status`, { status, manager_notes: notes });
      const messages = {
        pending_review: 'Sent to Main Manager for review',
        rejected: 'Request rejected',
        completed: 'Request completed & stock issued',
        received: 'Request marked as received',
        approved: canReviewDirectly
          ? 'Request approved directly'
          : 'Sent to Main Manager for review',
        reviewed: canReviewDirectly ? 'Request approved directly' : 'Sent to Main Manager for review',
      };
      showToast(messages[status] || `Request ${status}`, 'success');
      setSelected(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const startEditReceived = (r) => {
    setEditingReceived({
      ...editingReceived,
      [r.id]: r.received_quantity != null ? r.received_quantity : r.quantity,
    });
  };

  const cancelEditReceived = (id) => {
    const copy = { ...editingReceived };
    delete copy[id];
    setEditingReceived(copy);
  };

  const saveReceived = async (r) => {
    const value = parseInt(editingReceived[r.id], 10);
    if (isNaN(value) || value < 0) {
      showToast('Invalid received quantity', 'warning');
      return;
    }
    try {
      await axios.put(`${API_URL}/requests/${r.id}/received-quantity`, {
        received_quantity: value,
      });
      showToast(
        value === r.quantity
          ? 'Received quantity reset to requested'
          : `Received quantity set to ${value} (requested: ${r.quantity})`,
        'success'
      );
      cancelEditReceived(r.id);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  /* ===== Unique departments for the filter ===== */
  const departments = useMemo(() => {
    const set = new Set();
    requests.forEach((r) => {
      if (r.staff_department) set.add(r.staff_department);
    });
    return Array.from(set).sort();
  }, [requests]);

  /* ===== Filtered data ===== */
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

  const filterList = [
    'all', 'pending', 'pending_review', 'reviewed',
    'completed', 'received', 'rejected', 'cancelled',
  ];

  const isEditable = (r) => r.status === 'pending';
  const canRecordInventory = (r) =>
    !!r.is_new_product && !r.product_id && ['reviewed', 'approved'].includes(r.status);

  /* ===== Record-inventory flow ===== */
  const openRecordInventory = (r) => {
    setRecordFor(r);
    setInventoryForm({
      ...emptyInventoryForm,
      quantity: r.received_quantity != null ? r.received_quantity : r.quantity,
      category: r.new_product_category || 'Other',
    });
  };

  const closeRecordInventory = () => {
    setRecordFor(null);
    setInventoryForm(emptyInventoryForm);
  };

  const submitRecordInventory = async () => {
    if (!recordFor) return;
    if (!inventoryForm.quantity || inventoryForm.quantity <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }
    setSavingInventory(true);
    try {
      const res = await axios.put(
        `${API_URL}/requests/${recordFor.id}/record-inventory`,
        inventoryForm
      );
      showToast(
        `Product recorded into inventory as #${res.data.product_id} (qty ${res.data.quantity})`,
        'success'
      );
      closeRecordInventory();
      setSelected(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to record inventory', 'error');
    } finally {
      setSavingInventory(false);
    }
  };

  return (
    <div className="uw-mr">
      <div className="uw-page-header">
        <h2 className="uw-page-title"><i className="bi bi-inbox"></i> Staff Requests</h2>
        <div className="uw-filter-tabs">
          {filterList.map(f => (
            <button
              key={f}
              className={`uw-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* 🔑 Permission status banner */}
      <div
        style={{
          marginBottom: 14,
          padding: '10px 16px',
          background: canReviewDirectly ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${canReviewDirectly ? '#16a34a' : '#dc2626'}`,
          borderRadius: 8,
          color: canReviewDirectly ? '#166534' : '#991b1b',
          fontWeight: 500,
          fontSize: '0.9rem',
        }}
      >
        <i className={canReviewDirectly ? 'bi bi-shield-check' : 'bi bi-shield-lock'}></i>{' '}
        {canReviewDirectly
          ? 'Direct Review Permission: GRANTED — You can approve, reject, and complete requests without sending them to the Main Manager.'
          : 'Direct Review Permission: RESTRICTED — Requests must be sent to the Main Manager for review before you can complete them.'}
      </div>

      {/* ===== Search + Department filter row ===== */}
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
              <th>Reviewer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const editing = editingReceived[r.id];
              const received = r.received_quantity != null ? r.received_quantity : r.quantity;
              const changed = received !== r.quantity;
              const isNew = !!r.is_new_product;
              const pendingInventory = canRecordInventory(r);

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
                    {isEditable(r) ? (
                      editing !== undefined ? (
                        <span className="uw-inline-edit">
                          <input
                            type="number"
                            min="0"
                            className="uw-inline-input"
                            value={editing}
                            onChange={(e) =>
                              setEditingReceived({ ...editingReceived, [r.id]: e.target.value })
                            }
                            autoFocus
                          />
                          <button className="uw-icon-btn green" onClick={() => saveReceived(r)} title="Save">
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button className="uw-icon-btn red" onClick={() => cancelEditReceived(r.id)} title="Cancel">
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </span>
                      ) : (
                        <span
                          className={`uw-received-cell ${changed ? 'changed' : ''}`}
                          onClick={() => startEditReceived(r)}
                          title="Click to change the received quantity"
                        >
                          <strong>{received}</strong>
                          <i className="bi bi-pencil-fill uw-edit-icon"></i>
                        </span>
                      )
                    ) : (
                      <span className={`uw-received-cell ${changed ? 'changed' : ''}`}>
                        <strong>{received}</strong>
                      </span>
                    )}
                  </td>

                  <td>{r.requested_unit || r.product_unit}</td>
                  <td title={r.reason || ''}>
                    {r.reason ? (r.reason.length > 40 ? `${r.reason.slice(0, 40)}…` : r.reason) : '—'}
                  </td>
                  <td><span className={statusBadge(r.status)}>{r.status.replace('_', ' ')}</span></td>
                  <td>{r.reviewer_name || '—'}</td>
                  <td>
                    {/* ===== PENDING actions ===== */}
                    {r.status === 'pending' && (
                      <>
                        {/* Direct approve when permission is granted */}
                        {canReviewDirectly && (
                          <button
                            className="uw-icon-btn green"
                            title="Approve directly (permission granted)"
                            onClick={() =>
                              updateStatus(
                                r.id,
                                'approved',
                                'Approved directly by Stock Manager (permission granted)'
                              )
                            }
                          >
                            <i className="bi bi-check2-circle"></i> Approve
                          </button>
                        )}
                        <button
                          className="uw-icon-btn purple"
                          title={
                            canReviewDirectly
                              ? 'Send to Main Manager for review anyway'
                              : 'Send to Main Manager for Review'
                          }
                          onClick={() =>
                            updateStatus(r.id, 'pending_review', 'Forwarded to Main Manager')
                          }
                        >
                          <i className="bi bi-send-check"></i>
                        </button>
                        <button
                          className="uw-icon-btn red"
                          title="Reject"
                          onClick={() => updateStatus(r.id, 'rejected')}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </>
                    )}

                    {/* Record-as-inventory button */}
                    {pendingInventory && (
                      <button
                        className="uw-icon-btn orange"
                        title="Record this new product into inventory"
                        onClick={() => openRecordInventory(r)}
                      >
                        <i className="bi bi-box-arrow-in-down"></i> Record as Inventory
                      </button>
                    )}

                    {/* Complete when reviewed (works both with and without permission) */}
                    {r.status === 'reviewed' && !pendingInventory && (
                      <button
                        className="uw-icon-btn green"
                        title="Complete & Issue"
                        onClick={() => updateStatus(r.id, 'completed')}
                      >
                        <i className="bi bi-box-arrow-up"></i> Complete
                      </button>
                    )}

                    {/* ✅ NEW: Complete directly from pending when permission is granted */}
                    {canReviewDirectly && r.status === 'pending' && !r.is_new_product && (
                      <button
                        className="uw-icon-btn green"
                        title="Complete directly (permission granted)"
                        onClick={() =>
                          updateStatus(
                            r.id,
                            'completed',
                            'Completed directly by Stock Manager (permission granted)'
                          )
                        }
                      >
                        <i className="bi bi-box-arrow-up"></i> Complete
                      </button>
                    )}
                    {canReviewDirectly &&
                      r.status === 'pending' &&
                      r.is_new_product &&
                      r.product_id && (
                        <button
                          className="uw-icon-btn green"
                          title="Complete directly (permission granted)"
                          onClick={() =>
                            updateStatus(
                              r.id,
                              'completed',
                              'Completed directly by Stock Manager (permission granted)'
                            )
                          }
                        >
                          <i className="bi bi-box-arrow-up"></i> Complete
                        </button>
                      )}

                    {r.status === 'completed' && (
                      <button
                        className="uw-icon-btn blue"
                        title="Mark as Received"
                        onClick={() => updateStatus(r.id, 'received', 'Staff confirmed pickup')}
                      >
                        <i className="bi bi-check2-circle"></i> Received
                      </button>
                    )}
                    {r.status === 'received' && r.product_id && (
                      <button
                        className="uw-icon-btn purple"
                        title="Open Requisition Form"
                        onClick={() => setRequisitionFor(r)}
                      >
                        <i className="bi bi-file-earmark-text"></i> Requisition
                      </button>
                    )}
                    <button
                      className="uw-icon-btn blue"
                      title="Details"
                      onClick={() => openDetails(r)}
                    >
                      <i className="bi bi-eye-fill"></i>
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

      {/* ===== Request details modal ===== */}
      {selected && (
        <div className="uw-modal-overlay" onClick={() => setSelected(null)}>
          <div className="uw-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="uw-modal-head">
              <h4>Request #{selected.id} — Details & History</h4>
              <button onClick={() => setSelected(null)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              <div className="uw-detail-row"><strong>Staff:</strong> {selected.staff_name}</div>
              <div className="uw-detail-row"><strong>Email:</strong> {selected.staff_email}</div>
              <div className="uw-detail-row"><strong>Department:</strong> {selected.staff_department}</div>
              <div className="uw-detail-row">
                <strong>Product:</strong> {selected.product_name || '—'}
                {selected.is_new_product && (
                  <span className="uw-badge purple" style={{ marginLeft: 8 }}>
                    {selected.product_id ? `NEW → #${selected.product_id}` : 'NEW PRODUCT'}
                  </span>
                )}
              </div>
              {selected.is_new_product && (
                <div className="uw-detail-row">
                  <strong>Category / Unit:</strong>{' '}
                  {selected.new_product_category || 'Other'} / {selected.new_product_unit || 'pieces'}
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
                    <span className="uw-badge orange" style={{ marginLeft: 8 }}>Adjusted</span>
                  )}
              </div>
              <div className="uw-detail-row"><strong>Reason:</strong> {selected.reason || '—'}</div>
              <div className="uw-detail-row">
                <strong>Status:</strong>{' '}
                <span className={statusBadge(selected.status)}>{selected.status.replace('_', ' ')}</span>
              </div>
              <div className="uw-detail-row">
                <strong>Requested:</strong> {new Date(selected.created_at).toLocaleString()}
              </div>
              {selected.manager_notes && (
                <div className="uw-detail-row">
                  <strong>Stock Manager Notes:</strong> {selected.manager_notes}
                </div>
              )}
              {selected.reviewer_notes && (
                <div className="uw-detail-row">
                  <strong>Main Manager Notes:</strong> {selected.reviewer_notes}
                </div>
              )}

              {history.length > 0 && (
                <>
                  <h5 style={{ marginTop: 20, color: '#0a1f44' }}>Review History</h5>
                  <div className="uw-history">
                    {history.map(h => (
                      <div key={h.id} className="uw-history-item">
                        <div className="uw-history-title">
                          <i className="bi bi-clock-history"></i>{' '}
                          {h.action.replace('_', ' ')} — {h.reviewer_name || 'System'}
                        </div>
                        {h.comment && <div className="uw-history-comment">"{h.comment}"</div>}
                        <div className="uw-history-time">
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ===== Modal action buttons ===== */}
              {selected.status === 'pending' && (
                <div className="uw-modal-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {canReviewDirectly && (
                    <button
                      className="uw-btn-primary"
                      onClick={() =>
                        updateStatus(
                          selected.id,
                          'approved',
                          'Approved directly by Stock Manager (permission granted)'
                        )
                      }
                    >
                      <i className="bi bi-check2-circle"></i> Approve Directly
                    </button>
                  )}
                  <button
                    className="uw-btn-secondary"
                    onClick={() => updateStatus(selected.id, 'rejected', 'Rejected by Stock Manager')}
                  >
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                  <button
                    className="uw-btn-primary"
                    onClick={() => updateStatus(selected.id, 'pending_review', 'Forwarded to Main Manager')}
                  >
                    <i className="bi bi-send-check"></i> Send to Main Manager
                  </button>
                </div>
              )}

              {canRecordInventory(selected) && (
                <div className="uw-modal-actions">
                  <button
                    className="uw-btn-primary"
                    onClick={() => { openRecordInventory(selected); }}
                  >
                    <i className="bi bi-box-arrow-in-down"></i> Record as Inventory
                  </button>
                </div>
              )}

              {selected.status === 'reviewed' && !canRecordInventory(selected) && (
                <div className="uw-modal-actions">
                  <button className="uw-btn-primary" onClick={() => updateStatus(selected.id, 'completed')}>
                    <i className="bi bi-box-arrow-up"></i> Complete & Issue Stock
                  </button>
                </div>
              )}

              {canReviewDirectly && selected.status === 'pending' &&
                (!selected.is_new_product || selected.product_id) && (
                  <div className="uw-modal-actions">
                    <button
                      className="uw-btn-primary"
                      onClick={() =>
                        updateStatus(
                          selected.id,
                          'completed',
                          'Completed directly by Stock Manager (permission granted)'
                        )
                      }
                    >
                      <i className="bi bi-box-arrow-up"></i> Complete Directly
                    </button>
                  </div>
                )}

              {selected.status === 'completed' && (
                <div className="uw-modal-actions">
                  <button
                    className="uw-btn-primary"
                    onClick={() => updateStatus(selected.id, 'received', 'Staff confirmed pickup')}
                  >
                    <i className="bi bi-check2-circle"></i> Mark as Received
                  </button>
                </div>
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

      {/* ===== Record-as-Inventory modal ===== */}
      {recordFor && (
        <div className="uw-modal-overlay" onClick={closeRecordInventory}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="uw-modal-head">
              <h4>
                <i className="bi bi-box-arrow-in-down"></i> Record New Product into Inventory
              </h4>
              <button onClick={closeRecordInventory}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              <div style={{
                background: '#eaf1ff', padding: '10px 14px', borderRadius: 8,
                marginBottom: 14, fontSize: '0.86rem', color: '#0a3d91',
              }}>
                <i className="bi bi-info-circle-fill"></i>{' '}
                This will create <strong>{recordFor.new_product_name}</strong> as a new product
                and add a stock-in entry, then link it to request <strong>#{recordFor.id}</strong>.
              </div>

              <div className="uw-form-grid">
                <div>
                  <label>Product Name (from request)</label>
                  <input className="form-control" value={recordFor.new_product_name || ''} disabled />
                </div>
                <div>
                  <label>Category</label>
                  <select
                    className="form-control"
                    value={inventoryForm.category}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, category: e.target.value })}
                  >
                    {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Unit (from request)</label>
                  <input
                    className="form-control"
                    value={recordFor.new_product_unit || recordFor.requested_unit || 'pieces'}
                    disabled
                  />
                </div>
                <div>
                  <label>Quantity Received *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={inventoryForm.quantity}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, quantity: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label>Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={inventoryForm.unit_price}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, unit_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label>Currency</label>
                  <select
                    className="form-control"
                    value={inventoryForm.currency}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, currency: e.target.value })}
                  >
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Batch Number</label>
                  <input
                    className="form-control"
                    value={inventoryForm.batch_number}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, batch_number: e.target.value })}
                  />
                </div>
                <div>
                  <label>Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={inventoryForm.expiry_date}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, expiry_date: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Supplier</label>
                  <input
                    className="form-control"
                    value={inventoryForm.supplier}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, supplier: e.target.value })}
                    placeholder="Where did you get this product from?"
                  />
                </div>
                <div>
                  <label>Min Stock Alert</label>
                  <input
                    type="number"
                    className="form-control"
                    value={inventoryForm.min_stock}
                    onChange={(e) =>
                      setInventoryForm({ ...inventoryForm, min_stock: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="uw-modal-actions">
                <button className="uw-btn-secondary" onClick={closeRecordInventory} disabled={savingInventory}>
                  Cancel
                </button>
                <button className="uw-btn-primary" onClick={submitRecordInventory} disabled={savingInventory}>
                  <i className="bi bi-box-arrow-in-down"></i>{' '}
                  {savingInventory ? 'Saving…' : 'Record into Inventory'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Requisition Form modal ===== */}
      {requisitionFor && (
        <RequisitionForm
          request={requisitionFor}
          onClose={() => setRequisitionFor(null)}
        />
      )}
    </div>
  );
}