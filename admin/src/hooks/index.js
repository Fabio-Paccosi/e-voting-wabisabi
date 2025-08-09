// admin/src/hooks/index.js - Custom Hooks per Admin Dashboard

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  dashboardAPI, 
  electionsAPI, 
  usersAPI, 
  systemAPI, 
  authAPI,
  adminWS 
} from '../services/api';

// ==========================================
// HOOK PER GESTIONE API GENERICA
// ==========================================
export const useApi = (apiFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Si è verificato un errore');
      throw err;
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  const refresh = useCallback(() => execute(), [execute]);

  return { data, loading, error, refresh, execute };
};

// ==========================================
// HOOK PER DASHBOARD STATS
// ==========================================
export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    totalElections: 0,
    totalVotes: 0,
    activeUsers: 0,
    whitelistUsers: 0,
    loading: true
  });

  const [systemStatus, setSystemStatus] = useState({
    services: [],
    database: { status: 'unknown', responseTime: 0 },
    redis: { status: 'unknown', responseTime: 0 },
    blockchain: { status: 'unknown', blockHeight: 0 },
    loading: true
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      setSystemStatus(prev => ({ ...prev, loading: true }));
      setError(null);

      const [statsData, statusData, activityData] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getSystemStatus(),
        dashboardAPI.getRecentActivity()
      ]);

      setStats({ ...statsData, loading: false });
      setSystemStatus({ ...statusData, loading: false });
      setRecentActivity(activityData.activities || []);
    } catch (err) {
      setError(err.message);
      setStats(prev => ({ ...prev, loading: false }));
      setSystemStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    stats,
    systemStatus,
    recentActivity,
    loading: stats.loading || systemStatus.loading,
    error,
    refresh: loadData
  };
};

