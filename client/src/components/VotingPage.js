import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVoting } from '../contexts/VotingContext';
import { 
  Vote, 
  Shield, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  ArrowLeft,
  Lock,
  Bitcoin,
  Users,
  User,
  FileText  // Aggiunto per il pulsante ricevuta futuro
} from 'lucide-react';
import WabiSabiVoting from '../services/WabiSabiVoting';
import api from '../services/api';
import VoteReceipt from './VoteReceipt';

const VotingPage = () => {
  const { electionId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { voting, setVoting } = useVoting();
  const navigate = useNavigate();

  // State management esistenti
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [currentStep, setCurrentStep] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingProgress, setVotingProgress] = useState(0);
  const [cryptoStatus, setCryptoStatus] = useState('');
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [credential, setCredential] = useState(null);

  // NUOVI STATI PER TRACCIARE DATI RICEVUTA
  const [voteId, setVoteId] = useState(null);
  const [transactionId, setTransactionId] = useState(null);
  const [voteSubmittedAt, setVoteSubmittedAt] = useState(null);
  
  // *** STATI MANCANTI PER LA RICEVUTA ***
  const [showReceipt, setShowReceipt] = useState(false);

  const wabiSabiVoting = new WabiSabiVoting();

  // Verifica autenticazione - CODICE ESISTENTE
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[VOTING] Utente non autenticato, reindirizzando al login...');
      navigate('/login');
      return;
    }
    
    loadElectionData();
  }, [electionId, isAuthenticated, user]);

  // LOADECTION DATA - CORRETTO: singola chiamata API con candidati inclusi
  const loadElectionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('[VOTING] Caricamento dati elezione:', electionId);
      console.log('[VOTING] Utente autenticato:', user.email);
      
      // Inizializza il servizio WabiSabi
      try {
        wabiSabiVoting.initialize();
        console.log('[VOTING] ✓ Servizio WabiSabi inizializzato');
      } catch (wabiError) {
        console.error('[VOTING] ❌ Errore inizializzazione WabiSabi:', wabiError.message);
        setError('Errore di autenticazione. Effettua nuovamente il login.');
        navigate('/login');
        return;
      }
      
      // CORREZIONE: singola chiamata API per elezione (include candidati)
      const electionResponse = await api.get(`/elections/${electionId}`);
      
      // L'elezione dovrebbe includere i candidati nella risposta
      const electionData = electionResponse.data.election || electionResponse.data;
      
      setElection(electionData);
      setCandidates(electionData.candidates || []);
      setCurrentStep('selection');
      
      console.log('[VOTING] ✓ Elezione caricata:', electionData.title);
      console.log('[VOTING] ✓ Candidati trovati:', electionData.candidates?.length || 0);
      
    } catch (error) {
      console.error('[VOTING] ❌ Errore caricamento elezione:', error);
      
      // Gestione errori specifica
      if (error.response?.status === 404) {
        setError('Elezione non trovata o non accessibile');
      } else if (error.response?.status === 403) {
        setError('Non sei autorizzato a votare in questa elezione');
      } else {
        setError(error.response?.data?.error || 'Errore nel caricamento dell\'elezione');
      }
    } finally {
      setLoading(false);
    }
  };

  // HANDLE CANDIDATE SELECT - MANTIENI CODICE ESISTENTE  
  const handleCandidateSelect = (candidate) => {
    console.log('[VOTING] Candidato selezionato:', candidate.name || `${candidate.firstName} ${candidate.lastName}`);
    setSelectedCandidate(candidate);
    setError('');
  };

  // START VOTING PROCESS - MODIFICATO PER TRACCIARE DATI RICEVUTA
  const startVotingProcess = async () => {
    if (!selectedCandidate) {
      setError('Seleziona un candidato prima di procedere');
      return;
    }

    try {
      setError('');
      setCurrentStep('crypto');
      setVotingProgress(10);
      setVoteSubmittedAt(new Date()); // TRACCIA TIMESTAMP INVIO

      console.log('[VOTING] 🗳️ Avvio processo di voto per candidato:', selectedCandidate.name);

      // Step 1: Generate Bitcoin address
      setCryptoStatus('Generazione indirizzo Bitcoin sicuro...');
      setVotingProgress(15);
      
      const addressData = await wabiSabiVoting.generateBitcoinAddress();
      setBitcoinAddress(addressData.address);
      console.log('[VOTING] ✓ Indirizzo Bitcoin generato:', addressData.address);

      // *** STEP 1.5: NUOVO - Registra indirizzo e crea sessione ***
      setCryptoStatus('Registrazione indirizzo e creazione sessione di voto...');
      setVotingProgress(25);
      
      const registrationResult = await wabiSabiVoting.registerBitcoinAddress(electionId, addressData);
      console.log('[VOTING] ✅ Sessione di voto creata:', registrationResult.sessionId);

      // Step 2: Request KVAC credentials
      setCryptoStatus('Richiesta credenziali anonime KVAC...');
      setVotingProgress(40);
      
      const credentialData = await wabiSabiVoting.requestCredentials(electionId);
      setCredential(credentialData);
      console.log('[VOTING] ✓ Credenziali KVAC ricevute');

      // Step 3: Create vote commitment
      setCryptoStatus('Creazione commitment crittografico del voto...');
      setVotingProgress(60);
      
      const voteCommitment = await wabiSabiVoting.createVoteCommitment(
        selectedCandidate.id,
        credentialData.serialNumber,
        addressData.privateKey
      );
      console.log('[VOTING] ✓ Commitment voto creato');

      // Step 4: Generate zero-knowledge proof
      setCryptoStatus('Generazione prova zero-knowledge per privacy...');
      setVotingProgress(75);
      
      const zkProof = await wabiSabiVoting.generateZKProof(
        voteCommitment,
        credentialData,
        selectedCandidate.voteEncoding || selectedCandidate.id
      );
      console.log('[VOTING] ✓ Prova zero-knowledge generata');

      // Step 5: Submit anonymous vote (ora la sessione esiste!)
      setCryptoStatus('Invio voto anonimo al sistema...');
      setVotingProgress(90);
      setCurrentStep('voting');

      const voteSubmissionResult = await wabiSabiVoting.submitAnonymousVote({
        electionId,
        commitment: voteCommitment.commitment,
        zkProof,
        serialNumber: credentialData.serialNumber,
        bitcoinAddress: addressData.address
      });
      
      // Salva il VOTE ID per la ricevuta
      const submittedVoteId = voteSubmissionResult.voteId;
      setVoteId(submittedVoteId);
      
      console.log('[VOTING] Voto anonimo inviato, Vote ID:', submittedVoteId);
      
      // Aggiorna il contesto voting
      setVoting(prev => ({
        ...prev,
        currentElection: election,
        selectedCandidate,
        bitcoinAddress: addressData.address,
        credential: credentialData,
        voteCommitment: voteCommitment.commitment,
        transactionId: null, // Sarà aggiornato dopo il CoinJoin
        step: 'voting',
        progress: 90
      }));

      // Step 6: Wait for CoinJoin completion
      setCryptoStatus('Attesa aggregazione CoinJoin e registrazione blockchain...');
      setVotingProgress(95);

      const completionResult = await wabiSabiVoting.waitForCoinJoinCompletion(submittedVoteId);
      console.log('[VOTING] ✓ Processo completato:', completionResult);

      if (completionResult.transactionId) {
        setTransactionId(completionResult.transactionId);
        
        // Aggiorna il contesto voting con transaction ID
        setVoting(prev => ({
          ...prev,
          transactionId: completionResult.transactionId,
          step: 'complete',
          progress: 100
        }));
      }

      // Complete
      setCurrentStep('complete');
      setCryptoStatus('Voto registrato con successo sulla blockchain Bitcoin!');
      setVotingProgress(100);

    } catch (err) {
      console.error('[VOTING] ❌ Errore processo di voto:', err.message);
      
      let errorMessage = 'Errore durante il processo di voto';
      
      if (err.message.includes('non autorizzato')) {
        errorMessage = 'Non sei autorizzato a votare in questa elezione';
      } else if (err.message.includes('già votato')) {
        errorMessage = 'Hai già espresso il tuo voto';
      } else if (err.message.includes('token')) {
        errorMessage = 'Sessione scaduta. Effettua nuovamente il login.';
        setTimeout(() => navigate('/login'), 2000);
      } else {
        errorMessage = `Errore: ${err.message}`;
      }
      
      setError(errorMessage);
      setCurrentStep('selection');
      setVotingProgress(0);
      setCryptoStatus('');
    }
  };

  // FUNZIONE PER MOSTRARE RICEVUTA COMPLETA
  const showVoteReceipt = () => {
    if (voteId) {
      setShowReceipt(true);
    } else {
      setError('Impossibile generare la ricevuta: ID voto non disponibile');
    }
  };

  // FUNZIONE PLACEHOLDER PER DEBUG (da rimuovere quando VoteReceipt è pronto)
  const showReceiptData = () => {
    if (voteId && transactionId) {
      // Mostra dati debug - sarà sostituito dal componente VoteReceipt
      alert(`Dati Ricevuta:
        Vote ID: ${voteId}
        Transaction ID: ${transactionId}
        Submitted: ${voteSubmittedAt?.toLocaleString('it-IT')}
        Election: ${election?.title}
      `);
    } else {
      alert('Dati ricevuta non ancora disponibili. Voto ID: ' + (voteId || 'N/A') + ', Transaction ID: ' + (transactionId || 'N/A'));
    }
  };

  // NAVIGATION METHODS - MANTIENI ESISTENTI
  const goBackToElections = () => {
    navigate('/elections');
  };

  const viewResults = () => {
    navigate('/results');
  };

  // LOADING E ERROR HANDLING - MANTIENI ESISTENTI
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Caricamento elezione...</p>
      </div>
    );
  }

  if (error && !election) {
    return (
      <div className="error-container">
        <AlertCircle size={48} />
        <h3>Errore</h3>
        <p>{error}</p>
        <button onClick={goBackToElections} className="button secondary">
          <ArrowLeft size={20} />
          Torna alle Elezioni
        </button>
      </div>
    );
  }

  return (
    <div className="voting-page">
      {/* HEADER - MANTIENI ESISTENTE */}
      <div className="voting-header">
        <button onClick={goBackToElections} className="back-button">
          <ArrowLeft size={20} />
          Indietro
        </button>
        <div className="election-info">
          <h2>{election?.title}</h2>
          <p>{election?.description}</p>
          
          <div className="user-info-badge">
            <User size={16} />
            <span>Autenticato come: {user?.firstName} {user?.lastName} ({user?.email})</span>
          </div>
        </div>
      </div>

      {/* STEP INDICATOR - MANTIENI ESISTENTE */}
      <div className="step-indicator">
        <div className={`step ${currentStep === 'selection' || currentStep === 'crypto' || currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Selezione Candidato</div>
        </div>
        <div className={`step ${currentStep === 'crypto' || currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Crittografia WabiSabi</div>
        </div>
        <div className={`step ${currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Invio Voto</div>
        </div>
        <div className={`step ${currentStep === 'complete' ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Completato</div>
        </div>
      </div>

      {/* ERROR ALERT - MANTIENI ESISTENTE */}
      {error && !transactionId && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* STEP 1: CANDIDATE SELECTION - MANTIENI ESISTENTE */}
      {currentStep === 'selection' && (
        <div className="voting-step">
          <div className="step-header">
            <Vote size={32} />
            <h3>Seleziona il tuo candidato</h3>
            <p>Scegli il candidato per cui vuoi esprimere il tuo voto anonimo</p>
          </div>

          <div className="candidates-grid">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                onClick={() => handleCandidateSelect(candidate)}
              >
                <div className="candidate-info">
                  <h4>{candidate.name || `${candidate.firstName} ${candidate.lastName}`}</h4>
                  {candidate.party && <p className="candidate-party">{candidate.party}</p>}
                </div>
                <div className="candidate-select">
                  {selectedCandidate?.id === candidate.id ? (
                    <CheckCircle size={24} />
                  ) : (
                    <div className="select-circle"></div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="voting-actions">
            <button 
              onClick={startVotingProcess}
              className="button primary large"
              disabled={!selectedCandidate}
            >
              <Shield size={20} />
              Procedi con Voto Anonimo
            </button>
          </div>
        </div>
      )}

      {/* STEP 2-3: CRYPTO E VOTING - MANTIENI ESISTENTE */}
      {(currentStep === 'crypto' || currentStep === 'voting') && (
        <div className="voting-step">
          <div className="step-header">
            <Key size={32} />
            <h3>Processo Crittografico WabiSabi</h3>
            <p>Il tuo voto viene processato in modo anonimo e sicuro</p>
          </div>

          <div className="crypto-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${votingProgress}%` }}
              ></div>
            </div>
            <div className="progress-text">{votingProgress}%</div>
          </div>

          <div className="crypto-status">
            <Loader size={24} className="spinner" />
            <p>{cryptoStatus}</p>
          </div>

          {bitcoinAddress && (
            <div className="crypto-details">
              <div className="detail-item">
                <Bitcoin size={20} />
                <span>Indirizzo Bitcoin Generato: {bitcoinAddress.substring(0, 20)}...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: COMPLETE - MODIFICATO CON PULSANTE RICEVUTA */}
      {currentStep === 'complete' && (
        <div className="voting-step">
          <div className="step-header success">
            <CheckCircle size={48} />
            <h3>Voto Registrato con Successo!</h3>
            <p>Il tuo voto anonimo è stato registrato in modo sicuro sulla blockchain</p>
          </div>

          {/* MOSTRA TRANSACTION ID SE DISPONIBILE */}
          {transactionId && (
            <div className="completion-details">
              <div className="info-card detail-card">
                <Bitcoin size={24} />
                <div>
                  <h4>Transaction ID Blockchain</h4>
                  <p className="transaction-id">{transactionId}</p>
                  <p className="text-sm text-gray-600">
                    <b>Questo ID identifica la sessione di voto aggregata sulla Blockchain</b>
                  </p>
                  <br></br>
                  <p>
                    Vote ID: {voteId}<br></br>
                    Inviato in data: {voteSubmittedAt?.toLocaleString('it-IT')}<br></br>
                    Elezione: {election?.title}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="completion-details">
            <div className="detail-card">
              <Shield size={32} />
              <h4>Anonimato Garantito</h4>
              <p>Il tuo voto è stato mixato con altri voti attraverso il protocollo WabiSabi, rendendo impossibile risalire alla tua identità.</p>
            </div>

            <div className="detail-card">
              <Bitcoin size={32} />
              <h4>Registrato su Blockchain</h4>
              <p>Il voto è stato permanentemente registrato sulla blockchain Bitcoin, garantendo immutabilità e verificabilità.</p>
            </div>

            <div className="detail-card">
              <Lock size={32} />
              <h4>Processo Sicuro</h4>
              <p>Sono state utilizzate credenziali crittografiche avanzate e prove zero-knowledge per proteggere la tua privacy.</p>
            </div>
          </div>

          {/* AZIONI CON PULSANTE RICEVUTA PLACEHOLDER */}
          <div className="completion-actions">
            {/* PULSANTE RICEVUTA - PLACEHOLDER PER ORA */}
            {voteId && (
              <button onClick={showReceiptData} className="button primary">
                <FileText size={20} />
                Mostra Dati Ricevuta
              </button>
            )}

            <button onClick={viewResults} className="button primary">
              <Vote size={20} />
              Visualizza Risultati
            </button>
            
            <button onClick={goBackToElections} className="button secondary">
              <ArrowLeft size={20} />
              Torna alle Elezioni
            </button>
          </div>
        </div>
      )}
      {showReceipt && voteId && (
        <VoteReceipt
          voteId={voteId}
          electionId={electionId}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};

export default VotingPage;