import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API_URL } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './Inventory.css';

const emptyProduct = {
  name: '',
  category: 'Food',
  unit: 'pieces',
  quantity: 0,
  unit_price: 0,
  currency: 'USD',
  batch_number: '',
  expiry_date: '',
  supplier: '',
  min_stock: 10,
};

const categories = ['Food', 'Medical', 'WASH', 'Vehicles', 'Equipment', 'Office', 'Other'];

// ✅ Added 'packs' and 'bottles' so they match StaffRequests' ALL_UNITS
const units = ['pieces', 'packs', 'bottles', 'kg', 'litres', 'boxes', 'cartons', 'bags'];

const currencies = ['USD', 'EUR', 'RWF', 'KES', 'UGX', 'TZS'];

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const { showToast } = useNotifications();

  // Single add/edit
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  // Bulk add flow
  const [showCountModal, setShowCountModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(2);
  const [bulkForms, setBulkForms] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Bulk update
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState([]);

  // 🆕 Confirmation modal (replaces window.confirm)
  const [confirm, setConfirm] = useState(null);
  // confirm = { type: 'single' | 'bulk', id?, name?, count?, loading? }

  // Import
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/products`);
      setProducts(res.data);
    } catch (err) {
      showToast('Failed to load products', 'error');
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);

    // Listen to global refresh event (fired by the navbar refresh button)
    const handler = () => load();
    window.addEventListener('uw:refresh', handler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('uw:refresh', handler);
    };
  }, []);

  /* ---------- SINGLE ADD / EDIT ---------- */
  const openAdd = () => {
    setEditing(null);
    setForm(emptyProduct);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${API_URL}/products/${editing.id}`, form);
        showToast('Product updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/products`, form);
        showToast('Product added successfully', 'success');
      }
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Operation failed', 'error');
    }
  };

  /* ---------- 🆕 DELETE FLOWS (via modal) ---------- */
  const askDeleteProduct = (p) => {
    setConfirm({ type: 'single', id: p.id, name: p.name });
  };

  const askBulkDelete = () => {
    if (selectedIds.length === 0) {
      showToast('Select at least one product first', 'warning');
      return;
    }
    setConfirm({ type: 'bulk', count: selectedIds.length });
  };

  const closeConfirm = () => {
    if (confirm?.loading) return;
    setConfirm(null);
  };

  const runConfirmedAction = async () => {
    if (!confirm) return;
    setConfirm((c) => ({ ...c, loading: true }));

    try {
      if (confirm.type === 'single') {
        await axios.delete(`${API_URL}/products/${confirm.id}`);
        showToast(`"${confirm.name}" deleted`, 'success');
      } else if (confirm.type === 'bulk') {
        const res = await axios.delete(`${API_URL}/products/bulk`, {
          data: { ids: selectedIds },
        });
        showToast(`${res.data.deleted} products deleted`, 'success');
        setSelectedIds([]);
      }
      setConfirm(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
      setConfirm((c) => ({ ...c, loading: false }));
    }
  };

  const inlineUpdateQuantity = async (id, quantity) => {
    try {
      await axios.put(`${API_URL}/products/${id}/quantity`, { quantity });
      showToast('Quantity updated', 'success');
      load();
    } catch (err) {
      showToast('Update failed', 'error');
    }
  };

  const uploadImage = async (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      await axios.post(`${API_URL}/products/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Image uploaded', 'success');
      load();
    } catch (err) {
      showToast('Upload failed', 'error');
    }
  };

  /* ---------- BULK ADD ---------- */
  const openCountModal = () => {
    setBulkCount(2);
    setShowCountModal(true);
  };

  const startBulkAdd = () => {
    const n = Math.max(1, parseInt(bulkCount) || 1);
    const forms = Array.from({ length: n }, () => ({ ...emptyProduct }));
    setBulkForms(forms);
    setShowCountModal(false);
    setShowBulkModal(true);
  };

  const updateBulkForm = (index, key, value) => {
    setBulkForms((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const removeBulkForm = (index) => {
    setBulkForms((prev) => prev.filter((_, i) => i !== index));
  };

  const saveBulkForms = async () => {
    const valid = bulkForms.filter((f) => f.name && f.name.trim());
    if (valid.length === 0) {
      showToast('Please fill at least one product name', 'warning');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/products/bulk`, { products: valid });
      showToast(`${res.data.inserted} products added successfully`, 'success');
      setShowBulkModal(false);
      setBulkForms([]);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Bulk add failed', 'error');
    }
  };

  /* ---------- BULK UPDATE ---------- */
  const openBulkUpdate = () => {
    if (selectedIds.length === 0) {
      showToast('Select at least one product first', 'warning');
      return;
    }
    const selected = products
      .filter((p) => selectedIds.includes(p.id))
      .map((p) => ({
        ...p,
        expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '',
      }));
    setBulkUpdates(selected);
    setShowBulkUpdateModal(true);
  };

  const updateBulkUpdateField = (index, key, value) => {
    setBulkUpdates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const saveBulkUpdates = async () => {
    try {
      const res = await axios.put(`${API_URL}/products/bulk`, { products: bulkUpdates });
      showToast(`${res.data.updated} products updated successfully`, 'success');
      setShowBulkUpdateModal(false);
      setBulkUpdates([]);
      setSelectedIds([]);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Bulk update failed', 'error');
    }
  };

  /* ---------- CHECKBOX SELECTION ---------- */
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  /* ---------- DOWNLOAD TEMPLATE ---------- */
  const downloadTemplate = () => {
    const headers = [
      'name',
      'category',
      'unit',
      'quantity',
      'unit_price',
      'currency',
      'batch_number',
      'expiry_date',
      'supplier',
      'min_stock',
    ];
    const sample = [
      {
        name: 'Rice 25kg',
        category: 'Food',
        unit: 'bags',
        quantity: 100,
        unit_price: 30,
        currency: 'USD',
        batch_number: 'BATCH-001',
        expiry_date: '2025-12-31',
        supplier: 'WFP',
        min_stock: 20,
      },
      {
        name: 'Marker Pens',
        category: 'Office',
        unit: 'packs',
        quantity: 50,
        unit_price: 2.5,
        currency: 'USD',
        batch_number: 'BATCH-002',
        expiry_date: '',
        supplier: 'Local Supplier',
        min_stock: 10,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'urugo_woc_products_template.xlsx');
    showToast('Template downloaded', 'success');
  };

  /* ---------- IMPORT EXCEL ---------- */
  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        showToast('No rows found in the file', 'warning');
        return;
      }

      const productsToImport = rows
        .map((row) => ({
          name: String(row.name || '').trim(),
          category: row.category || 'Other',
          unit: row.unit || 'pieces',
          quantity: parseInt(row.quantity) || 0,
          unit_price: parseFloat(row.unit_price) || 0,
          currency: row.currency || 'USD',
          batch_number: row.batch_number || '',
          expiry_date: row.expiry_date ? String(row.expiry_date).split('T')[0] : '',
          supplier: row.supplier || '',
          min_stock: parseInt(row.min_stock) || 10,
        }))
        .filter((p) => p.name);

      if (productsToImport.length === 0) {
        showToast('No valid rows (missing "name")', 'warning');
        return;
      }

      const res = await axios.post(`${API_URL}/products/bulk`, {
        products: productsToImport,
      });
      showToast(`${res.data.inserted} products imported successfully`, 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Import failed', 'error');
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="uw-inv">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-box-seam"></i> Inventory Register
        </h2>
        <div className="uw-header-actions">
          <button className="uw-btn-secondary" onClick={downloadTemplate}>
            <i className="bi bi-file-earmark-arrow-down"></i> Template
          </button>
          <button
            className="uw-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="bi bi-upload"></i> Import Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleImportFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <button className="uw-btn-primary" onClick={openCountModal}>
            <i className="bi bi-plus-lg"></i> Add Product
          </button>
        </div>
      </div>

      <div className="uw-toolbar">
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input
            className="form-control"
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="uw-bulk-actions">
            <span className="uw-selected-count">
              <i className="bi bi-check2-square"></i> {selectedIds.length} selected
            </span>
            <button className="uw-btn-secondary" onClick={openBulkUpdate}>
              <i className="bi bi-pencil-square"></i> Bulk Update
            </button>
            <button className="uw-btn-danger" onClick={askBulkDelete}>
              <i className="bi bi-trash"></i> Bulk Delete
            </button>
          </div>
        )}

        <span className="uw-count">{filtered.length} items</span>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th className="uw-checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th>Supplier</th>
              <th>Min Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="uw-checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                  />
                </td>
                <td>
                  <div className="uw-img-cell">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="uw-prod-img"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="uw-prod-img-placeholder">
                        <i className="bi bi-image"></i>
                      </div>
                    )}
                    <label className="uw-upload-btn">
                      <i className="bi bi-upload"></i>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) =>
                          e.target.files[0] && uploadImage(p.id, e.target.files[0])
                        }
                      />
                    </label>
                  </div>
                </td>
                <td className="uw-bold">{p.name}</td>
                <td>
                  <span className="uw-badge">{p.category}</span>
                </td>
                <td>{p.unit}</td>
                <td>
                  <input
                    type="number"
                    className="uw-inline-input"
                    defaultValue={p.quantity}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val !== p.quantity) inlineUpdateQuantity(p.id, val);
                    }}
                  />
                </td>
                <td>
                  {p.unit_price} {p.currency}
                </td>
                <td>{p.batch_number || '—'}</td>
                <td>
                  {p.expiry_date
                    ? new Date(p.expiry_date).toLocaleDateString()
                    : '—'}
                </td>
                <td>{p.supplier || '—'}</td>
                <td>{p.min_stock}</td>
                <td>
                  <button
                    className="uw-icon-btn blue"
                    onClick={() => openEdit(p)}
                    title="Edit"
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                  <button
                    className="uw-icon-btn red"
                    onClick={() => askDeleteProduct(p)}
                    title="Delete"
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="12" className="uw-no-data">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============ SINGLE ADD / EDIT MODAL ============ */}
      {showModal && (
        <div className="uw-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>{editing ? 'Edit Product' : 'Add New Product'}</h4>
              <button onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="uw-modal-body">
              <ProductFormFields form={form} setForm={setForm} />
              <div className="uw-modal-actions">
                <button
                  type="button"
                  className="uw-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="uw-btn-primary">
                  <i className="bi bi-check-lg"></i> {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ COUNT MODAL ============ */}
      {showCountModal && (
        <div className="uw-modal-overlay" onClick={() => setShowCountModal(false)}>
          <div
            className="uw-modal uw-modal-small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="uw-modal-head">
              <h4>How many products do you want to add?</h4>
              <button onClick={() => setShowCountModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body">
              <div className="uw-count-picker">
                <button
                  type="button"
                  className="uw-count-btn"
                  onClick={() => setBulkCount(Math.max(1, bulkCount - 1))}
                >
                  <i className="bi bi-dash-lg"></i>
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="uw-count-input"
                  value={bulkCount}
                  onChange={(e) =>
                    setBulkCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))
                  }
                />
                <button
                  type="button"
                  className="uw-count-btn"
                  onClick={() => setBulkCount(Math.min(50, bulkCount + 1))}
                >
                  <i className="bi bi-plus-lg"></i>
                </button>
              </div>
              <p className="uw-count-hint">
                You can add up to 50 products at once. Each will get its own form.
              </p>
              <div className="uw-modal-actions">
                <button
                  className="uw-btn-secondary"
                  onClick={() => setShowCountModal(false)}
                >
                  Cancel
                </button>
                <button className="uw-btn-primary" onClick={startBulkAdd}>
                  <i className="bi bi-arrow-right"></i> Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ BULK ADD MODAL ============ */}
      {showBulkModal && (
        <div className="uw-modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div
            className="uw-modal uw-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="uw-modal-head">
              <h4>
                Add {bulkForms.length} Product{bulkForms.length > 1 ? 's' : ''}
              </h4>
              <button onClick={() => setShowBulkModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body uw-bulk-body">
              {bulkForms.length === 0 && (
                <p className="uw-no-data">All forms were closed.</p>
              )}
              {bulkForms.map((f, idx) => (
                <div className="uw-bulk-card" key={idx}>
                  <div className="uw-bulk-card-head">
                    <span className="uw-bulk-card-num">Product #{idx + 1}</span>
                    <button
                      type="button"
                      className="uw-bulk-close"
                      onClick={() => removeBulkForm(idx)}
                      title="Remove this form"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  <ProductFormFields
                    form={f}
                    setForm={(updater) =>
                      updateBulkForm(
                        idx,
                        typeof updater === 'function' ? 'unknown' : Object.keys(updater)[0],
                        typeof updater === 'function'
                          ? updater(f)[Object.keys(updater(f))[0]]
                          : Object.values(updater)[0]
                      )
                    }
                    compact
                  />
                </div>
              ))}
              <div className="uw-modal-actions uw-modal-actions-sticky">
                <button
                  className="uw-btn-secondary"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </button>
                <button className="uw-btn-primary" onClick={saveBulkForms}>
                  <i className="bi bi-check2-all"></i> Save All ({bulkForms.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ BULK UPDATE MODAL ============ */}
      {showBulkUpdateModal && (
        <div
          className="uw-modal-overlay"
          onClick={() => setShowBulkUpdateModal(false)}
        >
          <div
            className="uw-modal uw-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="uw-modal-head">
              <h4>Bulk Update {bulkUpdates.length} Products</h4>
              <button onClick={() => setShowBulkUpdateModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body uw-bulk-body">
              {bulkUpdates.map((p, idx) => (
                <div className="uw-bulk-card" key={p.id}>
                  <div className="uw-bulk-card-head">
                    <span className="uw-bulk-card-num">{p.name}</span>
                  </div>
                  <div className="uw-form-grid">
                    <div>
                      <label>Name *</label>
                      <input
                        className="form-control"
                        value={p.name}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'name', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label>Category</label>
                      <select
                        className="form-control"
                        value={p.category}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'category', e.target.value)
                        }
                      >
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Unit</label>
                      <select
                        className="form-control"
                        value={p.unit}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'unit', e.target.value)
                        }
                      >
                        {units.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={p.unit_price}
                        onChange={(e) =>
                          updateBulkUpdateField(
                            idx,
                            'unit_price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <div>
                      <label>Currency</label>
                      <select
                        className="form-control"
                        value={p.currency}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'currency', e.target.value)
                        }
                      >
                        {currencies.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Batch Number</label>
                      <input
                        className="form-control"
                        value={p.batch_number || ''}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'batch_number', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label>Expiry Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={p.expiry_date || ''}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'expiry_date', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label>Supplier</label>
                      <input
                        className="form-control"
                        value={p.supplier || ''}
                        onChange={(e) =>
                          updateBulkUpdateField(idx, 'supplier', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label>Min Stock</label>
                      <input
                        type="number"
                        className="form-control"
                        value={p.min_stock}
                        onChange={(e) =>
                          updateBulkUpdateField(
                            idx,
                            'min_stock',
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="uw-modal-actions uw-modal-actions-sticky">
                <button
                  className="uw-btn-secondary"
                  onClick={() => setShowBulkUpdateModal(false)}
                >
                  Cancel
                </button>
                <button className="uw-btn-primary" onClick={saveBulkUpdates}>
                  <i className="bi bi-check2-all"></i> Save All Updates
                </button>
              </div>
            </div>
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
                <i className="bi bi-exclamation-triangle-fill"></i>{' '}
                {confirm.type === 'single' ? 'Delete Product?' : 'Delete Products?'}
              </h4>
              <button onClick={closeConfirm} disabled={confirm.loading}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="uw-modal-body">
              <p className="uw-confirm-q">
                {confirm.type === 'single' ? (
                  <>
                    Are you sure you want to delete{' '}
                    <strong>"{confirm.name}"</strong>?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete{' '}
                    <strong>{confirm.count} selected product(s)</strong>?
                  </>
                )}
              </p>

              <div className="uw-confirm-warn">
                <i className="bi bi-info-circle-fill"></i>
                <span>
                  This action cannot be undone. All stock-in, stock-out, usage and
                  request history linked to these product(s) will also be removed.
                </span>
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
                  onClick={runConfirmedAction}
                  disabled={confirm.loading}
                >
                  <i
                    className={`bi ${
                      confirm.loading
                        ? 'bi-arrow-repeat uw-spin'
                        : 'bi-trash-fill'
                    }`}
                  ></i>{' '}
                  {confirm.loading ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable Product Form Fields ---------- */
function ProductFormFields({ form, setForm, compact }) {
  const update = (key, value) => setForm({ ...form, [key]: value });

  return (
    <div className={`uw-form-grid ${compact ? 'uw-form-grid-compact' : ''}`}>
      <div>
        <label>Name *</label>
        <input
          className="form-control"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>
      <div>
        <label>Category *</label>
        <select
          className="form-control"
          value={form.category}
          onChange={(e) => update('category', e.target.value)}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Unit</label>
        <select
          className="form-control"
          value={form.unit}
          onChange={(e) => update('unit', e.target.value)}
        >
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Quantity</label>
        <input
          type="number"
          className="form-control"
          value={form.quantity}
          onChange={(e) => update('quantity', parseInt(e.target.value) || 0)}
        />
      </div>
      <div>
        <label>Unit Price</label>
        <input
          type="number"
          step="0.01"
          className="form-control"
          value={form.unit_price}
          onChange={(e) => update('unit_price', parseFloat(e.target.value) || 0)}
        />
      </div>
      <div>
        <label>Currency</label>
        <select
          className="form-control"
          value={form.currency}
          onChange={(e) => update('currency', e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Batch Number</label>
        <input
          className="form-control"
          value={form.batch_number}
          onChange={(e) => update('batch_number', e.target.value)}
        />
      </div>
      <div>
        <label>Expiry Date</label>
        <input
          type="date"
          className="form-control"
          value={form.expiry_date}
          onChange={(e) => update('expiry_date', e.target.value)}
        />
      </div>
      <div>
        <label>Supplier</label>
        <input
          className="form-control"
          value={form.supplier}
          onChange={(e) => update('supplier', e.target.value)}
        />
      </div>
      <div>
        <label>Min Stock Alert</label>
        <input
          type="number"
          className="form-control"
          value={form.min_stock}
          onChange={(e) => update('min_stock', parseInt(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}