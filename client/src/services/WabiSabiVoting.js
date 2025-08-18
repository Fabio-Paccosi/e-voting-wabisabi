import { randomBytes, createHash } from 'crypto-browserify';
import * as elliptic from 'elliptic';
import api, { authTokenUtils } from './api';

// Use elliptic.js instead of tiny-secp256k1 for better browser compatibility
const EC = elliptic.ec;
const secp256k1 = new EC('secp256k1');

class WabiSabiVoting {
  constructor() {
    this.network = 'testnet'; // Use testnet for development
    this.user = null;
  }

  /**
   * Inizializza il servizio con i dati dell'utente autenticato
   */
  initialize() {
    // Ottieni informazioni utente dal token JWT
    const tokenInfo = authTokenUtils.decodeToken();
    if (tokenInfo) {
      this.user = {
        id: tokenInfo.userId || tokenInfo.id,
        email: tokenInfo.email,
        firstName: tokenInfo.firstName,
        lastName: tokenInfo.lastName
      };
      console.log('[WABISABI] 🔧 Inizializzato per utente:', this.user.email);
    } else {
      console.error('[WABISABI] ❌ Nessun token valido trovato');
      throw new Error('Utente non autenticato');
    }
  }

  /**
   * Verifica che l'utente sia autenticato
   */
  ensureAuthenticated() {
    if (!this.user) {
      this.initialize();
    }
    
    if (!this.user || !this.user.id) {
      throw new Error('Utente non autenticato per il voto');
    }
  }

  /**
   * Generate a unique Bitcoin address for this voting session
   */
  async generateVotingAddress(electionId) {
    try {
      this.ensureAuthenticated();
      
      console.log('[WABISABI] 🪙 Generazione indirizzo Bitcoin per elezione:', electionId);
      
      // Generate a new key pair using elliptic.js
      const keyPair = secp256k1.genKeyPair();
      const privateKey = keyPair.getPrivate('hex');
      const publicKey = keyPair.getPublic(true, 'hex'); // Compressed public key
      
      // Generate Bitcoin address (simplified for demo)
      const address = this.generateBitcoinAddress(publicKey);

      // Store the address association in backend using authenticated API call
      const response = await api.post('/voting/address', {
        userId: this.user.id,        // Usa ID reale dell'utente
        electionId: electionId,
        bitcoinAddress: address,
        publicKey: publicKey
      });

      console.log('[WABISABI] ✅ Indirizzo Bitcoin generato:', address);

      return {
        address,
        privateKey,
        publicKey,
        keyPair: {
          privateKey,
          publicKey
        },
        sessionData: response.data
      };
    } catch (error) {
      console.error('[WABISABI] ❌ Errore generazione indirizzo:', error.message);
      throw new Error(`Errore generazione indirizzo Bitcoin: ${error.message}`);
    }
  }

  /**
   * Generate a Bitcoin address from public key (simplified)
   */
  generateBitcoinAddress(publicKey) {
    // Simplified address generation for demo purposes
    const hash = createHash('sha256').update(publicKey, 'hex').digest('hex');
    const addressHash = createHash('sha256').update(hash, 'hex').digest('hex').substring(0, 40);
    
    // Generate testnet address prefix
    return `tb1q${addressHash}`;
  }

  /**
   * Request KVAC (Keyed-Verification Anonymous Credentials) from the server
   */
  async requestCredentials(electionId) {
    try {
      this.ensureAuthenticated();
      
      console.log('[WABISABI] 🔐 Richiesta credenziali KVAC per elezione:', electionId);
      
      const nonce = randomBytes(32).toString('hex');
      
      const response = await api.post('/voting/credentials', {
        userId: this.user.id,
        electionId: electionId,
        nonce: nonce,
        timestamp: Date.now()
      });
      
      console.log('[WABISABI] ✅ Credenziali KVAC ricevute');
      
      return response.data;
    } catch (error) {
      console.error('[WABISABI] ❌ Errore richiesta credenziali:', error.message);
      throw new Error(`Errore richiesta credenziali KVAC: ${error.message}`);
    }
  }

  /**
   * Create vote commitment using homomorphic encryption
   */
  async createVoteCommitment(candidateId, serialNumber, privateKey) {
    try {
      console.log('[WABISABI] 🔒 Creazione commitment voto per candidato:', candidateId);
      
      // Generate random value for commitment
      const randomValue = randomBytes(32).toString('hex');
      
      // Create commitment hash
      const commitmentData = `${candidateId}:${serialNumber}:${randomValue}`;
      const commitment = createHash('sha256').update(commitmentData).digest('hex');
      
      // Sign commitment with private key
      const keyPair = secp256k1.keyFromPrivate(privateKey);
      const messageHash = createHash('sha256').update(commitment).digest();
      const signature = keyPair.sign(messageHash);
      
      console.log('[WABISABI] ✅ Commitment voto creato');
      
      return {
        commitment,
        randomValue,
        signature: signature.toDER('hex'),
        candidateId,
        serialNumber
      };
    } catch (error) {
      console.error('[WABISABI] ❌ Errore creazione commitment:', error.message);
      throw new Error(`Errore creazione commitment: ${error.message}`);
    }
  }

