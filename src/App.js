import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Homepage from './pages/Homepage';
import ManagerDashboard from './pages/ManagerDashboard';
import MainManagerDashboard from './pages/MainManagerDashboard';
import StaffDashboard from './pages/StaffDashboard';
import './App.css';

function ProtectedRoute({ children, roleRequired }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (roleRequired && user.role !== roleRequired) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />

      <Route
        path="/manager/*"
        element={
          <ProtectedRoute roleRequired="manager">
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/finance-manager/*"
        element={
          <ProtectedRoute roleRequired="finance_manager">
            <MainManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff/*"
        element={
          <ProtectedRoute roleRequired="staff">
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}