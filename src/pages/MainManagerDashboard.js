import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ToastContainer from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import MainManagerHome from './MainManagerHome';
import MainManagerReviews from './MainManagerReviews';
import MainManagerInventory from './MainManagerInventory';
import MainManagerUsage from './MainManagerUsage';
import Reports from './Reports';
import StockFlow from './StockFlow';
import './MainManagerDashboard.css';

export default function MainManagerDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const navItems = [
    { to: '/finance-manager', label: 'Overview', icon: 'bi-speedometer2', end: true },
    { to: '/finance-manager/reviews', label: 'Pending Reviews', icon: 'bi-clipboard-check' },
    { to: '/finance-manager/inventory', label: 'Inventory', icon: 'bi-box-seam' },
    { to: '/finance-manager/usage', label: 'Usage Reports', icon: 'bi-clipboard-data' },
    { to: '/finance-manager/reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph' },
    { to: '/finance-manager/stock-flow', label: 'Stock Flow', icon: 'bi-graph-up-arrow' },
  ];

  return (
    <div className="uw-mm-layout">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <ToastContainer />
      <div className="uw-mm-body">
        <aside className={`uw-sidebar ${sidebarOpen ? 'uw-sidebar-open' : 'uw-sidebar-closed'}`}>
          <div className="uw-sidebar-user">
            <i className="bi bi-shield-check"></i>
            <div>
              <div className="uw-sb-name">{user?.full_name}</div>
              <div className="uw-sb-role">Finance Manager</div>
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
        <main className="uw-mm-main">
          <Routes>
            <Route index element={<MainManagerHome />} />
            <Route path="reviews" element={<MainManagerReviews />} />
            <Route path="inventory" element={<MainManagerInventory />} />
            <Route path="usage" element={<MainManagerUsage />} />
            <Route path="reports" element={<Reports />} />
            <Route path="stock-flow" element={<StockFlow />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}