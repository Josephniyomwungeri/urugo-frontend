import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import './MainManagerUsage.css';

export default function MainManagerUsage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/usage`);
      setRows(res.data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const int = setInterval(load, 10000);
    const handler = () => load();
    window.addEventListener('uw:refresh', handler);
    return () => {
      clearInterval(int);
      window.removeEventListener('uw:refresh', handler);
    };
  }, []);

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    return (
      (r.staff_name || '').toLowerCase().includes(s) ||
      (r.product_name || '').toLowerCase().includes(s) ||
      (r.staff_department || '').toLowerCase().includes(s)
    );
  });

  const totalUsed = filtered.reduce((s, r) => s + (Number(r.used_quantity) || 0), 0);
  const totalDamaged = filtered.reduce((s, r) => s + (Number(r.damaged_quantity) || 0), 0);
  const totalRemaining = filtered.reduce((s, r) => s + (Number(r.remaining_quantity) || 0), 0);

  return (
    <div className="uw-mmu">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-clipboard-data"></i> Usage Reports (All Staff)
        </h2>
      </div>

      <div className="uw-mmu-stats">
        <div className="uw-mmu-stat">
          <i className="bi bi-arrow-down-circle"></i>
          <div>
            <span>Total Used</span>
            <strong>{totalUsed}</strong>
          </div>
        </div>
        <div className="uw-mmu-stat uw-mmu-stat-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <span>Total Damaged</span>
            <strong>{totalDamaged}</strong>
          </div>
        </div>
        <div className="uw-mmu-stat">
          <i className="bi bi-box-seam"></i>
          <div>
            <span>Total Remaining</span>
            <strong>{totalRemaining}</strong>
          </div>
        </div>
        <div className="uw-mmu-stat">
          <i className="bi bi-file-earmark-text"></i>
          <div>
            <span>Reports</span>
            <strong>{filtered.length}</strong>
          </div>
        </div>
      </div>

      <div className="uw-toolbar">
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input
            className="form-control"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="uw-count">{filtered.length} report(s)</span>
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
              <th>Used</th>
              <th>Damaged</th>
              <th>Remaining</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td className="uw-bold">{r.staff_name}</td>
                <td><span className="uw-badge">{r.staff_department || '—'}</span></td>
                <td>{r.product_name}</td>
                <td><span className="uw-badge red">{r.used_quantity} {r.unit}</span></td>
                <td>
                  <span className={`uw-badge ${Number(r.damaged_quantity) > 0 ? 'red' : ''}`}>
                    {Number(r.damaged_quantity) || 0} {r.unit}
                  </span>
                </td>
                <td><span className="uw-badge green">{r.remaining_quantity} {r.unit}</span></td>
                <td>{r.notes || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="9" className="uw-no-data">
                  No usage reports
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}