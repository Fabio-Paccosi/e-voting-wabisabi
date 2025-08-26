import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Users, Vote, Clock, CheckCircle, AlertTriangle, List, LogOut } from 'lucide-react';
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

  const viewResults = () => {
    navigate('/results');
  };

  return (
    <div className="election-selection-page">
      <div className="page-header">
        <div className="user-info">
          <div className="user-details">
            <h2>Benvenuto/a, {user?.firstName} {user?.lastName}</h2>
            <p>Seleziona un'elezione per esprimere il tuo voto anonimo</p>
          </div>
          <button onClick={viewResults} className="results-button">
            <List size={20} />
            Risultati
          </button>
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
                      <span>{election.candidates.length || 0} candidati</span>
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

    <div class="page-footer">
            <h3 className="elections-title">
                <List size={24} />
                Informativa sul sistama di E-Voting WabiSabi
            </h3>
            <div class="privacy-info">
                <h4>🔒 Protezione della Privacy</h4>
                <p>
                    Il sistema WabiSabi garantisce l'anonimato completo del tuo voto attraverso
                    l'uso di credenziali crittografiche avanzate (KVAC) e commitment omomorfi.
                    Tutti i dati sensibili passano attraverso reti anonime come Tor, impedendo
                    la raccolta di metadati e garantendo che nemmeno il coordinatore possa
                    collegare i voti alle identità degli elettori.
                </p>
                <ul class="feature-list">
                    <li>Credenziali anonime verificabili (KVAC)</li>
                    <li>Commitment omomorfi per nascondere il contenuto del voto</li>
                    <li>Traffico automatico attraverso rete Tor</li>
                    <li>Impossibilità di tracciamento dell'identità del votante</li>
                </ul>
            </div>

            <div class="privacy-info">
                <h4>🛡️ Sicurezza e Integrità</h4>
                <p>
                    Il protocollo WabiSabi implementa controlli crittografici robusti basati su
                    zero-knowledge proofs e registrazione immutabile su blockchain Bitcoin.
                    I serial numbers univoci prevengono il doppio voto e le frodi, mentre
                    i commitment garantiscono che i voti siano registrati esattamente come espressi.
                </p>
                <ul class="feature-list">
                    <li>Zero-knowledge proofs per validazione sicura</li>
                    <li>Serial numbers univoci anti-frode</li>
                    <li>Registrazione immutabile su blockchain</li>
                    <li>Prevenzione automatica del doppio voto</li>
                </ul>
            </div>

            <div class="privacy-info">
                <h4> Verificabilità Pubblica</h4>
                <p>
                    Ogni voto è registrato pubblicamente sulla blockchain e può essere verificato
                    matematicamente senza rivelare il contenuto o l'identità del votante.
                    I commitment e i seriali vengono validati crittograficamente durante
                    l'intero processo, garantendo trasparenza e auditabilità.
                </p>
                <ul class="feature-list">
                    <li>Registrazione pubblica verificabile</li>
                    <li>Validazione matematica dei commitment</li>
                    <li>Auditabilità completa del processo</li>
                    <li>Trasparenza senza compromettere la privacy</li>
                </ul>
            </div>

            <div class="privacy-info">
                <h4>⚡ Affidabilità e Decentralizzazione</h4>
                <p>
                    La struttura decentralizzata della blockchain Bitcoin, combinata con
                    i controlli crittografici distribuiti, rende il sistema altamente
                    resistente a guasti e comportamenti malevoli. Il protocollo mantiene
                    la neutralità e confidenzialità dei dati anche in caso di compromissione
                    parziale del coordinatore.
                </p>
                <ul class="feature-list">
                    <li>Architettura completamente decentralizzata</li>
                    <li>Resistenza a guasti e attacchi</li>
                    <li>Controlli distribuiti multi-livello</li>
                    <li>Funzionamento anche con coordinatore compromesso</li>
                </ul>
            </div>
        </div>
    </div>
  );
};

export default ElectionSelectionPage;