// ==========================================
// HOOK PER GESTIONE UTENTI
// ==========================================
export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const loadUsers = useCallback(async (page = 1, limit = 20) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await usersAPI.getUsers({ page, limit });
      setUsers(data.users || []);
      setPagination(data.pagination || { page, limit, total: 0, pages: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWhitelist = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await usersAPI.getWhitelist();
      setWhitelist(data.whitelist || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToWhitelist = useCallback(async (userData) => {
    try {
      await usersAPI.addToWhitelist(userData);
      await loadWhitelist(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadWhitelist]);

  const removeFromWhitelist = useCallback(async (email) => {
    try {
      await usersAPI.removeFromWhitelist(email);
      await loadWhitelist(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadWhitelist]);

  const updateUserStatus = useCallback(async (userId, status) => {
    try {
      await usersAPI.updateUserStatus(userId, status);
      await loadUsers(pagination.page, pagination.limit); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadUsers, pagination.page, pagination.limit]);

  useEffect(() => {
    loadUsers();
    loadWhitelist();
  }, []);

  return {
    users,
    whitelist,
    loading,
    error,
    pagination,
    actions: {
      loadUsers,
      loadWhitelist,
      addToWhitelist,
      removeFromWhitelist,
      updateUserStatus,
      changePage: (page) => loadUsers(page, pagination.limit)
    }
  };
};

// ==========================================
// HOOK PER GESTIONE ELEZIONI
// ==========================================
export const useElections = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadElections = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await electionsAPI.getElections(params);
      setElections(data.elections || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startElection = useCallback(async (electionId) => {
    try {
      await electionsAPI.startElection(electionId);
      await loadElections(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadElections]);

  const stopElection = useCallback(async (electionId) => {
    try {
      await electionsAPI.stopElection(electionId);
      await loadElections(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadElections]);

  const createElection = useCallback(async (electionData) => {
    try {
      await electionsAPI.createElection(electionData);
      await loadElections(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadElections]);

  const updateElection = useCallback(async (electionId, electionData) => {
    try {
      await electionsAPI.updateElection(electionId, electionData);
      await loadElections(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadElections]);

  const deleteElection = useCallback(async (electionId) => {
    try {
      await electionsAPI.deleteElection(electionId);
      await loadElections(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadElections]);

  useEffect(() => {
    loadElections();
  }, []);

  return {
    elections,
    loading,
    error,
    actions: {
      loadElections,
      startElection,
      stopElection,
      createElection,
      updateElection,
      deleteElection
    }
  };
};

// ==========================================
// HOOK PER WEBSOCKET REAL-TIME
// ==========================================
export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [realTimeData, setRealTimeData] = useState({
    connectedUsers: 0,
    activeVotingSessions: 0,
    lastUpdate: null
  });

  useEffect(() => {
    // Setup WebSocket listeners
    const handleConnected = () => {
      setConnected(true);
      console.log('[Hook] WebSocket connected');
    };

    const handleDisconnected = () => {
      setConnected(false);
      console.log('[Hook] WebSocket disconnected');
    };

    const handleStatsUpdate = (data) => {
      setRealTimeData(prevData => ({
        ...prevData,
        ...data,
        lastUpdate: new Date().toISOString()
      }));
    };

    const handleUserUpdate = (data) => {
      // Trigger refresh of user data if needed
      window.dispatchEvent(new CustomEvent('userDataUpdate', { detail: data }));
    };

    const handleElectionUpdate = (data) => {
      // Trigger refresh of election data if needed
      window.dispatchEvent(new CustomEvent('electionDataUpdate', { detail: data }));
    };

    // Register listeners
    adminWS.on('connected', handleConnected);
    adminWS.on('disconnected', handleDisconnected);
    adminWS.on('stats_update', handleStatsUpdate);
    adminWS.on('user_update', handleUserUpdate);
    adminWS.on('election_update', handleElectionUpdate);

    // Connect WebSocket
    adminWS.connect();

    // Cleanup
    return () => {
      adminWS.off('connected', handleConnected);
      adminWS.off('disconnected', handleDisconnected);
      adminWS.off('stats_update', handleStatsUpdate);
      adminWS.off('user_update', handleUserUpdate);
      adminWS.off('election_update', handleElectionUpdate);
    };
  }, []);

  const sendMessage = useCallback((type, payload) => {
    adminWS.send(type, payload);
  }, []);

  return {
    connected,
    realTimeData,
    sendMessage
  };
};

// ==========================================
// HOOK PER GESTIONE FORM
// ==========================================
export const useForm = (initialValues = {}, validationSchema = null) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
  }, []);

  const validate = useCallback(() => {
    if (!validationSchema) return true;

    const newErrors = {};
    let isValid = true;

    Object.keys(validationSchema).forEach(field => {
      const rules = validationSchema[field];
      const value = values[field];

      if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field] = `${field} è richiesto`;
        isValid = false;
      } else if (rules.minLength && value && value.length < rules.minLength) {
        newErrors[field] = `${field} deve avere almeno ${rules.minLength} caratteri`;
        isValid = false;
      } else if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field] = `${field} deve essere un'email valida`;
        isValid = false;
      } else if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value, values);
        if (customError) {
          newErrors[field] = customError;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationSchema]);

  const handleSubmit = useCallback(async (onSubmit) => {
    setIsSubmitting(true);
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(values).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    try {
      if (validate()) {
        await onSubmit(values);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    handleSubmit,
    reset,
    isValid: Object.keys(errors).length === 0
  };
};

// ==========================================
// HOOK PER GESTIONE PAGINAZIONE
// ==========================================
export const usePagination = (totalItems, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const goToNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goToPrevious = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToFirst = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLast = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    itemsPerPage,
    goToPage,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    hasNext: currentPage < totalPages,
    hasPrevious: currentPage > 1
  };
};

// ==========================================
// HOOK PER GESTIONE FILTRI E RICERCA
// ==========================================
export const useFilters = (data = []) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({});

  const filteredData = useCallback(() => {
    let result = [...data];

    // Apply search
    if (searchTerm.trim()) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        result = result.filter(item => {
          if (typeof value === 'string') {
            return String(item[key]).toLowerCase().includes(value.toLowerCase());
          }
          return item[key] === value;
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortColumn, sortDirection, filters]);

  const handleSort = useCallback((column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters({});
    setSortColumn('');
    setSortDirection('asc');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    sortColumn,
    sortDirection,
    filters,
    filteredData: filteredData(),
    handleSort,
    setFilter,
    clearFilters
  };
};

// ==========================================
// HOOK PER DEBOUNCE
// ==========================================
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// ==========================================
// HOOK PER LOCAL STORAGE
// ==========================================
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};

// ==========================================
// HOOK PER ASYNC OPERATIONS
// ==========================================
export const useAsync = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFunction) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction();
      return result;
    } catch (err) {
      setError(err.message || 'Si è verificato un errore');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
};

export default {
  useApi,
  useDashboardStats,
  useUsers,
  useElections,
  useWebSocket,
  useForm,
  usePagination,
  useFilters,
  useDebounce,
  useLocalStorage,
  useAsync
};