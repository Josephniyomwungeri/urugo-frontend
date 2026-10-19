import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './TruckStock.css';

export default function TruckStock() {
  const [trucks, setTrucks] = useState([]);
  const [products, setProducts] = useState([]);
  const [truckFilter, setTruckFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    truck_name: '',
    product_id: '',
    quantity: 1,
  });
  const { showToast } = useNotifications();

  /* 🆕 Confirmation modal (replaces window.confirm) */
  const [confirm, setConfirm] = useState(null);
  // confirm = { id, truck_name, product_name, loading? }

  const load = async () => {
    try {
      const [t, p] = await Promise.all([
        axios.get(`${API_URL}/truck-stock`),
        axios.get(`${API_URL}/products`),
      ]);
      setTrucks(t.data);
      setProducts(p.data);
    } catch {
      showToast('Failed to load truck stock', 'error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/truck-stock`, form);
      showToast('Truck stock updated', 'success');
      setShowModal(false);
      load();
    } catch {
      showToast('Operation failed', 'error');
    }
  };

  const updateQty = async (id, quantity) => {
    try {
      await axios.put(`${API_URL}/truck-stock/${id}`, { quantity });
      showToast('Quantity updated', 'success');
      load();
    } catch {
      showToast('Failed', 'error');
    }
  };

  /* ---------- 🆕 DELETE FLOW ---------- */
  const askRemove = (row) => {
    setConfirm({
      id: row.id,
      truck_name: row.truck_name,
      product_name: row.product_name,
    });
  };

  const closeConfirm = () => {
    if (confirm?.loading) return;
    setConfirm(null);
  };

  const runConfirmedDelete = async () => {
    if (!confirm) return;
    setConfirm((c) => ({ ...c, loading: true }));
    try {
      await axios.delete(`${API_URL}/truck-stock/${confirm.id}`);
      showToast(
        `Removed ${confirm.product_name} from ${confirm.truck_name}`,
        'success'
      );
      setConfirm(null);
      load();
    } catch {
      showToast('Delete failed', 'error');
      setConfirm((c) => ({ ...c, loading: false }));
    }
  };

  const truckNames = [...new Set(trucks.map((t) => t.truck_name))];
  const filtered = truckFilter
    ? trucks.filter((t) => t.truck_name === truckFilter)
    : trucks;

  return (
    <div className="uw-ts">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-truck"></i> Truck Stock
        </h2>
        <button
          className="uw-btn-primary"
          onClick={() => {
            setForm({
              truck_name: truckNames[0] || '',
              product_id: products[0]?.id || '',
              quantity: 1,
            });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-lg"></i> Add to Truck
        </button>
      </div>

      <div className="uw-toolbar">
        <select
          className="form-control uw-truck-filter"
          value={truckFilter}
          onChange={(e) => setTruckFilter(e.target.value)}
        >
          <option value="">All Trucks</option>
          {truckNames.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="uw-count">{truckNames.length} truck(s)</span>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>Truck</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="uw-badge">
                    <i className="bi bi-truck"></i> {t.truck_name}
                  </span>
                </td>
                <td className="uw-bold">{t.product_name}</td>
                <td>
                  <input
                    type="number"
                    className="uw-inline-input"
                    defaultValue={t.quantity}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      if (v !== t.quantity) updateQty(t.id, v);
                    }}
                  />
                </td>
                <td>{t.unit}</td>
                <td>{new Date(t.last_updated).toLocaleString()}</td>
                <td>
                  <button
                    className="uw-icon-btn red"
                    onClick={() => askRemove(t)}
                    title="Remove from truck"
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="uw-no-data">
                  No truck stock
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ ADD / UPDATE MODAL ============ */}
      {showModal && (
        <div className="uw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>Add / Update Truck Stock</h4>
              <button onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="uw-modal-body">
              <div className="uw-form-grid">
                <div>
                  <label>Truck Name *</label>
                  <input
                    className="form-control"
                    required
                    value={form.truck_name}
                    onChange={(e) =>
                      setForm({ ...form, truck_name: e.target.value })
                    }
                    placeholder="e.g. Truck A"
                  />
                </div>
                <div>
                  <label>Product *</label>
                  <select
                    className="form-control"
                    required
                    value={form.product_id}
                    onChange={(e) =>
                      setForm({ ...form, product_id: e.target.value })
                    }
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    required
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
              <div className="uw-modal-actions">
                <button
                  type="button"
                  className="uw-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="uw-btn-primary">
                  <i className="bi bi-check-lg"></i> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ 🆕 DELETE CONFIRMATION MODAL ============ */}
      {confirm && (
        <div className="uw-modal-overlay" onClick={closeConfirm}>
          <div
            className="uw-modal uw-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="uw-modal-head uw-confirm-head">
              <h4>
                <i className="bi bi-exclamation-triangle-fill"></i> Remove from
                Truck?
              </h4>
              <button onClick={closeConfirm} disabled={confirm.loading}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="uw-modal-body">
              <p className="uw-confirm-q">
                Are you sure you want to remove{' '}
                <strong>"{confirm.product_name}"</strong> from truck{' '}
                <strong>{confirm.truck_name}</strong>?
              </p>

              <div className="uw-confirm-details">
                <div>
                  <strong>Truck:</strong>{' '}
                  <span className="uw-badge">
                    <i className="bi bi-truck"></i> {confirm.truck_name}
                  </span>
                </div>
                <div>
                  <strong>Product:</strong> {confirm.product_name}
                </div>
              </div>

              <div className="uw-confirm-warn">
                <i className="bi bi-info-circle-fill"></i>
                <span>This action cannot be undone.</span>
              </div>

              <div className="uw-modal-actions">
                <button
                  className="uw-btn-secondary"
                  onClick={closeConfirm}
                  disabled={confirm.loading}
                >
                  Cancel
                </button>
                <button
                  className="uw-btn-danger"
                  onClick={runConfirmedDelete}
                  disabled={confirm.loading}
                >
                  <i
                    className={`bi ${
                      confirm.loading
                        ? 'bi-arrow-repeat uw-spin'
                        : 'bi-trash-fill'
                    }`}
                  ></i>{' '}
                  {confirm.loading ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}