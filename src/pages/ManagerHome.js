import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import './ManagerHome.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ManagerHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) return <div className="uw-loading">Loading dashboard...</div>;

  // ✅ Merge all months from chartIn, chartOut, and chartLoss into one sorted list
  const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const allMonths = Array.from(new Set([
    ...(stats.chartIn || []).map(x => x.month),
    ...(stats.chartOut || []).map(x => x.month),
    ...(stats.chartLoss || []).map(x => x.month),
  ])).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

  // Helper: map a chart array into an aligned array matching allMonths
  const align = (arr) =>
    allMonths.map(m => {
      const found = (arr || []).find(x => x.month === m);
      return found ? Number(found.total) : 0;
    });

  const chartData = {
    labels: allMonths,
    datasets: [
      {
        label: 'Stock In',
        data: align(stats.chartIn),
        backgroundColor: '#0d6efd',
        borderRadius: 6,
      },
      {
        label: 'Stock Out',
        data: align(stats.chartOut),
        backgroundColor: '#fd7e14',
        borderRadius: 6,
      },
      {
        label: 'Lost / Damaged',           // ✅ NEW dataset
        data: align(stats.chartLoss),
        backgroundColor: '#dc3545',        // red, matching the stat card
        borderRadius: 6,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div className="uw-mh">
      <h2 className="uw-page-title"><i className="bi bi-speedometer2"></i> Dashboard Overview</h2>

      <div className="uw-stat-grid">
        <div className="uw-stat-card">
          <div className="uw-stat-icon blue"><i className="bi bi-boxes"></i></div>
          <div>
            <div className="uw-stat-label">Total Items</div>
            <div className="uw-stat-value">{stats.totalItems}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon green"><i className="bi bi-box-arrow-in-down"></i></div>
          <div>
            <div className="uw-stat-label">Stock In (month)</div>
            <div className="uw-stat-value">{stats.stockInMonth}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon orange"><i className="bi bi-box-arrow-up"></i></div>
          <div>
            <div className="uw-stat-label">Stock Out (month)</div>
            <div className="uw-stat-value">{stats.stockOutMonth}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon red"><i className="bi bi-exclamation-triangle"></i></div>
          <div>
            <div className="uw-stat-label">Lost / Damaged</div>
            <div className="uw-stat-value">{stats.lostDamaged}</div>
          </div>
        </div>
        <div className="uw-stat-card">
          <div className="uw-stat-icon purple"><i className="bi bi-inbox"></i></div>
          <div>
            <div className="uw-stat-label">Pending Requests</div>
            <div className="uw-stat-value">{stats.pendingRequests}</div>
          </div>
        </div>
      </div>

      <div className="uw-mh-grid">
        <div className="uw-card">
          <h5><i className="bi bi-bar-chart-fill"></i> Stock In vs Out vs Losses (last 5 months)</h5>
          <Bar data={chartData} options={chartOptions} />
        </div>
        <div className="uw-card">
          <h5><i className="bi bi-bell-fill"></i> Low-Stock Alerts</h5>
          {stats.lowStock.length === 0 ? (
            <p className="uw-empty">No low-stock items. Great!</p>
          ) : (
            <ul className="uw-low-stock-list">
              {stats.lowStock.map(item => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span className={`uw-low-badge ${item.quantity < 10 ? 'danger' : 'warn'}`}>
                    {item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}