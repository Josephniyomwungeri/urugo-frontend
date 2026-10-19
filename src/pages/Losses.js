import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './Losses.css';

export default function Losses() {
  const [losses, setLosses] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: 1, reason: '' });
  const { showToast } = useNotifications();

  const load = async () => {
    try {
      const [l, p] = await Promise.all([
        axios.get(`${API_URL}/losses`),
        axios.get(`${API_URL}/products`)
      ]);
      setLosses(l.data);
      setProducts(p.data);
    } catch {
      showToast('Failed to load losses', 'error');
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/losses`, form);
      const deducted = res.data?.deducted ?? form.quantity;
      showToast(`Loss recorded — ${deducted} unit(s) deducted from stock`, 'success');
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  // Get currently-selected product's quantity for the "Available" hint
  const selectedProduct = products.find(
    (p) => String(p.id) === String(form.product_id)
  );

  return (
    <div className="uw-ls">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-exclamation-triangle"></i> Lost / Damaged / Expired
        </h2>
        <button
          className="uw-btn-primary"
          onClick={() => {
            setForm({ product_id: products[0]?.id || '', quantity: 1, reason: '' });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-lg"></i> Report Loss
        </button>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Reason</th>
              <th>Reported By</th>
            </tr>
          </thead>
          <tbody>
            {losses.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{new Date(l.created_at).toLocaleDateString()}</td>
                <td className="uw-bold">{l.product_name}</td>
                <td>
                  <span className="uw-badge red">{l.quantity}</span>
                </td>
                <td>{l.unit}</td>
                <td>{l.reason || '—'}</td>
                <td>{l.reported_by_name || '—'}</td>
              </tr>
            ))}
            {losses.length === 0 && (
              <tr>
                <td colSpan="7" className="uw-no-data">
                  No losses recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="uw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>Report Loss / Damage</h4>
              <button onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={submit} className="uw-modal-body">
              <div className="uw-form-grid">
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
                        {p.name} — {p.quantity} {p.unit} in stock
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.quantity || undefined}
                    className="form-control"
                    required
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: parseInt(e.target.value) || 1 })
                    }
                  />
                  {selectedProduct && (
                    <small style={{ color: '#6c7a92', fontSize: '0.78rem' }}>
                      Available: {selectedProduct.quantity} {selectedProduct.unit}
                    </small>
                  )}
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Reason *</label>
                  <input
                    className="form-control"
                    required
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Damaged during transport, expired..."
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
    </div>
  );
}