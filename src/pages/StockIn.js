import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './StockOut.css';

export default function StockOut() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    quantity: 1,
    issued_to: '',          // who the items are FOR (beneficiary)
    department: '',
    received_by_name: '',   // 🆕 staff member who physically received them
    notes: '',
  });
  const { showToast } = useNotifications();

  const load = async () => {
    try {
      const [recRes, prodRes, staffRes] = await Promise.all([
        axios.get(`${API_URL}/stock-out`),
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/staff/list`),
      ]);
      setRecords(recRes.data);
      setProducts(prodRes.data);
      setStaffList(staffRes.data);
    } catch {
      showToast('Failed to load stock-out data', 'error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({
      product_id: products[0]?.id || '',
      quantity: 1,
      issued_to: '',
      department: '',
      received_by_name: '',
      notes: '',
    });
    setShowModal(true);
  };

  // When staff is selected as "Issued To", auto-fill department
  const handleStaffChange = (staffName) => {
    const staff = staffList.find((s) => s.full_name === staffName);
    setForm({
      ...form,
      issued_to: staffName,
      department: staff ? staff.department : '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/stock-out`, form);
      showToast('Stock Out recorded successfully', 'success');
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  return (
    <div className="uw-so">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-box-arrow-up"></i> Stock Out
        </h2>
        <button className="uw-btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg"></i> Record Stock Out
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
              <th>Issued To</th>
              <th>Department</th>
              <th>Received By</th>
              <th>Approved By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="uw-bold">{r.product_name}</td>
                <td>
                  <span className="uw-badge orange">{r.quantity}</span>
                </td>
                <td>{r.unit}</td>
                <td>{r.issued_to || '—'}</td>
                <td>
                  {r.department ? (
                    <span className="uw-badge">{r.department}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {r.received_by_name ? (
                    <span className="uw-badge green" style={{ background: '#dcfce7', color: '#166534' }}>
                      <i className="bi bi-person-check"></i> {r.received_by_name}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{r.approved_by_name || '—'}</td>
                <td>{r.notes || '—'}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan="10" className="uw-no-data">
                  No stock-out records
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
              <h4>Record Stock Out</h4>
              <button onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="uw-modal-body">
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
                        {p.name} — stock: {p.quantity}
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
                <div>
                  <label>Issued To (Beneficiary)</label>
                  <select
                    className="form-control"
                    value={form.issued_to}
                    onChange={(e) => handleStaffChange(e.target.value)}
                  >
                    <option value="">Select staff member</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.full_name}>
                        {s.full_name} — {s.department}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Department</label>
                  <input
                    className="form-control"
                    value={form.department}
                    placeholder="Auto-filled when staff is selected"
                    readOnly
                    style={{ background: '#f4f7fb', cursor: 'not-allowed' }}
                  />
                </div>

                {/* 🆕 Received By staff member */}
                <div>
                  <label>
                    Received By (Staff Member)
                  </label>
                  <select
                    className="form-control"
                    value={form.received_by_name}
                    onChange={(e) =>
                      setForm({ ...form, received_by_name: e.target.value })
                    }
                  >
                    <option value="">Select staff member who received</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.full_name}>
                        {s.full_name} — {s.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label>Notes</label>
                  <input
                    className="form-control"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
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