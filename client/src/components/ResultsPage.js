import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ArrowLeft, 
  Download, 
  CheckCircle, 
  Users, 
  TrendingUp, 
  Bitcoin,
  Shield,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

const ResultsPage = () => {
  const [results, setResults] = useState([]);
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadElections();
  }, []);

  useEffect(() => {
    if (selectedElection) {
      loadElectionResults(selectedElection.id);
    }
  }, [selectedElection]);

  const loadElections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/elections/voted');
      const votedElections = response.data.elections || [];
      setElections(votedElections);
      
      if (votedElections.length > 0) {
        setSelectedElection(votedElections[0]);
      }
    } catch (err) {
      console.error('Error loading elections:', err);
      setError('Errore nel caricamento delle elezioni');
    } finally {
      setLoading(false);
    }
  };

  const loadElectionResults = async (electionId) => {
    try {
      setRefreshing(true);
      const response = await api.get(`/elections/${electionId}/results`);
      setResults(response.data.results || []);
    } catch (err) {
      console.error('Error loading results:', err);
      setError('Errore nel caricamento dei risultati');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (selectedElection) {
      loadElectionResults(selectedElection.id);
    }
  };

  const handleDownloadResults = async () => {
    try {
      const response = await api.get(`/elections/${selectedElection.id}/results/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `risultati-${selectedElection.title}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading results:', err);
    }
  };

  const getTotalVotes = () => {
    return results.reduce((total, candidate) => total + candidate.votes, 0);
  };

  const getWinner = () => {
    if (results.length === 0) return null;
    return results.reduce((winner, candidate) => 
      candidate.votes > winner.votes ? candidate : winner
    );
  };

  const formatPercentage = (votes, total) => {
    if (total === 0) return '0%';
    return `${((votes / total) * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Caricamento risultati...</p>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <div className="results-page">
        <div className="page-header">
          <button onClick={() => navigate('/elections')} className="back-button">
            <ArrowLeft size={20} />
            Indietro
          </button>
          <h2>Risultati Elezioni</h2>
        </div>
        
        <div className="no-results">
          <BarChart size={64} />
          <h3>Nessun risultato disponibile</h3>
          <p>Non hai ancora partecipato a nessuna elezione o i risultati non sono ancora disponibili.</p>
        </div>
      </div>
    );
  }

  const totalVotes = getTotalVotes();
  const winner = getWinner();

  return (
    <div className="results-page">
      <div className="page-header">
        <button onClick={() => navigate('/elections')} className="back-button">
          <ArrowLeft size={20} />
          Indietro
        </button>
        <div className="header-content">
          <h2>Risultati Elezioni</h2>
          <div className="header-actions">
            <button onClick={handleRefresh} className="refresh-button" disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
              Aggiorna
            </button>
            <button onClick={handleDownloadResults} className="download-button">
              <Download size={16} />
              Esporta
            </button>
          </div>
        </div>
      </div>

      {/* Election Selector */}
      {elections.length > 1 && (
        <div className="election-selector">
          <h3>Seleziona Elezione</h3>
          <div className="election-tabs">
            {elections.map((election) => (
              <button
                key={election.id}
                onClick={() => setSelectedElection(election)}
                className={`election-tab ${selectedElection?.id === election.id ? 'active' : ''}`}
              >
                {election.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedElection && (
        <>
          {/* Election Info */}
          <div className="election-info-card">
            <div className="election-details">
              <h3>{selectedElection.title}</h3>
              <p>{selectedElection.description}</p>
              <div className="election-stats">
                <div className="stat">
                  <Users size={20} />
                  <span>{totalVotes} voti totali</span>
                </div>
                <div className="stat">
                  <CheckCircle size={20} />
                  <span>Elezione completata</span>
                </div>
              </div>
            </div>
            
            {winner && (
              <div className="winner-card">
                <TrendingUp size={24} />
                <div className="winner-info">
                  <h4>Vincitore</h4>
                  <p>{winner.firstName} {winner.lastName}</p>
                  <span>{winner.votes} voti ({formatPercentage(winner.votes, totalVotes)})</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {results.length > 0 ? (
            <>
              {/* Bar Chart */}
              <div className="chart-container">
                <h3>Risultati per Candidato</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={results} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="lastName" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, 'Voti']}
                      labelFormatter={(label) => `Candidato: ${label}`}
                    />
                    <Bar dataKey="votes" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="chart-container">
                <h3>Distribuzione Voti</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={results}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="votes"
                      label={({ firstName, lastName, votes }) => 
                        `${firstName} ${lastName}: ${votes}`
                      }
                    >
                      {results.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed Results Table */}
              <div className="results-table-container">
                <h3>Risultati Dettagliati</h3>
                <div className="results-table">
                  <div className="table-header">
                    <span>Posizione</span>
                    <span>Candidato</span>
                    <span>Partito</span>
                    <span>Voti</span>
                    <span>Percentuale</span>
                  </div>
                  {results
                    .sort((a, b) => b.votes - a.votes)
                    .map((candidate, index) => (
                      <div key={candidate.id} className="table-row">
                        <span className="position">#{index + 1}</span>
                        <span className="candidate-name">
                          {candidate.firstName} {candidate.lastName}
                        </span>
                        <span className="party">{candidate.party || 'Indipendente'}</span>
                        <span className="votes">{candidate.votes}</span>
                        <span className="percentage">
                          {formatPercentage(candidate.votes, totalVotes)}
                        </span>
                      </div>
                  ))}
                </div>
              </div>

              {/* Blockchain Verification */}
              <div className="blockchain-verification">
                <h3>Verifica Blockchain</h3>
                <div className="verification-info">
                  <div className="verification-item">
                    <Bitcoin size={24} />
                    <div>
                      <h4>Transazioni Registrate</h4>
                      <p>Tutti i voti sono stati registrati sulla blockchain Bitcoin per garantire immutabilità e trasparenza.</p>
                    </div>
                  </div>
                  <div className="verification-item">
                    <Shield size={24} />
                    <div>
                      <h4>Privacy Protetta</h4>
                      <p>Il protocollo WabiSabi ha garantito l'anonimato completo di tutti i votanti attraverso il mixing crittografico.</p>
                    </div>
                  </div>
                </div>
                
                {selectedElection.blockchainTxId && (
                  <button className="blockchain-explorer-button">
                    <ExternalLink size={16} />
                    Visualizza su Block Explorer
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="no-results">
              <BarChart size={64} />
              <h3>Risultati non ancora disponibili</h3>
              <p>I risultati per questa elezione non sono ancora stati pubblicati o l'elezione è ancora in corso.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;