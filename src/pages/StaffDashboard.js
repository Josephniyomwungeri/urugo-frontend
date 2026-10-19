import React, { useState } from 'react';
import { NavLink, Routes, Route } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ToastContainer from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import StaffHome from './StaffHome';
import StaffRequests from './StaffRequests';
import StaffProducts from './StaffProducts';
import './StaffDashboard.css';

export default function StaffDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const navItems = [
    { to: '/staff', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
    { to: '/staff/requests', label: 'My Requests', icon: 'bi-inbox' },
    { to: '/staff/products', label: 'Products Catalog', icon: 'bi-box-seam' },
  ];

  return (
    <div className="uw-staff-layout">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <ToastContainer />
      <div className="uw-staff-body">
        <aside className={`uw-sidebar ${sidebarOpen ? 'uw-sidebar-open' : 'uw-sidebar-closed'}`}>
          <div className="uw-sidebar-user">
            <i className="bi bi-person-circle"></i>
            <div>
              <div className="uw-sb-name">{user?.full_name}</div>
              <div className="uw-sb-role">{user?.department} Staff</div>
            </div>
          </div>
          <nav className="uw-sidebar-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `uw-nav-item ${isActive ? 'uw-nav-active' : ''}`}
              >
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="uw-staff-main">
          <Routes>
            <Route index element={<StaffHome />} />
            <Route path="requests" element={<StaffRequests />} />
            <Route path="products" element={<StaffProducts />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}