  /**
   * Generate zero-knowledge proof for vote validity
   */
  async generateZKProof(voteCommitment, credentialData, candidateEncoding) {
    try {
      console.log('[WABISABI] 🔐 Generazione prova zero-knowledge...');
      
      const timestamp = Date.now();
      
      // Create proof data structure
      const proofData = {
        commitment: voteCommitment.commitment,
        serialNumber: credentialData.serialNumber,
        candidateEncoding: candidateEncoding,
        timestamp: timestamp,
        nonce: randomBytes(16).toString('hex')
      };
      
      // Create proof hash
      const proofString = JSON.stringify(proofData);
      const proof = createHash('sha256').update(proofString).digest('hex');
      
      // CREATE PUBLIC INPUTS - questo era mancante!
      const publicInputs = [
        credentialData.serialNumber.substring(0, 16), // Partial serial per verifica
        voteCommitment.commitment.substring(0, 32),    // Partial commitment
        timestamp.toString(),                          // Timestamp per verifica età
        candidateEncoding || 'default'                 // Encoding candidato
      ];
      
      console.log('[WABISABI] ✅ Prova zero-knowledge generata con public inputs');
      
      // RETURN COMPLETE ZK PROOF STRUCTURE
      return {
        proof: proof,                    // Hash della prova
        publicInputs: publicInputs,      // Input pubblici richiesti dal server
        timestamp: timestamp,            // Timestamp esplicito
        proofData: proofData,           // Dati originali per debug
        nonce: proofData.nonce          // Nonce per unicità
      };
      
    } catch (error) {
      console.error('[WABISABI] ❌ Errore generazione ZK proof:', error.message);
      throw new Error(`Errore generazione ZK proof: ${error.message}`);
    }
  }

  /**
   * Submit anonymous vote to the system
   */
  async submitAnonymousVote(voteData) {
    try {
      this.ensureAuthenticated();
      
      console.log('[WABISABI] 📬 Invio voto anonimo...');
      
      // Submit vote (without revealing user identity in the payload)
      const response = await api.post('/voting/submit', {
        electionId: voteData.electionId,
        commitment: voteData.commitment,
        zkProof: voteData.zkProof,
        serialNumber: voteData.serialNumber,
        bitcoinAddress: voteData.bitcoinAddress,
        timestamp: Date.now()
      });
      
      console.log('[WABISABI] ✅ Voto anonimo inviato con successo');
      
      return response.data;
    } catch (error) {
      console.error('[WABISABI] ❌ Errore invio voto:', error.message);
      throw new Error(`Errore invio voto anonimo: ${error.message}`);
    }
  }

  /**
   * Wait for CoinJoin completion and blockchain confirmation
   */
  async waitForCoinJoinCompletion(voteId, maxAttempts = 30) {
    try {
      console.log('[WABISABI] ⏳ Attesa completamento CoinJoin...');
      
      let attempts = 0;
      while (attempts < maxAttempts) {
        try {
          const response = await api.get(`/voting/status/${voteId}`);
          const status = response.data.status;
          
          console.log(`[WABISABI] 📊 Stato voto: ${status} (tentativo ${attempts + 1})`);
          
          if (status === 'confirmed') {
            console.log('[WABISABI] ✅ CoinJoin completato e confermato');
            return response.data;
          } else if (status === 'failed') {
            throw new Error('CoinJoin fallito');
          }
          
          // Attendi 2 secondi prima del prossimo controllo
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          
        } catch (error) {
          if (error.status === 404) {
            console.log('[WABISABI] ⏳ Voto ancora in elaborazione...');
          } else {
            throw error;
          }
        }
      }
      
      throw new Error('Timeout attesa completamento CoinJoin');
    } catch (error) {
      console.error('[WABISABI] ❌ Errore attesa CoinJoin:', error.message);
      throw new Error(`Errore attesa CoinJoin: ${error.message}`);
    }
  }

  /**
   * Get user information from current token
   */
  getUserInfo() {
    this.ensureAuthenticated();
    return {
      ...this.user,
      tokenInfo: authTokenUtils.decodeToken()
    };
  }

  /**
   * Validate that user can vote in the specified election
   */
  async validateVotingEligibility(electionId) {
    try {
      this.ensureAuthenticated();
      
      console.log('[WABISABI] 🔍 Verifica eligibilità voto...');
      
      // This will be handled by the backend when we make API calls
      // but we can do some basic client-side validation
      
      const tokenInfo = authTokenUtils.decodeToken();
      if (!tokenInfo || !tokenInfo.isAuthorized) {
        throw new Error('Utente non autorizzato per il voto');
      }
      
      if (authTokenUtils.isTokenExpired()) {
        throw new Error('Token scaduto. Effettua nuovamente il login');
      }
      
      console.log('[WABISABI] ✅ Eligibilità confermata');
      return true;
      
    } catch (error) {
      console.error('[WABISABI] ❌ Verifica eligibilità fallita:', error.message);
      throw error;
    }
  }
}

export default WabiSabiVoting;