import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './StaffManagement.css';

const departments = [
  'Kitchen',
  'Coffee Shop',
  'Carpet',
  'Leather & Craftmanship',
  'TVET',
  'Maintenance',
  'Tailoring',
  'Diary Production',
  'Agriculture',
  'Hospitality',
  'IT',
  'Management',
];

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: 'Kitchen',
    role: 'staff',
  });
  const [search, setSearch] = useState('');
  const { showToast } = useNotifications();

  // Role options Stock Manager can assign
  const canAssignRoles =
    user?.role === 'finance_manager'
      ? [
          { value: 'staff', label: 'Staff' },
          { value: 'manager', label: 'Stock Manager' },
          { value: 'finance_manager', label: 'Finance Manager' },
        ]
      : [
          { value: 'staff', label: 'Staff' },
          { value: 'manager', label: 'Stock Manager' },
        ];

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/staff`);
      setStaff(res.data);
    } catch {
      showToast('Failed to load staff', 'error');
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 12000);

    const handler = () => load();
    window.addEventListener('uw:refresh', handler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('uw:refresh', handler);
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      full_name: '',
      email: '',
      phone: '',
      department: 'Kitchen',
      role: 'staff',
    });
    setShowModal(true);
  };

  const openEdit = (s) => {
    // Defensive: Stock Manager cannot edit a Finance Manager
    if (user?.role !== 'finance_manager' && s.role === 'finance_manager') {
      showToast('You cannot edit a Finance Manager', 'error');
      return;
    }
    setEditing(s);
    setForm({ ...s });
    setShowModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${API_URL}/staff/${editing.id}`, form);
        showToast('Staff updated', 'success');
      } else {
        const res = await axios.post(`${API_URL}/staff`, form);
        showToast(`Staff added. Generated PIN: ${res.data.pin}`, 'success');
      }
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const remove = async (id, role) => {
    // Defensive: Stock Manager cannot delete a Finance Manager
    if (user?.role !== 'finance_manager' && role === 'finance_manager') {
      showToast('You cannot delete a Finance Manager', 'error');
      return;
    }
    if (!window.confirm('Delete this staff member?')) return;
    try {
      await axios.delete(`${API_URL}/staff/${id}`);
      showToast('Staff deleted', 'success');
      load();
    } catch {
      showToast('Failed', 'error');
    }
  };

  const filtered = staff.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase())
  );

  const roleBadge = (role) => {
    if (role === 'finance_manager') return 'uw-badge purple';
    if (role === 'manager') return 'uw-badge green';
    return 'uw-badge';
  };

  const roleLabel = (role) => {
    if (role === 'finance_manager') return 'Finance Manager';
    if (role === 'manager') return 'Stock Manager';
    return 'Staff';
  };

  return (
    <div className="uw-sm">
      <div className="uw-page-header">
        <h2 className="uw-page-title">
          <i className="bi bi-people"></i> Staff Members
        </h2>
        <button className="uw-btn-primary" onClick={openAdd}>
          <i className="bi bi-person-plus"></i> Add Staff
        </button>
      </div>

      <div className="uw-toolbar">
        <div className="uw-search">
          <i className="bi bi-search"></i>
          <input
            className="form-control"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="uw-count">{filtered.length} staff</span>
      </div>

      <div className="uw-table-wrap">
        <table className="uw-excel-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Department</th>
              <th>PIN</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td className="uw-bold">{s.full_name}</td>
                <td>{s.email}</td>
                <td>{s.phone || '—'}</td>
                <td>
                  <span className="uw-badge">{s.department}</span>
                </td>
                <td>
                  <span className="uw-pin">{s.pin}</span>
                </td>
                <td>
                  <span className={roleBadge(s.role)}>{roleLabel(s.role)}</span>
                </td>
                <td>{new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    className="uw-icon-btn blue"
                    onClick={() => openEdit(s)}
                    title="Edit"
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                  <button
                    className="uw-icon-btn red"
                    onClick={() => remove(s.id, s.role)}
                    title="Delete"
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="9" className="uw-no-data">
                  No staff found
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
              <h4>{editing ? 'Edit Staff Member' : 'Add New Staff Member'}</h4>
              <button onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={submit} className="uw-modal-body">
              <div className="uw-form-grid">
                <div>
                  <label>Full Name *</label>
                  <input
                    className="form-control"
                    required
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Phone Number</label>
                  <input
                    className="form-control"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Department *</label>
                  <select
                    className="form-control"
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                  >
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Role *</label>
                  <select
                    className="form-control"
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value })
                    }
                  >
                    {canAssignRoles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!editing && (
                <p className="uw-pin-note">
                  <i className="bi bi-info-circle"></i> A PIN will be automatically
                  generated based on the department (e.g. KT1234 for Kitchen).
                </p>
              )}
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