import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ToastContainer from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import ManagerHome from './ManagerHome';
import Inventory from './Inventory';
import StockIn from './StockIn';
import StockOut from './StockOut';
import TruckStock from './TruckStock';
import StaffManagement from './StaffManagement';
import ManagerRequests from './ManagerRequests';
import Losses from './Losses';
import ManagerUsage from './ManagerUsage';
import Reports from './Reports';
import StockFlow from './StockFlow';          // 🆕
import './ManagerDashboard.css';

export default function ManagerDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const navItems = [
    { to: '/manager', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
    { to: '/manager/inventory', label: 'Inventory', icon: 'bi-box-seam' },
    { to: '/manager/stock-out', label: 'Stock Out', icon: 'bi-box-arrow-up' },
    { to: '/manager/truck-stock', label: 'Truck Stock', icon: 'bi-truck' },
    { to: '/manager/requests', label: 'Requests', icon: 'bi-inbox' },
    { to: '/manager/usage', label: 'Usage Reports', icon: 'bi-clipboard-data' },
    { to: '/manager/losses', label: 'Lost / Damaged', icon: 'bi-exclamation-triangle' },
    { to: '/manager/stock-flow', label: 'Stock Flow', icon: 'bi-graph-up-arrow' }, // 🆕
    { to: '/manager/staff', label: 'Staff Members', icon: 'bi-people' },
    { to: '/manager/reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph' },
  ];

  return (
    <div className="uw-manager-layout">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <ToastContainer />
      <div className="uw-manager-body">
        <aside className={`uw-sidebar ${sidebarOpen ? 'uw-sidebar-open' : 'uw-sidebar-closed'}`}>
          <div className="uw-sidebar-user">
            <i className="bi bi-person-badge-fill"></i>
            <div>
              <div className="uw-sb-name">{user?.full_name}</div>
              <div className="uw-sb-role">Stock Manager</div>
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
        <main className="uw-manager-main">
          <Routes>
            <Route index element={<ManagerHome />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="stock-in" element={<StockIn />} />
            <Route path="stock-out" element={<StockOut />} />
            <Route path="truck-stock" element={<TruckStock />} />
            <Route path="requests" element={<ManagerRequests />} />
            <Route path="usage" element={<ManagerUsage />} />
            <Route path="losses" element={<Losses />} />
            <Route path="stock-flow" element={<StockFlow />} />   {/* 🆕 */}
            <Route path="staff" element={<StaffManagement />} />
            <Route path="reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}