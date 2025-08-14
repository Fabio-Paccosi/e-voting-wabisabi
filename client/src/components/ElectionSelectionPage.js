import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Users, Vote, Clock, CheckCircle, AlertTriangle, LogOut } from 'lucide-react';
import api from '../services/api';

const ElectionSelectionPage = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadAvailableElections();
  }, []);

  const loadAvailableElections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/elections/available');
      setElections(response.data.elections || []);
    } catch (err) {
      console.error('Error loading elections:', err);
      setError('Errore nel caricamento delle elezioni disponibili');
    } finally {
      setLoading(false);
    }
  };

  const handleElectionSelect = (electionId) => {
    navigate(`/vote/${electionId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getElectionStatus = (election) => {
    const now = new Date();
    const startDate = new Date(election.startDate);
    const endDate = new Date(election.endDate);

    if (now < startDate) {
      return { status: 'upcoming', label: 'Prossimamente', color: 'warning' };
    } else if (now > endDate) {
      return { status: 'ended', label: 'Terminata', color: 'danger' };
    } else {
      return { status: 'active', label: 'In corso', color: 'success' };
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Caricamento elezioni disponibili...</p>
      </div>
    );
  }

  return (
    <div className="election-selection-page">
      <div className="page-header">
        <div className="user-info">
          <div className="user-details">
            <h2>Benvenuto, {user?.firstName} {user?.lastName}</h2>
            <p>Seleziona un'elezione per esprimere il tuo voto anonimo</p>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {elections.length === 0 ? (
        <div className="no-elections">
          <Vote size={64} />
          <h3>Nessuna elezione disponibile</h3>
          <p>Al momento non ci sono elezioni attive per le quali sei autorizzato a votare.</p>
          <p>Controlla più tardi o contatta l'amministratore per maggiori informazioni.</p>
        </div>
      ) : (
        <div className="elections-container">
          <h3 className="elections-title">
            <Vote size={24} />
            Elezioni Disponibili ({elections.length})
          </h3>

          <div className="elections-grid">
            {elections.map((election) => {
              const electionStatus = getElectionStatus(election);
              
              return (
                <div key={election.id} className={`election-card ${electionStatus.status}`}>
                  <div className="election-header">
                    <h4>{election.title}</h4>
                    <span className={`status-badge ${electionStatus.color}`}>
                      {electionStatus.label}
                    </span>
                  </div>

                  <div className="election-description">
                    <p>{election.description}</p>
                  </div>

                  <div className="election-details">
                    <div className="detail-item">
                      <Calendar size={16} />
                      <span>Inizio: {formatDate(election.startDate)}</span>
                    </div>
                    <div className="detail-item">
                      <Clock size={16} />
                      <span>Fine: {formatDate(election.endDate)}</span>
                    </div>
                    <div className="detail-item">
                      <Users size={16} />
                      <span>{election.candidatesCount || 0} candidati</span>
                    </div>
                  </div>

                  {election.hasVoted && (
                    <div className="voted-indicator">
                      <CheckCircle size={16} />
                      <span>Hai già votato</span>
                    </div>
                  )}

                  <div className="election-actions">
                    {electionStatus.status === 'active' && !election.hasVoted ? (
                      <button 
                        onClick={() => handleElectionSelect(election.id)}
                        className="vote-button primary"
                      >
                        <Vote size={20} />
                        Vota Ora
                      </button>
                    ) : electionStatus.status === 'active' && election.hasVoted ? (
                      <button 
                        onClick={() => navigate('/results')}
                        className="vote-button secondary"
                      >
                        <CheckCircle size={20} />
                        Vedi Risultati
                      </button>
                    ) : electionStatus.status === 'upcoming' ? (
                      <button className="vote-button disabled" disabled>
                        <Clock size={20} />
                        Non ancora iniziata
                      </button>
                    ) : (
                      <button 
                        onClick={() => navigate('/results')}
                        className="vote-button secondary"
                      >
                        <CheckCircle size={20} />
                        Vedi Risultati
                      </button>
                    )}
                  </div>

                  {electionStatus.status === 'active' && !election.hasVoted && (
                    <div className="election-warning">
                      <AlertTriangle size={16} />
                      <small>Ricorda: puoi votare solo una volta per questa elezione</small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="page-footer">
        <div className="privacy-info">
          <h4>🔒 Protezione della Privacy</h4>
          <p>
            Il sistema WabiSabi garantisce l'anonimato completo del tuo voto attraverso 
            l'uso di credenziali crittografiche avanzate e protocolli di mixing Bitcoin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElectionSelectionPage;