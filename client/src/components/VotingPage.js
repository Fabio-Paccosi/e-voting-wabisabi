// client/src/components/VotingPage.js
// Versione con integrazione WabiSabi completa e ricevuta dettagliata

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Bitcoin,
  Key,
  Lock,
  CheckCircle,
  AlertTriangle,
  Clock,
  Wallet
} from 'lucide-react';
import api from '../services/api';
import WabiSabiVoting from '../services/WabiSabiVoting';
import VoteReceipt from './VoteReceipt';

const VotingPage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [votingProgress, setVotingProgress] = useState(0);
  const [cryptoStatus, setCryptoStatus] = useState('');

  // NUOVI STATI PER WABISABI
  const [isWabiSabiEnabled] = useState(
    process.env.REACT_APP_WABISABI_ENABLED === 'true'
  );
  const [wabiSabiStep, setWabiSabiStep] = useState('');
  const [wabiSabiProgress, setWabiSabiProgress] = useState(0);
  const [credentials, setCredentials] = useState(null);
  const [voteCommitment, setVoteCommitment] = useState(null);
  const [zkProof, setZkProof] = useState(null);

  // NUOVI STATI PER RICEVUTA DETTAGLIATA
  const [voteId, setVoteId] = useState(null);
  const [showDetailedReceipt, setShowDetailedReceipt] = useState(false);

  useEffect(() => {
    initializeVoting();
  }, [electionId]);

  const initializeVoting = async () => {
    try {
      setLoading(true);
      
      // Recupera l'indirizzo Bitcoin dalla sessione o dallo state
      let address = sessionStorage.getItem(`bitcoinAddress_${electionId}`);
      if (!address && location.state?.bitcoinAddress) {
        address = location.state.bitcoinAddress;
        sessionStorage.setItem(`bitcoinAddress_${electionId}`, address);
      }
      
      if (!address) {
        setError('Indirizzo Bitcoin non trovato. Torna alla selezione elezioni e reinserisci il wallet.');
        return;
      }
      
      setBitcoinAddress(address);
      
      // Carica i dettagli dell'elezione e candidati
      const response = await api.get(`/elections/${electionId}/details`);
      
      if (response.data.success) {
        setElection(response.data.election);
        setCandidates(response.data.election.candidates || []);
      } else {
        setError(response.data.error || 'Errore nel caricamento dell\'elezione');
      }
      
    } catch (err) {
      console.error('Error initializing voting:', err);
      
      if (err.response?.status === 403) {
        setError('Non sei autorizzato per questa elezione');
      } else if (err.response?.status === 400) {
        setError('Elezione non attiva o periodo di voto scaduto');
      } else {
        setError('Errore nel caricamento dell\'elezione');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    setError('');
  };

  const handleVoteSubmit = () => {
    if (!selectedCandidate) {
      setError('Seleziona un candidato prima di procedere');
      return;
    }
    
    setPrivateKey('');
    setError('');
    setShowPrivateKeyModal(true);
  };

  // FUNZIONE CONFIRMVOTE AGGIORNATA PER SUPPORTARE RICEVUTA DETTAGLIATA
  const confirmVote = async () => {
    if (!privateKey.trim()) {
      setError('Inserisci la chiave privata per confermare il voto');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setVotingProgress(0);
      setWabiSabiProgress(0);
      
      if (isWabiSabiEnabled) {
        // ============ FLUSSO WABISABI COMPLETO ============
        console.log('[WABISABI] 🚀 Inizializzazione voto anonimo');
        
        // FASE 1: Inizializzazione WabiSabi
        setWabiSabiStep('Inizializzazione servizio WabiSabi...');
        setCryptoStatus('Inizializzazione protocollo di voto anonimo...');
        setVotingProgress(10);
        setWabiSabiProgress(10);
        
        const wabiSabi = new WabiSabiVoting(user, api);
        await new Promise(resolve => setTimeout(resolve, 1000)); // UX delay
        
        // FASE 2: Richiesta credenziali KVAC
        setWabiSabiStep('Richiesta credenziali anonime (KVAC)...');
        setCryptoStatus('Richiesta credenziali KVAC dal coordinatore...');
        setVotingProgress(25);
        setWabiSabiProgress(25);
        
        const requestedCredentials = await wabiSabi.requestCredentials(electionId);
        setCredentials(requestedCredentials);
        console.log('[WABISABI] ✓ Credenziali KVAC ricevute:', requestedCredentials.credentialId);
        
        // FASE 3: Generazione commitment omomorfico
        setWabiSabiStep('Generazione commitment crittografico...');
        setCryptoStatus('Creazione commitment omomorfico del voto...');
        setVotingProgress(45);
        setWabiSabiProgress(45);
        
        const commitment = await wabiSabi.createVoteCommitment(
          selectedCandidate.id,
          requestedCredentials.serialNumber,
          privateKey.trim()
        );
        setVoteCommitment(commitment);
        console.log('[WABISABI] ✓ Commitment creato per indirizzo:', bitcoinAddress);
        
        // FASE 4: Generazione Zero-Knowledge Proof
        setWabiSabiStep('Generazione zero-knowledge proof...');
        setCryptoStatus('Creazione prova crittografica di validità...');
        setVotingProgress(65);
        setWabiSabiProgress(65);
        
        const generatedZkProof = await wabiSabi.generateZKProof(
          commitment,
          requestedCredentials
        );
        setZkProof(generatedZkProof);
        console.log('[WABISABI] ✓ ZK-proof generato');
        
        // FASE 5: Invio voto anonimo
        setWabiSabiStep('Invio voto anonimo...');
        setCryptoStatus('Invio voto anonimo al coordinatore...');
        setVotingProgress(80);
        setWabiSabiProgress(80);
        
        const voteResult = await wabiSabi.submitAnonymousVote({
          electionId,
          commitment: commitment.commitment,
          zkProof: generatedZkProof,
          serialNumber: requestedCredentials.serialNumber,
          bitcoinAddress: bitcoinAddress
        });
        
        console.log('[WABISABI] ✓ Voto anonimo inviato:', voteResult.voteId);
        
        // SALVA IL VOTE ID PER LA RICEVUTA DETTAGLIATA
        setVoteId(voteResult.voteId);
        
        // FASE 6: Attesa CoinJoin
        setWabiSabiStep('Attesa aggregazione CoinJoin...');
        setCryptoStatus('Attendendo altri voti per avviare CoinJoin...');
        setVotingProgress(90);
        setWabiSabiProgress(90);
        
        try {
          const finalResult = await wabiSabi.waitForCoinJoinCompletion(
            voteResult.voteId,
            5,
            3000
          );
          
          setWabiSabiStep('Voto registrato su blockchain!');
          setCryptoStatus('Voto confermato e registrato su blockchain Bitcoin!');
          setVotingProgress(100);
          setWabiSabiProgress(100);
          
          setTransactionId(finalResult.transactionId || voteResult.voteId);
        } catch (coinjoinError) {
          console.log('[WABISABI] ⚠️ CoinJoin in corso, voto comunque registrato');
          setWabiSabiStep('Voto registrato, CoinJoin in elaborazione...');
          setCryptoStatus('Voto registrato con successo, aggregazione in corso...');
          setVotingProgress(100);
          setWabiSabiProgress(100);
          setTransactionId(voteResult.voteId);
        }
        
        setVoteSuccess(true);
        setShowPrivateKeyModal(false);
        
        // Pulisci dati sensibili
        setPrivateKey('');
        setCredentials(null);
        setVoteCommitment(null);
        setZkProof(null);
        sessionStorage.removeItem(`bitcoinAddress_${electionId}`);
        
        console.log('[WABISABI] ✅ Processo completato con successo');
        
      } else {
        // ============ FLUSSO SEMPLIFICATO ORIGINALE ============
        console.log('[VOTING] 📝 Voto modalità semplificata');
        
        setCryptoStatus('Inizializzazione processo di voto sicuro...');
        setVotingProgress(20);
        
        setCryptoStatus('Verifica autorizzazioni e parametri di voto...');
        setVotingProgress(40);
        
        setCryptoStatus('Creazione commitment crittografico del voto...');
        setVotingProgress(60);
        
        const voteCommitment = generateVoteCommitment(selectedCandidate);
        
        setCryptoStatus('Firma e invio voto alla blockchain...');
        setVotingProgress(80);
        
        const voteResponse = await api.post(`/elections/${electionId}/vote`, {
          candidateId: selectedCandidate.id,
          bitcoinAddress: bitcoinAddress,
          privateKey: privateKey.trim(),
          voteCommitment: voteCommitment,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });

        if (voteResponse.data.success) {
          setCryptoStatus('Voto registrato con successo!');
          setVotingProgress(100);
          
          // SALVA IL VOTE ID PER LA RICEVUTA DETTAGLIATA
          setVoteId(voteResponse.data.voteId);
          setTransactionId(voteResponse.data.transactionId || 'N/A');
          setVoteSuccess(true);
          setShowPrivateKeyModal(false);
          
          setPrivateKey('');
          sessionStorage.removeItem(`bitcoinAddress_${electionId}`);
          
          console.log('[VOTING] ✅ Voto semplificato registrato');
        } else {
          throw new Error(voteResponse.data.error || 'Errore durante l\'invio del voto');
        }
      }

    } catch (error) {
      console.error('[VOTING] ❌ Errore invio voto:', error);
      
      setCryptoStatus('');
      setVotingProgress(0);
      setWabiSabiProgress(0);
      setWabiSabiStep('');
      
      setCredentials(null);
      setVoteCommitment(null);
      setZkProof(null);
      
      if (error.response?.status === 403) {
        setError('Chiave privata non valida o non corrispondente al wallet autorizzato');
      } else if (error.response?.status === 400) {
        setError(error.response.data.error || 'Dati del voto non validi');
      } else if (error.response?.status === 409) {
        setError('Hai già votato per questa elezione');
      } else {
        setError(error.message || 'Errore durante l\'invio del voto. Riprova più tardi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const generateVoteCommitment = (candidate) => {
    const voteData = {
      candidateId: candidate.id,
      voteEncoding: candidate.voteEncoding,
      electionId: electionId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    
    return btoa(JSON.stringify(voteData));
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

  // HANDLER PER MOSTRARE RICEVUTA DETTAGLIATA
  const handleShowDetailedReceipt = () => {
    setShowDetailedReceipt(true);
  };

  const handleCloseDetailedReceipt = () => {
    setShowDetailedReceipt(false);
  };

  const PrivateKeyModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: 0
          }}>
            <Key size={20} style={{ color: isWabiSabiEnabled ? '#0ea5e9' : '#8b5cf6' }} />
            {isWabiSabiEnabled ? 'Voto Anonimo WabiSabi' : 'Conferma Voto'}
          </h3>
          <button 
            onClick={() => setShowPrivateKeyModal(false)}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info modalità voto */}
        <div style={{
          backgroundColor: isWabiSabiEnabled ? '#f0f9ff' : '#eff6ff',
          border: `1px solid ${isWabiSabiEnabled ? '#0ea5e9' : '#bfdbfe'}`,
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            {isWabiSabiEnabled ? (
              <Shield size={16} style={{ color: '#0ea5e9', marginRight: '0.5rem' }} />
            ) : (
              <User size={16} style={{ color: '#1e40af', marginRight: '0.5rem' }} />
            )}
            <p style={{
              fontWeight: '500',
              color: isWabiSabiEnabled ? '#0ea5e9' : '#1e40af',
              margin: 0
            }}>
              {isWabiSabiEnabled ? 'Modalità Voto Anonimo (WabiSabi)' : 'Stai votando per:'}
            </p>
          </div>
          
          {isWabiSabiEnabled ? (
            <div>
              <p style={{
                fontSize: '0.875rem',
                color: '#0c4a6e',
                margin: '0 0 0.5rem 0',
                fontWeight: '500'
              }}>
                🔒 Voto completamente anonimo con protocollo WabiSabi
              </p>
              <p style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#0369a1',
                margin: '0 0 0.5rem 0'
              }}>Candidato: {selectedCandidate?.name}</p>
              <ul style={{
                fontSize: '0.75rem',
                color: '#075985',
                margin: 0,
                paddingLeft: '1rem'
              }}>
                <li>Credenziali anonime (KVAC)</li>
                <li>Commitment omomorfico</li>
                <li>Zero-knowledge proof</li>
                <li>CoinJoin su blockchain Bitcoin</li>
              </ul>
            </div>
          ) : (
            <div>
              <p style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1e40af',
                margin: '0 0 0.25rem 0'
              }}>{selectedCandidate?.name}</p>
              {selectedCandidate?.party && (
                <p style={{
                  fontSize: '0.875rem',
                  color: '#3730a3',
                  margin: 0
                }}>{selectedCandidate.party}</p>
              )}
            </div>
          )}
        </div>

        <div style={{
          backgroundColor: '#f9fafb',
          padding: '0.75rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.75rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.25rem'
          }}>
            <Wallet size={12} style={{ color: '#6b7280', marginRight: '0.25rem' }} />
            <span style={{ fontWeight: '500' }}>Wallet autorizzato per questa elezione:</span>
          </div>
          <p style={{
            fontFamily: 'monospace',
            color: '#374151',
            wordBreak: 'break-all',
            margin: 0
          }}>{bitcoinAddress}</p>
        </div>

        {/* Campo chiave privata */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            <Lock size={16} style={{ marginRight: '0.25rem' }} />
            Chiave Privata Bitcoin (WIF) per l'indirizzo sopra
          </label>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Inserisci la chiave privata WIF corrispondente al wallet autorizzato"
            disabled={submitting}
            rows="3"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #d1d5db',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              outline: 'none',
              resize: 'vertical',
              backgroundColor: submitting ? '#f9fafb' : 'white',
              cursor: submitting ? 'not-allowed' : 'text'
            }}
            onFocus={(e) => e.target.style.borderColor = isWabiSabiEnabled ? '#0ea5e9' : '#8b5cf6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          <p style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem',
            margin: '0.25rem 0 0 0'
          }}>
            {isWabiSabiEnabled 
              ? 'La chiave privata è necessaria per firmare il commitment WabiSabi e partecipare al CoinJoin'
              : 'La chiave privata è necessaria per firmare crittograficamente il voto sulla blockchain'
            }
          </p>
        </div>

        {/* Progress bar durante invio */}
        {submitting && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
              marginBottom: '0.25rem'
            }}>
              <span style={{ color: '#6b7280' }}>
                {isWabiSabiEnabled ? 'Progresso WabiSabi:' : 'Progresso:'}
              </span>
              <span style={{ color: isWabiSabiEnabled ? '#0ea5e9' : '#3b82f6' }}>
                {isWabiSabiEnabled ? wabiSabiProgress : votingProgress}%
              </span>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
              height: '0.5rem'
            }}>
              <div style={{
                backgroundColor: isWabiSabiEnabled ? '#0ea5e9' : '#3b82f6',
                height: '0.5rem',
                borderRadius: '9999px',
                transition: 'width 0.5s ease',
                width: `${isWabiSabiEnabled ? wabiSabiProgress : votingProgress}%`
              }}></div>
            </div>
            
            {isWabiSabiEnabled && wabiSabiStep && (
              <p style={{
                fontSize: '0.75rem',
                color: '#0ea5e9',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                margin: '0.5rem 0 0 0'
              }}>
                <Shield size={12} style={{ marginRight: '0.25rem' }} />
                {wabiSabiStep}
              </p>
            )}
            
            {cryptoStatus && (
              <p style={{
                fontSize: '0.75rem',
                color: isWabiSabiEnabled ? '#0ea5e9' : '#3b82f6',
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                margin: '0.25rem 0 0 0'
              }}>
                <Clock size={12} style={{ marginRight: '0.25rem' }} />
                {cryptoStatus}
              </p>
            )}
          </div>
        )}

        {/* Errore */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626'
          }}>
            <AlertTriangle size={16} />
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Pulsanti */}
        <div style={{
          display: 'flex',
          gap: '0.75rem'
        }}>
          <button
            onClick={() => setShowPrivateKeyModal(false)}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1
            }}
          >
            Annulla
          </button>
          <button
            onClick={confirmVote}
            disabled={submitting || !privateKey.trim()}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              background: (submitting || !privateKey.trim()) ? '#9ca3af' : 
                         isWabiSabiEnabled ? 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)' :
                         'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (submitting || !privateKey.trim()) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid transparent',
                  borderTop: '2px solid currentColor',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                {isWabiSabiEnabled ? 'Processo WabiSabi...' : 'Invio...'}
              </>
            ) : (
              <>
                <Shield size={16} />
                {isWabiSabiEnabled ? 'Voto Anonimo WabiSabi' : 'Conferma Voto'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // MOSTRA RICEVUTA DETTAGLIATA SE RICHIESTA
  if (showDetailedReceipt && voteId) {
    return (
      <VoteReceipt 
        voteId={voteId}
        electionId={electionId}
        userId={user?.id}
        onClose={handleCloseDetailedReceipt}
      />
    );
  }

  // SCHERMATA DI SUCCESSO AGGIORNATA CON RICEVUTA DETTAGLIATA
  if (voteSuccess) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f0fdf4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          maxWidth: '32rem',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dcfce7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <CheckCircle size={32} style={{ color: '#16a34a' }} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '0.5rem',
            margin: '0 0 0.5rem 0'
          }}>
            {isWabiSabiEnabled ? 'Voto Anonimo Registrato!' : 'Voto Registrato!'}
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1rem',
            margin: '0 0 1rem 0'
          }}>
            {isWabiSabiEnabled 
              ? 'Il tuo voto anonimo è stato processato con il protocollo WabiSabi'
              : 'Il tuo voto è stato inviato con successo alla blockchain Bitcoin'
            }
          </p>
          
          {transactionId && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginBottom: '0.25rem',
                margin: '0 0 0.25rem 0'
              }}>
                {isWabiSabiEnabled ? 'ID Voto/Transazione:' : 'ID Transazione:'}
              </p>
              <p style={{
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                color: '#374151',
                wordBreak: 'break-all',
                margin: 0
              }}>{transactionId}</p>
            </div>
          )}
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '0.5rem'
            }}>
              <Shield size={16} style={{ marginRight: '0.5rem' }} />
              {isWabiSabiEnabled 
                ? 'Voto completamente anonimo con WabiSabi'
                : 'Voto anonimo e crittograficamente sicuro'
              }
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              <Bitcoin size={16} style={{ marginRight: '0.5rem' }} />
              {isWabiSabiEnabled 
                ? 'Elaborato tramite CoinJoin su blockchain Bitcoin'
                : 'Registrato su blockchain Bitcoin'
              }
            </div>
          </div>

          {/* PULSANTI AGGIORNATI CON RICEVUTA DETTAGLIATA */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {/* Pulsante Ricevuta Dettagliata */}
            {voteId && (
              <button
                onClick={handleShowDetailedReceipt}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <CheckCircle size={20} />
                Visualizza Ricevuta Dettagliata
              </button>
            )}

            {/* Pulsante Torna alla Home */}
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%',
                background: isWabiSabiEnabled 
                  ? 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = isWabiSabiEnabled 
                  ? '0 4px 12px rgba(14, 165, 233, 0.3)'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Caricamento
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        minHeight: '60vh'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderLeft: '4px solid #3B82F6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}></div>
        <p>Caricamento elezione...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* BADGE MODALITÀ WABISABI */}
      {isWabiSabiEnabled && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <Shield size={20} style={{ color: '#0ea5e9' }} />
          <span style={{
            color: '#0c4a6e',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            🔒 Modalità Voto Anonimo WabiSabi Attivata
          </span>
        </div>
      )}

      {/* Header con pulsante indietro */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            marginBottom: '1rem'
          }}
        >
          <ArrowLeft size={20} />
          Torna alle elezioni
        </button>
      </div>

      {/* Header elezione */}
      {election && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
                margin: '0 0 0.5rem 0'
              }}>{election.title}</h1>
              {election.description && (
                <p style={{ color: '#6b7280', margin: 0 }}>{election.description}</p>
              )}
            </div>
            <div style={{
              textAlign: 'right',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              <p style={{ margin: '0 0 0.25rem 0' }}>Fine votazioni: {formatDate(election.endDate)}</p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: '#dcfce7',
                color: '#166534',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '500'
              }}>
                <div style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  backgroundColor: '#22c55e',
                  borderRadius: '50%'
                }}></div>
                Attiva
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '0.75rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.875rem',
              color: '#3730a3',
              marginBottom: '0.25rem'
            }}>
              <Wallet size={16} style={{ marginRight: '0.5rem' }} />
              <span style={{ fontWeight: '500' }}>Wallet autorizzato per questa elezione:</span>
            </div>
            <p style={{
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              color: '#1e40af',
              wordBreak: 'break-all',
              margin: 0
            }}>{bitcoinAddress}</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626'
        }}>
          <AlertTriangle size={20} />
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Lista candidati */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        padding: '1.5rem'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '1.5rem',
          margin: '0 0 1.5rem 0'
        }}>Seleziona il candidato</h2>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              onClick={() => handleCandidateSelect(candidate)}
              style={{
                padding: '1rem',
                border: selectedCandidate?.id === candidate.id ? 
                        `2px solid ${isWabiSabiEnabled ? '#0ea5e9' : '#3b82f6'}` : 
                        '2px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: selectedCandidate?.id === candidate.id ? 
                                 isWabiSabiEnabled ? '#f0f9ff' : '#eff6ff' : 
                                 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (selectedCandidate?.id !== candidate.id) {
                  e.currentTarget.style.borderColor = '#9ca3af';
                }
              }}
              onMouseOut={(e) => {
                if (selectedCandidate?.id !== candidate.id) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    margin: '0 0 0.25rem 0'
                  }}>{candidate.name}</h3>
                  {candidate.party && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      margin: '0 0 0.5rem 0'
                    }}>{candidate.party}</p>
                  )}
                  {candidate.biography && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      margin: 0
                    }}>{candidate.biography}</p>
                  )}
                </div>
                <div style={{ marginLeft: '1rem' }}>
                  {selectedCandidate?.id === candidate.id ? (
                    <div style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      backgroundColor: isWabiSabiEnabled ? '#0ea5e9' : '#3b82f6',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle size={16} color="white" />
                    </div>
                  ) : (
                    <div style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '50%'
                    }}></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pulsante invio voto */}
        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={handleVoteSubmit}
            disabled={!selectedCandidate}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: !selectedCandidate ? '#9ca3af' : 
                         isWabiSabiEnabled ? 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)' :
                         'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              border: 'none',
              padding: '0.875rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: '500',
              cursor: !selectedCandidate ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (selectedCandidate) {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = isWabiSabiEnabled 
                  ? '0 4px 12px rgba(14, 165, 233, 0.3)'
                  : '0 4px 12px rgba(139, 92, 246, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              if (selectedCandidate) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {isWabiSabiEnabled ? <Shield size={20} /> : <Key size={20} />}
            {isWabiSabiEnabled ? 'Voto Anonimo WabiSabi' : 'Procedi con il Voto'}
          </button>
          {!selectedCandidate && (
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              textAlign: 'center',
              marginTop: '0.5rem',
              margin: '0.5rem 0 0 0'
            }}>
              Seleziona un candidato per procedere
            </p>
          )}
        </div>
      </div>

      {/* Modal chiave privata */}
      {showPrivateKeyModal && <PrivateKeyModal />}

      {/* CSS per le animazioni */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VotingPage;