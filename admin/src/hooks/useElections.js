import { useState, useEffect } from 'react';
import { electionsAPI } from '../services/api';

export const useElections = (status = 'all') => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadElections = async () => {
    try {
      setLoading(true);
      const response = await electionsAPI.getElections(status);
      setElections(response.elections || []);
      setError(null);
    } catch (err) {
      console.error('Errore caricamento elezioni:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElections();
  }, [status]);

  const createElection = async (electionData) => {
    try {
      const response = await electionsAPI.createElection(electionData);
      setElections(prev => [response.election, ...prev]);
      return response.election;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const startElection = async (electionId) => {
    try {
      await electionsAPI.startElection(electionId);
      await loadElections();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const endElection = async (electionId) => {
    try {
      await electionsAPI.endElection(electionId);
      await loadElections();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    elections,
    loading,
    error,
    refresh: loadElections,
    createElection,
    startElection,
    endElection
  };
};