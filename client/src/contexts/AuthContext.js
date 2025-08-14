import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('authToken');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, taxCode) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        taxCode
      });

      const { user: userData, token } = response.data;

      if (token) {
        localStorage.setItem('authToken', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
        return { success: true, user: userData };
      } else {
        return { success: false, message: 'Token non ricevuto' };
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response?.data?.message) {
        return { success: false, message: err.response.data.message };
      } else if (err.response?.status === 401) {
        return { success: false, message: 'Credenziali non valide' };
      } else if (err.response?.status === 403) {
        return { success: false, message: 'Utente non autorizzato al voto' };
      } else {
        return { success: false, message: 'Errore di connessione' };
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};