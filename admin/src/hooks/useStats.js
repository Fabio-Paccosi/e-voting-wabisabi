import { useState, useEffect } from 'react';
import { dashboardAPI, adminWS } from '../services/api';
import { REFRESH_INTERVALS } from '../utils/constants';

export const useStats = (autoRefresh = true) => {
  const [stats, setStats] = useState({
    totalElections: 0,
    totalVotes: 0,
    activeUsers: 0,
    whitelistUsers: 0,
    loading: true,
    lastUpdated: null
  });

  const [error, setError] = useState(null);

  const loadStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      const data = await dashboardAPI.getStats();
      setStats({
        ...data,
        loading: false,
        lastUpdated: new Date().toISOString()
      });
      setError(null);
    } catch (err) {
      console.error('Errore caricamento statistiche:', err);
      setError(err.message);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadStats();

    if (autoRefresh) {
      const interval = setInterval(loadStats, REFRESH_INTERVALS.DASHBOARD);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Real-time updates via WebSocket
  useEffect(() => {
    const handleStatsUpdate = (newStats) => {
      setStats(prev => ({
        ...prev,
        ...newStats,
        lastUpdated: new Date().toISOString()
      }));
    };

    adminWS.on('stats-update', handleStatsUpdate);
    
    return () => {
      adminWS.off('stats-update', handleStatsUpdate);
    };
  }, []);

  return { stats, error, refresh: loadStats };
};