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
  Users
} from 'lucide-react';
import WabiSabiVoting from '../services/WabiSabiVoting';
import api from '../services/api';

const VotingPage = () => {
  const { electionId } = useParams();
  const { user } = useAuth();
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

  useEffect(() => {
    loadElectionData();
  }, [electionId]);

  const loadElectionData = async () => {
    try {
        setLoading(true);
        
        const electionResponse = await api.get(`/elections/${electionId}`);

        setElection(electionResponse.data.election);
        setCandidates(electionResponse.data.election.candidates || []);
        
        // Controlla se l'utente ha gia votato
        if (electionResponse.data.election.hasVoted) {
            setError('Hai già votato in questa elezione');
            setTimeout(() => navigate('/elections'), 3000);
            return;
        }
        
        setCurrentStep('selection');
    } catch (err) {
      console.error('Error loading election:', err);
      setError('Errore nel caricamento dell\'elezione');
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    setError('');
  };

  const startVotingProcess = async () => {
    if (!selectedCandidate) {
      setError('Seleziona un candidato prima di procedere');
      return;
    }

    setCurrentStep('crypto');
    setCryptoStatus('Inizializzazione processo crittografico...');
    setVotingProgress(0);

    try {
      // Step 1: Generate Bitcoin address for this voting session
      setCryptoStatus('Generazione indirizzo Bitcoin...');
      setVotingProgress(20);
      
      const addressData = await wabiSabiVoting.generateVotingAddress(user.id, electionId);
      setBitcoinAddress(addressData.address);

      // Step 2: Request KVAC credentials
      setCryptoStatus('Richiesta credenziali anonime KVAC...');
      setVotingProgress(40);
      
      const credentialData = await wabiSabiVoting.requestCredentials(user.id, electionId);
      setCredential(credentialData);

      // Step 3: Create vote commitment
      setCryptoStatus('Creazione commitment crittografico...');
      setVotingProgress(60);
      
      const voteCommitment = await wabiSabiVoting.createVoteCommitment(
        selectedCandidate.id,
        credentialData.serialNumber,
        addressData.privateKey
      );

      // Step 4: Generate zero-knowledge proof
      setCryptoStatus('Generazione prova zero-knowledge...');
      setVotingProgress(80);
      
      const zkProof = await wabiSabiVoting.generateZKProof(
        voteCommitment,
        credentialData,
        selectedCandidate.valueEncoding
      );

      // Step 5: Submit anonymous vote
      setCryptoStatus('Invio voto anonimo...');
      setVotingProgress(90);
      setCurrentStep('voting');

      const voteSubmissionResult = await wabiSabiVoting.submitAnonymousVote({
        electionId,
        commitment: voteCommitment.commitment,
        zkProof,
        serialNumber: credentialData.serialNumber,
        bitcoinAddress: addressData.address
      });

      // Step 6: Wait for CoinJoin completion
      setCryptoStatus('Attesa aggregazione CoinJoin...');
      setVotingProgress(100);

      await wabiSabiVoting.waitForCoinJoinCompletion(voteSubmissionResult.voteId);

      // Complete
      setCurrentStep('complete');
      setCryptoStatus('Voto registrato con successo sulla blockchain!');

    } catch (err) {
      console.error('Voting process error:', err);
      setError(`Errore durante il processo di voto: ${err.message}`);
      setCurrentStep('selection');
      setVotingProgress(0);
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
        </div>
      </div>

      {/* Step Indicator */}
      <div className="step-indicator">
        <div className={`step ${currentStep === 'selection' || currentStep === 'crypto' || currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <Users size={24} />
          <span>Selezione</span>
        </div>
        <div className={`step ${currentStep === 'crypto' || currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <Shield size={24} />
          <span>Crittografia</span>
        </div>
        <div className={`step ${currentStep === 'voting' || currentStep === 'complete' ? 'active' : ''}`}>
          <Vote size={24} />
          <span>Voto</span>
        </div>
        <div className={`step ${currentStep === 'complete' ? 'active' : ''}`}>
          <CheckCircle size={24} />
          <span>Completato</span>
        </div>
      </div>

      {/* Candidate Selection Step */}
      {currentStep === 'selection' && (
        <div className="voting-step">
          <div className="step-header">
            <h3>Seleziona il Candidato</h3>
            <p>Scegli il candidato per il quale vuoi esprimere il tuo voto anonimo</p>
          </div>

          <div className="candidates-grid">
            {candidates.map((candidate) => (
              <div 
                key={candidate.id} 
                className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                onClick={() => handleCandidateSelect(candidate)}
              >
                <div className="candidate-info">
                  <h4>{candidate.firstName} {candidate.lastName}</h4>
                  {candidate.party && <p className="party">{candidate.party}</p>}
                  {candidate.biography && <p className="biography">{candidate.biography}</p>}
                </div>
                {selectedCandidate?.id === candidate.id && (
                  <div className="selected-indicator">
                    <CheckCircle size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <div className="step-actions">
            <button 
              onClick={startVotingProcess}
              disabled={!selectedCandidate}
              className="button primary large"
            >
              <Shield size={20} />
              Procedi con Voto Anonimo
            </button>
          </div>

          <div className="privacy-notice">
            <Lock size={16} />
            <p>
              Il tuo voto sarà completamente anonimo grazie al protocollo WabiSabi. 
              Nessuno potrà collegare il tuo voto alla tua identità.
            </p>
          </div>
        </div>
      )}

      {/* Cryptographic Process Step */}
      {(currentStep === 'crypto' || currentStep === 'voting') && (
        <div className="voting-step">
          <div className="step-header">
            <h3>Processo Crittografico WabiSabi</h3>
            <p>Stiamo rendendo il tuo voto completamente anonimo...</p>
          </div>

          <div className="crypto-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${votingProgress}%` }}
              ></div>
            </div>
            <p className="progress-text">{votingProgress}%</p>
          </div>

          <div className="crypto-status">
            <Loader size={20} className="spinning" />
            <span>{cryptoStatus}</span>
          </div>

          {bitcoinAddress && (
            <div className="bitcoin-info">
              <div className="info-item">
                <Bitcoin size={16} />
                <span>Indirizzo Bitcoin generato:</span>
              </div>
              <code className="bitcoin-address">{bitcoinAddress}</code>
            </div>
          )}

          {credential && (
            <div className="credential-info">
              <div className="info-item">
                <Key size={16} />
                <span>Credenziale KVAC ricevuta</span>
              </div>
              <code className="serial-number">Serial: {credential.serialNumber.substring(0, 16)}...</code>
            </div>
          )}

          <div className="crypto-explanation">
            <h4>Cosa sta succedendo:</h4>
            <ul>
              <li>✅ Generazione di un indirizzo Bitcoin unico per questa votazione</li>
              <li>✅ Richiesta di credenziali anonime KVAC</li>
              <li>✅ Creazione di un commitment crittografico del voto</li>
              <li>✅ Generazione di prove zero-knowledge</li>
              <li>🔄 Invio del voto anonimo al coordinatore</li>
              <li>⏳ Attesa dell'aggregazione CoinJoin</li>
            </ul>
          </div>
        </div>
      )}

      {/* Completion Step */}
      {currentStep === 'complete' && (
        <div className="voting-step">
          <div className="completion-header">
            <CheckCircle size={64} className="success-icon" />
            <h3>Voto Registrato con Successo!</h3>
            <p>Il tuo voto anonimo è stato registrato sulla blockchain Bitcoin</p>
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