import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
export const API_URL = 'https://urugo-backend.onrender.com/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('uw_token'));
  // 1. ADD A LOADING STATE (default to true so it waits on first load)
  const [loading, setLoading] = useState(true); 

  // Restore user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('uw_user');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('uw_user');
        localStorage.removeItem('uw_token');
      }
    }
    // 2. TELL REACT WE ARE DONE CHECKING
    setLoading(false); 
  }, [token]);

  // Set axios default auth header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = (userData, tokenValue) => {
    setUser(userData);
    setToken(tokenValue);
    localStorage.setItem('uw_token', tokenValue);
    localStorage.setItem('uw_user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenValue}`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('uw_token');
    localStorage.removeItem('uw_user');
    delete axios.defaults.headers.common['Authorization'];
  };

  // 3. PREVENT RENDERING UNTIL LOCALSTORAGE IS CHECKED
  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  return (
    // Add loading to the provider just in case you need it elsewhere
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);