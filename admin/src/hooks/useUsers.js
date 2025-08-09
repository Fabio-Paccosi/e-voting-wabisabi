import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';

export const useUsers = (page = 1, limit = 20, status = 'all', search = '') => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers(page, limit, status, search);
      setUsers(response.users || []);
      setPagination(response.pagination || {});
      setError(null);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(loadUsers, search ? 500 : 0);
    return () => clearTimeout(timeoutId);
  }, [page, limit, status, search]);

  const updateUserStatus = async (userId, newStatus) => {
    try {
      await usersAPI.updateUserStatus(userId, newStatus);
      await loadUsers();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    users,
    pagination,
    loading,
    error,
    refresh: loadUsers,
    updateUserStatus
  };
};

export const useWhitelist = () => {
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadWhitelist = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getWhitelist();
      setWhitelist(response.whitelist || []);
      setError(null);
    } catch (err) {
      console.error('Errore caricamento whitelist:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelist();
  }, []);

  const addToWhitelist = async (userData) => {
    try {
      await usersAPI.addToWhitelist(userData);
      await loadWhitelist();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeFromWhitelist = async (email) => {
    try {
      await usersAPI.removeFromWhitelist(email);
      await loadWhitelist();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    whitelist,
    loading,
    error,
    refresh: loadWhitelist,
    addToWhitelist,
    removeFromWhitelist
  };
};