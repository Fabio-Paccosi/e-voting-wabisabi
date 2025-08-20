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
  User
} from 'lucide-react';
import WabiSabiVoting from '../services/WabiSabiVoting';
import api from '../services/api';

const VotingPage = () => {
  const { electionId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { voting, setVoting } = useVoting();
  const navigate = useNavigate();

  // State management
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [currentStep, setCurrentStep] = useState('loading'); // loading, selection, crypto, voting, complete
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [votingProgress, setVotingProgress] = useState(0);
  const [cryptoStatus, setCryptoStatus] = useState('');
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [credential, setCredential] = useState(null);

  const wabiSabiVoting = new WabiSabiVoting();

  // Verifica autenticazione
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('[VOTING] Utente non autenticato, reindirizzando al login...');
      navigate('/login');
      return;
    }
    
    loadElectionData();
  }, [electionId, isAuthenticated, user]);

  const loadElectionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('[VOTING] Caricamento dati elezione:', electionId);
      console.log('[VOTING] Utente autenticato:', user.email);
      
      // Inizializza il servizio WabiSabi con i dati utente autenticato
      try {
        wabiSabiVoting.initialize();
        console.log('[VOTING]  Servizio WabiSabi inizializzato');
      } catch (wabiError) {
        console.error('[VOTING]  Errore inizializzazione WabiSabi:', wabiError.message);
        setError('Errore di autenticazione. Effettua nuovamente il login.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      // Verifica eligibilità per questa elezione
      try {
        await wabiSabiVoting.validateVotingEligibility(electionId);
        console.log('[VOTING]  Eligibilità confermata');
      } catch (eligibilityError) {
        console.error('[VOTING]  Verifica eligibilità fallita:', eligibilityError.message);
        setError(eligibilityError.message);
        return;
      }
      
      // Carica dati elezione
      const electionResponse = await api.get(`/elections/${electionId}`);
      
      if (!electionResponse.data.success) {
        throw new Error(electionResponse.data.error || 'Errore caricamento elezione');
      }

      setElection(electionResponse.data.election);
      setCandidates(electionResponse.data.election.candidates || []);
      
      // Controlla se l'utente ha già votato
      if (electionResponse.data.election.hasVoted || electionResponse.data.hasVoted) {
        setError('Hai già votato in questa elezione');
        setTimeout(() => navigate('/elections'), 3000);
        return;
      }
      
      console.log('[VOTING]  Dati elezione caricati con successo');
      setCurrentStep('selection');
      
    } catch (err) {
      console.error('[VOTING]  Errore caricamento elezione:', err.message);
      
      if (err.status === 401) {
        setError('Sessione scaduta. Effettua nuovamente il login.');
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.status === 403) {
        setError('Non sei autorizzato a votare in questa elezione.');
      } else if (err.status === 404) {
        setError('Elezione non trovata.');
      } else {
        setError(err.message || 'Errore nel caricamento dell\'elezione');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    setError('');
    console.log('[VOTING] 🎯 Candidato selezionato:', candidate.name);
  };

  const startVotingProcess = async () => {
    if (!selectedCandidate) {
      setError('Seleziona un candidato prima di procedere');
      return;
    }

    console.log('[VOTING] Avvio processo di voto WabiSabi...');
    setCurrentStep('crypto');
    setCryptoStatus('Inizializzazione processo crittografico...');
    setVotingProgress(0);

    try {
      // Step 1: Generate Bitcoin address for this voting session
      setCryptoStatus('Generazione indirizzo Bitcoin per sessione anonima...');
      setVotingProgress(15);
      
      const addressData = await wabiSabiVoting.generateVotingAddress(electionId);
      setBitcoinAddress(addressData.address);
      console.log('[VOTING]  Indirizzo Bitcoin generato:', addressData.address);

      // Step 2: Request KVAC credentials
      setCryptoStatus('Richiesta credenziali anonime KVAC...');
      setVotingProgress(35);
      
      const credentialData = await wabiSabiVoting.requestCredentials(electionId);
      setCredential(credentialData);
      console.log('[VOTING]  Credenziali KVAC ricevute');

      // Step 3: Create vote commitment
      setCryptoStatus('Creazione commitment crittografico del voto...');
      setVotingProgress(55);
      
      const voteCommitment = await wabiSabiVoting.createVoteCommitment(
        selectedCandidate.id,
        credentialData.serialNumber,
        addressData.privateKey
      );
      console.log('[VOTING]  Commitment voto creato');

      // Step 4: Generate zero-knowledge proof
      setCryptoStatus('Generazione prova zero-knowledge per privacy...');
      setVotingProgress(75);
      
      const zkProof = await wabiSabiVoting.generateZKProof(
        voteCommitment,
        credentialData,
        selectedCandidate.voteEncoding || selectedCandidate.id
      );
      console.log('[VOTING]  Prova zero-knowledge generata');

      // Step 5: Submit anonymous vote
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
      console.log('[VOTING]  Voto anonimo inviato');

      // Step 6: Wait for CoinJoin completion
      setCryptoStatus('Attesa aggregazione CoinJoin e registrazione blockchain...');
      setVotingProgress(95);

      await wabiSabiVoting.waitForCoinJoinCompletion(voteSubmissionResult.voteId);
      console.log('[VOTING]  Processo completato');

      // Complete
      setCurrentStep('complete');
      setCryptoStatus('Voto registrato con successo sulla blockchain Bitcoin!');
      setVotingProgress(100);

    } catch (err) {
      console.error('[VOTING]  Errore processo di voto:', err.message);
      
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

  const goBackToElections = () => {
    navigate('/elections');
  };

  const viewResults = () => {
    navigate('/results');
  };

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
      <div className="voting-header">
        <button onClick={goBackToElections} className="back-button">
          <ArrowLeft size={20} />
          Indietro
        </button>
        <div className="election-info">
          <h2>{election?.title}</h2>
          <p>{election?.description}</p>
          
          {/* Info utente autenticato */}
          <div className="user-info-badge">
            <User size={16} />
            <span>Autenticato come: {user?.firstName} {user?.lastName} ({user?.email})</span>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
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

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Step 1: Candidate Selection */}
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

      {/* Step 2: Cryptographic Process */}
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

      {/* Step 3: Vote Complete */}
      {currentStep === 'complete' && (
        <div className="voting-step">
          <div className="step-header success">
            <CheckCircle size={48} />
            <h3>Voto Registrato con Successo!</h3>
            <p>Il tuo voto anonimo è stato registrato in modo sicuro sulla blockchain</p>
          </div>

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

          <div className="completion-actions">
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
    </div>
  );
};

export default VotingPage;