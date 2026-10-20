import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../context/AuthContext';
import './StaffProducts.css';

export default function StaffProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_URL}/products`)
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, []);

  // Unique categories for the filter
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  const getStockLabel = (p) => {
    if (p.quantity <= 0) return { label: 'Out of stock', cls: 'out' };
    if (p.quantity <= p.min_stock) return { label: 'Low stock', cls: 'low' };
    return { label: 'In stock', cls: 'ok' };
  };

  // 🔄 Toggle product selection
  const toggleSelect = (productId) => {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // 🚀 Send to StaffRequests with preselected items
  const handleRequestSelected = () => {
    if (selectedIds.length === 0) return;
    
    // Save the selected product IDs to localStorage so StaffRequests can read them
    localStorage.setItem('uw_bulk_request_ids', JSON.stringify(selectedIds));
    
    // Navigate to the requests page
    navigate('/staff/requests');
  };

  return (
    <div className="uw-sp">
      {/* Header */}
      <div className="uw-sp-header">
        <div>
          <h2 className="uw-sp-title">
            <i className="bi bi-box-seam"></i> Products Catalog
          </h2>
          <p className="uw-sp-sub">
            Browse all products currently available in the warehouse
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="uw-sp-toolbar">
        <div className="uw-sp-search">
          <i className="bi bi-search"></i>
          <input
            className="uw-sp-search-input"
            placeholder="Search products by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="uw-sp-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>

        <div className="uw-sp-categories">
          {categories.map((c) => (
            <button
              key={c}
              className={`uw-sp-cat-btn ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        <span className="uw-sp-count">
          <i className="bi bi-grid"></i> {filtered.length} product
          {filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="uw-sp-grid">
        {filtered.map((p) => {
          const stock = getStockLabel(p);
          const stockPct =
            p.min_stock > 0
              ? Math.min(100, Math.round((p.quantity / (p.min_stock * 2)) * 100))
              : 100;
          
          const isSelected = selectedIds.includes(p.id);
          const isOutOfStock = p.quantity <= 0;

          return (
            <div className={`uw-sp-card ${isSelected ? 'selected' : ''}`} key={p.id}>
              
              {/* Checkbox for selection (only if in stock) */}
              {!isOutOfStock && (
                <label className="uw-sp-checkbox-wrap" title="Select for bulk request">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(p.id)}
                  />
                  <span className="uw-sp-checkmark"></span>
                </label>
              )}

              {/* Image */}
              <div className="uw-sp-card-img">
                {p.image_url ? (
                  <img
                    src={`${p.image_url}?v=${p.updated_at || p.id}`}
                    alt={p.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.classList.add(
                          'img-failed'
                        );
                      }
                    }}
                  />
                ) : (
                  <div className="uw-sp-img-placeholder">
                    <i className="bi bi-image"></i>
                  </div>
                )}

                {/* Stock badge on image */}
                <span className={`uw-sp-stock-badge ${stock.cls}`}>
                  {stock.label}
                </span>
              </div>

              {/* Body */}
              <div className="uw-sp-card-body">
                <h5 className="uw-sp-card-name" title={p.name}>
                  {p.name}
                </h5>

                <span className="uw-sp-card-cat">{p.category}</span>

                <div className="uw-sp-card-stock-row">
                  <i className="bi bi-boxes"></i>
                  <span>
                    <strong>{p.quantity}</strong> {p.unit}
                  </span>
                </div>

                {/* Stock level bar */}
                <div className="uw-sp-stock-bar">
                  <div
                    className={`uw-sp-stock-bar-fill ${stock.cls}`}
                    style={{ width: `${stockPct}%` }}
                  ></div>
                </div>
                <div className="uw-sp-stock-bar-label">
                  Min stock: {p.min_stock} {p.unit}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="uw-sp-empty">
            <i className="bi bi-inbox"></i>
            <p>No products found</p>
            {(search || category !== 'all') && (
              <button
                className="uw-sp-empty-btn"
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* 🚀 Floating Action Bar for Bulk Requests */}
      {selectedIds.length > 0 && (
        <div className="uw-sp-floating-bar">
          <span>{selectedIds.length} product(s) selected</span>
          <button className="uw-btn-primary" onClick={handleRequestSelected}>
            <i className="bi bi-cart-plus"></i> Request Selected
          </button>
          <button className="uw-sp-clear-btn" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}