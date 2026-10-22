import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import './MainManagerInventory.css';

export default function MainManagerInventory() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/products`);
      setProducts(res.data);
    } catch {}
  };

  useEffect(() => {
    load();
    const int = setInterval(load, 10000);
    return () => clearInterval(int);
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = filtered.filter(p => p.quantity <= p.min_stock).length;

  return (
    <div className="uw-mmi">
      <div className="uw-page-header">
        <h2 className="uw-page-title"><i className="bi bi-box-seam"></i> Inventory (View Only)</h2>
        <span className="uw-mmi-low-badge">
          <i className="bi bi-exclamation-triangle-fill"></i> {lowStockCount} low-stock
        </span>
      </div>

      <div className="uw-toolbar">
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input className="form-control" placeholder="Search products..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="uw-count">{filtered.length} products</span>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Expiry</th>
              <th>Supplier</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const isLow = p.quantity <= p.min_stock;
              return (
                <tr key={p.id} style={isLow ? { background: '#fff5f5' } : undefined}>
                  <td>{p.id}</td>
                  <td>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name}
  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, background: '#f0f4fa', borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8898aa' }}>
                        <i className="bi bi-image"></i>
                      </div>
                    )}
                  </td>
                  <td className="uw-bold">{p.name}</td>
                  <td><span className="uw-badge">{p.category}</span></td>
                  <td><strong>{p.quantity}</strong></td>
                  <td>{p.unit}</td>
                  <td>{p.unit_price} {p.currency}</td>
                  <td>{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : '—'}</td>
                  <td>{p.supplier || '—'}</td>
                  <td>
                    {isLow ? (
                      <span className="uw-badge red">Low</span>
                    ) : (
                      <span className="uw-badge green">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan="10" className="uw-no-data">No products</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}