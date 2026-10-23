import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import RequisitionForm from '../components/RequisitionForm';
import './StaffRequests.css';

const ALL_UNITS = ['pieces', 'kg', 'litres', 'boxes', 'cartons', 'bags', 'packs', 'bottles'];
const ALL_CATEGORIES = ['Food', 'Medical', 'WASH', 'Vehicles', 'Equipment', 'Office', 'Other'];

const emptyRequest = {
  product_id: '',
  quantity: 1,
  reason: '',
  requested_unit: 'pieces',
  // 🆕 new-product fields
  is_new_product: false,
  new_product_name: '',
  new_product_category: 'Other',
  new_product_unit: 'pieces',
};

export default function StaffRequests() {
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [usage, setUsage] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [requisitionFor, setRequisitionFor] = useState(null);
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyRequest);

  const [showCountModal, setShowCountModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(2);
  const [bulkForms, setBulkForms] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 🚀 Guard to ensure the bulk modal only auto-opens ONCE per navigation
  const hasOpenedBulk = useRef(false);

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    id: null, request_id: null, product_id: null,
    used_quantity: 0, damaged_quantity: 0, remaining_quantity: 0,
    original_used: 0, original_damaged: 0,
    notes: '', unit: '', product_name: '',
    requested_qty: 0, received_qty: 0, isEdit: false,
  });

  const load = async () => {
    try {
      const [r, p, u] = await Promise.all([
        axios.get(`${API_URL}/requests`),
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/usage`),
      ]);
      setRequests(r.data);
      setProducts(p.data);
      setUsage(u.data);
    } catch {
      showToast('Failed to load', 'error');
    }
  };

  useEffect(() => {
    load();
    const int = setInterval(load, 8000);
    const handler = () => load();
    window.addEventListener('uw:refresh', handler);
    return () => {
      clearInterval(int);
      window.removeEventListener('uw:refresh', handler);
    };
  }, []);

  // 🚀 Check for preselected items from the Product Catalog
  useEffect(() => {
    const stored = localStorage.getItem('uw_bulk_request_ids');

    if (stored && products.length > 0 && !hasOpenedBulk.current) {
      try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids) && ids.length > 0) {
          const selectedProducts = products.filter(p => ids.includes(p.id));
          if (selectedProducts.length > 0) {
            const forms = selectedProducts.map(p => ({
              ...emptyRequest,
              product_id: p.id,
              requested_unit: p.unit || 'pieces',
              is_new_product: false,
            }));
            setBulkForms(forms);
            setShowBulkModal(true);
            hasOpenedBulk.current = true;
          }
        }
      } catch (err) {
        console.error('Failed to parse selected IDs', err);
      } finally {
        localStorage.removeItem('uw_bulk_request_ids');
      }
    }
  }, [products]);

  const openNewRequest = () => {
    setForm({
      ...emptyRequest,
      product_id: products[0]?.id || '',
      requested_unit: products[0]?.unit || 'pieces',
    });
    setShowModal(true);
  };

  const handleProductChange = (productId) => {
    const product = products.find((p) => String(p.id) === String(productId));
    setForm({
      ...form,
      product_id: productId,
      requested_unit: product?.unit || 'pieces',
    });
  };

  const toggleNewProduct = (isNew) => {
    setForm((f) => ({
      ...f,
      is_new_product: isNew,
      product_id: isNew ? '' : (products[0]?.id || ''),
      requested_unit: isNew
        ? (f.new_product_unit || 'pieces')
        : (products[0]?.unit || 'pieces'),
      new_product_unit: isNew ? (f.new_product_unit || 'pieces') : f.new_product_unit,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.is_new_product && !form.new_product_name.trim()) {
      showToast('Please enter the new product name', 'warning');
      return;
    }
    if (!form.is_new_product && !form.product_id) {
      showToast('Please choose a product', 'warning');
      return;
    }
    try {
      const payload = form.is_new_product
        ? {
            is_new_product: true,
            new_product_name: form.new_product_name.trim(),
            new_product_category: form.new_product_category || 'Other',
            new_product_unit: form.new_product_unit || form.requested_unit || 'pieces',
            quantity: form.quantity,
            reason: form.reason,
            requested_unit: form.requested_unit || form.new_product_unit || 'pieces',
          }
        : {
            product_id: form.product_id,
            quantity: form.quantity,
            reason: form.reason,
            requested_unit: form.requested_unit,
          };
      await axios.post(`${API_URL}/requests`, payload);
      showToast('Request submitted', 'success');
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await axios.put(`${API_URL}/requests/${id}/cancel`);
      showToast('Request cancelled', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  /* ---------------- BULK ---------------- */
  const openCountModal = () => { setBulkCount(2); setShowCountModal(true); };

  const startBulkRequests = () => {
    const n = Math.max(1, Math.min(20, parseInt(bulkCount) || 1));
    const firstProduct = products[0];
    const forms = Array.from({ length: n }, () => ({
      ...emptyRequest,
      product_id: firstProduct?.id || '',
      requested_unit: firstProduct?.unit || 'pieces',
      is_new_product: false,
      new_product_name: '',
      new_product_category: 'Other',
      new_product_unit: firstProduct?.unit || 'pieces',
    }));
    setBulkForms(forms);
    setShowCountModal(false);
    setShowBulkModal(true);
  };

  const updateBulkForm = (index, key, value) => {
    setBulkForms((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      if (key === 'product_id' && !copy[index].is_new_product) {
        const product = products.find((p) => String(p.id) === String(value));
        if (product) copy[index].requested_unit = product.unit || 'pieces';
      }
      if (key === 'new_product_unit') {
        copy[index].requested_unit = value;
      }
      return copy;
    });
  };

  const toggleBulkNewProduct = (index, isNew) => {
    setBulkForms((prev) => {
      const copy = [...prev];
      const firstProduct = products[0];
      copy[index] = {
        ...copy[index],
        is_new_product: isNew,
        product_id: isNew ? '' : (firstProduct?.id || ''),
        requested_unit: isNew
          ? (copy[index].new_product_unit || 'pieces')
          : (firstProduct?.unit || 'pieces'),
      };
      return copy;
    });
  };

  const removeBulkForm = (index) =>
    setBulkForms((prev) => prev.filter((_, i) => i !== index));

  const saveBulkForms = async () => {
    const valid = bulkForms
      .map((f) => {
        if (f.is_new_product) {
          if (!f.new_product_name || !f.new_product_name.trim()) return null;
          if (!f.quantity || f.quantity <= 0) return null;
          if (!f.reason || !f.reason.trim()) return null;
          return {
            is_new_product: true,
            new_product_name: f.new_product_name.trim(),
            new_product_category: f.new_product_category || 'Other',
            new_product_unit: f.new_product_unit || f.requested_unit || 'pieces',
            quantity: f.quantity,
            reason: f.reason,
            requested_unit: f.requested_unit || f.new_product_unit || 'pieces',
          };
        }
        if (!f.product_id || !f.quantity || f.quantity <= 0) return null;
        if (!f.reason || !f.reason.trim()) return null;
        return {
          product_id: f.product_id,
          quantity: f.quantity,
          reason: f.reason,
          requested_unit: f.requested_unit,
        };
      })
      .filter(Boolean);

    if (valid.length === 0) {
      showToast('Fill at least one complete form (product, qty, reason)', 'warning');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/requests/bulk`, { requests: valid });
      showToast(`${res.data.inserted} request(s) submitted successfully`, 'success');
      setShowBulkModal(false);
      setBulkForms([]);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Bulk request failed', 'error');
    }
  };

  /* ---------------- USAGE ---------------- */
  const openUsageModal = (r) => {
    if (!r.product_id) {
      showToast('This new product has not yet been recorded into inventory', 'warning');
      return;
    }
    const totalReceived = r.received_quantity != null ? r.received_quantity : r.quantity;

    const existing = usage.find(
      (u) => String(u.product_id) === String(r.product_id) &&
             String(u.request_id) === String(r.id)
    );

    if (existing) {
      setUsageForm({
        id: existing.id,
        request_id: existing.request_id,
        product_id: existing.product_id,
        used_quantity: existing.used_quantity,
        damaged_quantity: existing.damaged_quantity || 0,
        remaining_quantity: existing.remaining_quantity,
        original_used: existing.used_quantity,
        original_damaged: existing.damaged_quantity || 0,
        notes: existing.notes || '',
        unit: r.unit || r.product_unit || '',
        product_name: r.product_name,
        requested_qty: r.quantity,
        received_qty: totalReceived,
        isEdit: true,
      });
    } else {
      setUsageForm({
        id: null,
        request_id: r.id,
        product_id: r.product_id,
        used_quantity: 0,
        damaged_quantity: 0,
        remaining_quantity: totalReceived,
        original_used: 0,
        original_damaged: 0,
        notes: '',
        unit: r.unit || r.product_unit || '',
        product_name: r.product_name,
        requested_qty: r.quantity,
        received_qty: totalReceived,
        isEdit: false,
      });
    }
    setUsageModalOpen(true);
  };

  const recompute = (used, damaged, total) => ({
    used_quantity: used,
    damaged_quantity: damaged,
    remaining_quantity: total - used - damaged,
  });

  const handleUsedChange = (value) => {
    const total = Number(usageForm.received_qty) || 0;
    const floor = Number(usageForm.original_used) || 0;
    const damaged = Number(usageForm.damaged_quantity) || 0;
    let used = value === '' ? floor : parseInt(value, 10);
    if (isNaN(used)) used = floor;
    if (used < floor) {
      showToast(`Used cannot go below ${floor} ${usageForm.unit || ''}`.trim(), 'warning');
      used = floor;
    }
    if (used + damaged > total) {
      showToast(`Used + Damaged can't exceed ${total} ${usageForm.unit || ''}`.trim(), 'warning');
      used = Math.max(floor, total - damaged);
    }
    setUsageForm((f) => ({ ...f, ...recompute(used, damaged, total) }));
  };

  const handleDamagedChange = (value) => {
    const total = Number(usageForm.received_qty) || 0;
    const floor = Number(usageForm.original_damaged) || 0;
    const used = Number(usageForm.used_quantity) || 0;
    let damaged = value === '' ? floor : parseInt(value, 10);
    if (isNaN(damaged)) damaged = floor;
    if (damaged < floor) {
      showToast(`Damaged cannot go below ${floor} ${usageForm.unit || ''}`.trim(), 'warning');
      damaged = floor;
    }
    if (damaged < 0) { showToast('Damaged cannot be negative', 'warning'); damaged = 0; }
    if (used + damaged > total) {
      showToast(`Used + Damaged can't exceed ${total} ${usageForm.unit || ''}`.trim(), 'warning');
      damaged = Math.max(floor, total - used);
    }
    setUsageForm((f) => ({ ...f, ...recompute(used, damaged, total) }));
  };

  const handleRemainingChange = (value) => {
    const total = Number(usageForm.received_qty) || 0;
    const floorUsed = Number(usageForm.original_used) || 0;
    const floorDamaged = Number(usageForm.original_damaged) || 0;
    const maxRemaining = total - floorUsed - floorDamaged;
    let remaining = value === '' ? maxRemaining : parseInt(value, 10);
    if (isNaN(remaining)) remaining = maxRemaining;
    if (remaining < 0) { showToast('Remaining cannot be negative', 'warning'); remaining = 0; }
    if (remaining > maxRemaining) {
      showToast(`Remaining can't exceed ${maxRemaining} ${usageForm.unit || ''}`.trim(), 'warning');
      remaining = maxRemaining;
    }
    const damaged = Number(usageForm.damaged_quantity) || 0;
    let used = total - remaining - damaged;
    if (used < floorUsed) used = floorUsed;
    setUsageForm((f) => ({ ...f, ...recompute(used, damaged, total) }));
  };

  const submitUsage = async (e) => {
    e.preventDefault();
    const total = Number(usageForm.received_qty) || 0;
    const floorUsed = Number(usageForm.original_used) || 0;
    const floorDamaged = Number(usageForm.original_damaged) || 0;
    const used = Number(usageForm.used_quantity || 0);
    const damaged = Number(usageForm.damaged_quantity || 0);
    const remaining = Number(usageForm.remaining_quantity || 0);

    if (used + damaged + remaining !== total) {
      showToast(`Used + Damaged + Remaining must equal ${total} ${usageForm.unit || ''}`.trim(), 'error');
      return;
    }
    if (used < floorUsed || damaged < floorDamaged) {
      showToast('You cannot reduce previously reported quantities', 'error');
      return;
    }
    try {
      await axios.post(`${API_URL}/usage`, {
        request_id: usageForm.request_id,
        product_id: usageForm.product_id,
        used_quantity: used,
        damaged_quantity: damaged,
        remaining_quantity: remaining,
        notes: usageForm.notes,
      });
      showToast(usageForm.isEdit ? 'Usage report updated' : 'Usage report submitted', 'success');
      setUsageModalOpen(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const statusClass = (s) => {
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
  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  /* ===== Filtered requests ===== */
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const matches =
          (r.product_name || '').toLowerCase().includes(s) ||
          (r.reason || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  /* ===== 🆕 Group requests by batch_id for requisition forms ===== */
  const requestsByBatch = useMemo(() => {
    const map = new Map();
    requests.forEach((r) => {
      const key = r.batch_id || `single-${r.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [requests]);

  const getBatchFor = (r) => {
    if (!r.batch_id) return [r];
    return requestsByBatch.get(r.batch_id) || [r];
  };

  const openRequisition = (r) => {
    const batch = getBatchFor(r);
    const receivedItems = batch.filter((x) => x.status === 'received');
    setRequisitionFor({
      primary: r,
      items: receivedItems.length ? receivedItems : batch,
    });
  };

  return (
    <div className="uw-sr">
      <div className="uw-page-header">
        <h2 className="uw-page-title"><i className="bi bi-inbox"></i> My Requests</h2>
        <div className="uw-header-actions">
          <button className="uw-btn-primary" onClick={openCountModal}>
            <i className="bi bi-plus-lg"></i> New Requests
          </button>
        </div>
      </div>

      <div className="uw-card" style={{ marginBottom: 16, padding: '12px 18px', background: '#eaf1ff', border: '1px solid #cfe1ff' }}>
        <i className="bi bi-info-circle-fill" style={{ color: '#0d6efd', marginRight: 8 }}></i>
        Logged in as <strong>{user?.full_name}</strong> • Department: <strong>{user?.department}</strong>
      </div>

      {/* ===== Search + Status filter ===== */}
      <div className="uw-toolbar" style={{ marginBottom: 14 }}>
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input
            className="form-control"
            placeholder="Search by product name or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="uw-dept-filter">
          <i className="bi bi-funnel"></i>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_review">Pending Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="completed">Completed</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <span className="uw-count">{filteredRequests.length} request(s)</span>
      </div>

      {/* ============ MY REQUESTS ============ */}
      <h4 style={{ color: '#0a1f44', marginBottom: 10 }}>
        <i className="bi bi-file-earmark-text"></i> My Requests
      </h4>
      <div className="uw-table-wrap" style={{ marginBottom: 24 }}>
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Product</th>
              <th>Requested</th>
              <th>Received</th>
              <th>Unit</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Manager Notes</th>
              <th>Reviewer Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((r) => {
              const received = r.received_quantity != null ? r.received_quantity : r.quantity;
              const changed = received !== r.quantity;
              const isNew = !!r.is_new_product;
              const notYetInInventory = isNew && !r.product_id;

              // 🆕 batch info
              const batchSize = r.batch_id
                ? (requestsByBatch.get(r.batch_id) || []).length
                : 1;
              const isBatch = batchSize > 1;

              return (
                <tr key={r.id}>
                  <td>
                    {r.id}
                    {isBatch && (
                      <span
                        className="uw-badge purple"
                        style={{ marginLeft: 6, fontSize: '0.65rem' }}
                        title={`Part of a batch of ${batchSize} requests`}
                      >
                        <i className="bi bi-collection"></i> {batchSize}
                      </span>
                    )}
                  </td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td className="uw-bold">
                    {r.product_name}
                    {isNew && (
                      <span
                        className="uw-badge purple"
                        style={{ marginLeft: 8, fontSize: '0.68rem' }}
                        title="New product — not yet in inventory"
                      >
                        NEW PRODUCT
                      </span>
                    )}
                  </td>
                  <td><strong>{r.quantity}</strong></td>
                  <td>
                    <span className={changed ? 'uw-badge orange' : 'uw-badge green'}>
                      {received}
                    </span>
                  </td>
                  <td>{r.requested_unit || r.unit || r.product_unit}</td>
                  <td>{r.reason || '—'}</td>
                  <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                  <td>{r.manager_notes || '—'}</td>
                  <td>{r.reviewer_notes || '—'}</td>
                  <td>
                    {['pending', 'pending_review'].includes(r.status) && (
                      <button className="uw-icon-btn red" onClick={() => cancel(r.id)}>
                        <i className="bi bi-x-circle"></i> Cancel
                      </button>
                    )}
                    {r.status === 'received' && r.product_id && (
                      <>
                        <button
                          className="uw-icon-btn purple"
                          onClick={() => openRequisition(r)}
                          title={
                            isBatch
                              ? `Open combined Requisition Form (${batchSize} items)`
                              : 'Open Requisition Form'
                          }
                        >
                          <i className="bi bi-file-earmark-text"></i> Requisition
                          {isBatch && (
                            <span
                              className="uw-badge"
                              style={{ marginLeft: 6, fontSize: '0.65rem' }}
                            >
                              {batchSize}
                            </span>
                          )}
                        </button>
                        <button
                          className="uw-icon-btn green"
                          onClick={() => openUsageModal(r)}
                          title="Report or edit usage"
                        >
                          <i className="bi bi-clipboard-plus"></i> Report Usage
                        </button>
                      </>
                    )}
                    {r.status === 'received' && notYetInInventory && (
                      <span
                        className="uw-badge orange"
                        title="Stock Manager needs to record this product into inventory first"
                      >
                        <i className="bi bi-hourglass-split"></i> Awaiting inventory
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredRequests.length === 0 && (
              <tr><td colSpan="11" className="uw-no-data">No requests found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ MY USAGE REPORTS ============ */}
      <h4 style={{ color: '#0a1f44', marginBottom: 10 }}>
        <i className="bi bi-clipboard-data"></i> My Usage Reports
      </h4>
      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Product</th>
              <th>Used</th>
              <th>Damaged</th>
              <th>Remaining</th>
              <th>Notes</th>
              <th>Request #</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{new Date(u.created_at).toLocaleString()}</td>
                <td className="uw-bold">{u.product_name}</td>
                <td><span className="uw-badge red">{u.used_quantity} {u.unit}</span></td>
                <td>
                  <span className={`uw-badge ${Number(u.damaged_quantity) > 0 ? 'red' : ''}`}>
                    {Number(u.damaged_quantity) || 0} {u.unit}
                  </span>
                </td>
                <td><span className="uw-badge green">{u.remaining_quantity} {u.unit}</span></td>
                <td>{u.notes || '—'}</td>
                <td>{u.request_id ? `#${u.request_id}` : '—'}</td>
              </tr>
            ))}
            {usage.length === 0 && (
              <tr><td colSpan="8" className="uw-no-data">You haven't reported any usage yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ COUNT MODAL ============ */}
      {showCountModal && (
        <div className="uw-modal-overlay" onClick={() => setShowCountModal(false)}>
          <div className="uw-modal uw-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>How many requests do you want to make?</h4>
              <button onClick={() => setShowCountModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              <div className="uw-count-picker">
                <button type="button" className="uw-count-btn" onClick={() => setBulkCount(Math.max(1, bulkCount - 1))}>
                  <i className="bi bi-dash-lg"></i>
                </button>
                <input type="number" min="1" max="20" className="uw-count-input" value={bulkCount}
                  onChange={(e) => setBulkCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))} />
                <button type="button" className="uw-count-btn" onClick={() => setBulkCount(Math.min(20, bulkCount + 1))}>
                  <i className="bi bi-plus-lg"></i>
                </button>
              </div>
              <p className="uw-count-hint">
                You can request up to 20 products at once. Each gets its own form.
              </p>
              <div className="uw-modal-actions">
                <button className="uw-btn-secondary" onClick={() => setShowCountModal(false)}>Cancel</button>
                <button className="uw-btn-primary" onClick={startBulkRequests}>
                  <i className="bi bi-arrow-right"></i> Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ BULK REQUEST MODAL ============ */}
      {showBulkModal && (
        <div className="uw-modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="uw-modal uw-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>New Requests ({bulkForms.length})</h4>
              <button onClick={() => setShowBulkModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body uw-bulk-body">
              {bulkForms.length === 0 && <p className="uw-no-data">All forms were closed.</p>}
              {bulkForms.map((f, idx) => {
                const prod = products.find((p) => String(p.id) === String(f.product_id));
                return (
                  <div className="uw-bulk-card" key={idx}>
                    <div className="uw-bulk-card-head">
                      <span className="uw-bulk-card-num">Request #{idx + 1}</span>
                      <button type="button" className="uw-bulk-close" onClick={() => removeBulkForm(idx)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>

                    <div className="uw-toggle-row">
                      <button
                        type="button"
                        className={`uw-toggle-btn ${!f.is_new_product ? 'active' : ''}`}
                        onClick={() => toggleBulkNewProduct(idx, false)}
                      >
                        <i className="bi bi-box-seam"></i> Existing product
                      </button>
                      <button
                        type="button"
                        className={`uw-toggle-btn ${f.is_new_product ? 'active' : ''}`}
                        onClick={() => toggleBulkNewProduct(idx, true)}
                      >
                        <i className="bi bi-plus-square"></i> New product (not in inventory)
                      </button>
                    </div>

                    <div className="uw-form-grid">
                      {f.is_new_product ? (
                        <>
                          <div style={{ gridColumn: '1/-1' }}>
                            <label>New Product Name *</label>
                            <input
                              className="form-control"
                              value={f.new_product_name}
                              onChange={(e) => updateBulkForm(idx, 'new_product_name', e.target.value)}
                              placeholder="e.g. Hand Sanitizer 500ml"
                            />
                          </div>
                          <div>
                            <label>Category *</label>
                            <select
                              className="form-control"
                              value={f.new_product_category}
                              onChange={(e) => updateBulkForm(idx, 'new_product_category', e.target.value)}
                            >
                              {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label>Unit *</label>
                            <select
                              className="form-control"
                              value={f.new_product_unit}
                              onChange={(e) => updateBulkForm(idx, 'new_product_unit', e.target.value)}
                            >
                              {ALL_UNITS.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div style={{ gridColumn: '1/-1' }}>
                          <label>Product *</label>
                          <select className="form-control" value={f.product_id}
                            onChange={(e) => updateBulkForm(idx, 'product_id', e.target.value)}>
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.category}) — stock: {p.quantity} {p.unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label>Quantity *</label>
                        <input type="number" min="1" className="form-control" value={f.quantity}
                          onChange={(e) => updateBulkForm(idx, 'quantity', parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <label>Request Unit *</label>
                        <select className="form-control"
                          value={f.is_new_product ? (f.new_product_unit || f.requested_unit) : f.requested_unit}
                          onChange={(e) => updateBulkForm(idx, f.is_new_product ? 'new_product_unit' : 'requested_unit', e.target.value)}>
                          {ALL_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                              {prod && prod.unit === u ? ' (product unit)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label>Reason *</label>
                        <textarea className="form-control" rows="2" value={f.reason}
                          onChange={(e) => updateBulkForm(idx, 'reason', e.target.value)}
                          placeholder="Why do you need this product?" />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="uw-modal-actions uw-modal-actions-sticky">
                <button className="uw-btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button className="uw-btn-primary" onClick={saveBulkForms}>
                  <i className="bi bi-check2-all"></i> Save All ({bulkForms.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ USAGE MODAL ============ */}
      {usageModalOpen && (
        <div className="uw-modal-overlay" onClick={() => setUsageModalOpen(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="uw-modal-head">
              <h4>{usageForm.isEdit ? 'Edit' : 'Report'} Usage — {usageForm.product_name}</h4>
              <button onClick={() => setUsageModalOpen(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={submitUsage} className="uw-modal-body">
              <div style={{
                background: '#eaf1ff', padding: '10px 14px', borderRadius: 8,
                marginBottom: 14, fontSize: '0.86rem', color: '#0a3d91',
              }}>
                <i className="bi bi-info-circle-fill"></i>{' '}
                {usageForm.isEdit ? (
                  <>
                    You already reported usage. You can only increase Used or Damaged                    (min used: {usageForm.original_used}, min damaged: {usageForm.original_damaged}).
                  </>
                ) : (
                  <>
                    You <strong>requested</strong> {usageForm.requested_qty} and{' '}
                    <strong>received</strong> {usageForm.received_qty} {usageForm.unit}.
                    Report Used, Damaged and Remaining.
                  </>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <span style={{ padding: '6px 12px', borderRadius: 8, background: '#f4f7fb', color: '#0a1f44', fontSize: '0.82rem' }}>
                  <strong>Requested:</strong> {usageForm.requested_qty} {usageForm.unit}
                </span>
                <span style={{ padding: '6px 12px', borderRadius: 8, background: '#e6f7ec', color: '#0a1f44', fontSize: '0.82rem' }}>
                  <strong>Received:</strong> {usageForm.received_qty} {usageForm.unit}
                </span>
              </div>

              <div className="uw-form-grid">
                <div>
                  <label>Used Quantity *</label>
                  <input type="number" min={usageForm.original_used} className="form-control" required
                    value={usageForm.used_quantity}
                    onChange={(e) => handleUsedChange(e.target.value)} />
                  {usageForm.isEdit && (
                    <small style={{ color: '#6c7a92', fontSize: '0.76rem' }}>
                      Minimum: {usageForm.original_used}
                    </small>
                  )}
                </div>
                <div>
                  <label>Damaged Quantity *</label>
                  <input type="number" min={usageForm.original_damaged} className="form-control" required
                    value={usageForm.damaged_quantity}
                    onChange={(e) => handleDamagedChange(e.target.value)} />
                  {usageForm.isEdit && (
                    <small style={{ color: '#6c7a92', fontSize: '0.76rem' }}>
                      Minimum: {usageForm.original_damaged}
                    </small>
                  )}
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Remaining Quantity *</label>
                  <input type="number" min="0" className="form-control" required
                    value={usageForm.remaining_quantity}
                    onChange={(e) => handleRemainingChange(e.target.value)} />
                  <small style={{ color: '#6c7a92', fontSize: '0.76rem' }}>
                    Auto-calculated: Received − Used − Damaged
                  </small>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Notes (optional)</label>
                  <textarea className="form-control" rows="3" value={usageForm.notes}
                    onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                    placeholder="Any additional context..." />
                </div>
              </div>

              <div className="uw-modal-actions">
                <button type="button" className="uw-btn-secondary" onClick={() => setUsageModalOpen(false)}>Cancel</button>
                <button type="submit" className="uw-btn-primary">
                  <i className="bi bi-send"></i> {usageForm.isEdit ? 'Update Usage' : 'Submit Usage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ SINGLE REQUEST MODAL ============ */}
      {showModal && (
        <div className="uw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="uw-modal-head">
              <h4>New Request</h4>
              <button onClick={() => setShowModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={submit} className="uw-modal-body">
              <div className="uw-toggle-row" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={`uw-toggle-btn ${!form.is_new_product ? 'active' : ''}`}
                  onClick={() => toggleNewProduct(false)}
                >
                  <i className="bi bi-box-seam"></i> Existing product
                </button>
                <button
                  type="button"
                  className={`uw-toggle-btn ${form.is_new_product ? 'active' : ''}`}
                  onClick={() => toggleNewProduct(true)}
                >
                  <i className="bi bi-plus-square"></i> New product
                </button>
              </div>

              <div className="uw-form-grid">
                {form.is_new_product ? (
                  <>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>New Product Name *</label>
                      <input
                        className="form-control"
                        required
                        value={form.new_product_name}
                        onChange={(e) => setForm({ ...form, new_product_name: e.target.value })}
                        placeholder="e.g. Hand Sanitizer 500ml"
                      />
                    </div>
                    <div>
                      <label>Category *</label>
                      <select
                        className="form-control"
                        value={form.new_product_category}
                        onChange={(e) => setForm({ ...form, new_product_category: e.target.value })}
                      >
                        {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Unit *</label>
                      <select
                        className="form-control"
                        value={form.new_product_unit}
                        onChange={(e) => setForm({ ...form, new_product_unit: e.target.value, requested_unit: e.target.value })}
                      >
                        {ALL_UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label>Product *</label>
                    <select className="form-control" required value={form.product_id}
                      onChange={(e) => handleProductChange(e.target.value)}>
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category}) — stock: {p.quantity} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label>Quantity *</label>
                  <input type="number" min="1" className="form-control" required value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label>Request Unit *</label>
                  <select className="form-control" required
                    value={form.is_new_product ? (form.new_product_unit || form.requested_unit) : form.requested_unit}
                    onChange={(e) => setForm({
                      ...form,
                      [form.is_new_product ? 'new_product_unit' : 'requested_unit']: e.target.value,
                      requested_unit: e.target.value,
                    })}>
                    {ALL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                        {selectedProduct && selectedProduct.unit === u ? ' (product unit)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Reason *</label>
                  <textarea className="form-control" rows="3" required value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Why do you need this product?" />
                </div>
              </div>
              <div className="uw-modal-actions">
                <button type="button" className="uw-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="uw-btn-primary"><i className="bi bi-send"></i> Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ REQUISITION FORM MODAL (batch-aware) ============ */}
      {requisitionFor && (
        <RequisitionForm
          request={requisitionFor.primary}
          batchRequests={requisitionFor.items}
          onClose={() => setRequisitionFor(null)}
        />
      )}
    </div>
  );
}