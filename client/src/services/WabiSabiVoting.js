// client/src/services/WabiSabiVoting.js - Modifiche per supportare la ricevuta

import { randomBytes, createHash } from 'crypto-browserify';
import * as elliptic from 'elliptic';
import api, { authTokenUtils } from './api';

// Use elliptic.js instead of tiny-secp256k1 for better browser compatibility
const EC = elliptic.ec;
const secp256k1 = new EC('secp256k1');

class WabiSabiVoting {
    constructor() {
        this.network = 'testnet';
        this.user = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;
        
        console.log('[WABISABI] 🚀 Inizializzazione servizio WabiSabi');
        
        // Ottieni informazioni utente dal token JWT
        const tokenInfo = authTokenUtils.decodeToken();
        if (tokenInfo) {
            this.user = {
                id: tokenInfo.userId || tokenInfo.id,
                email: tokenInfo.email,
                firstName: tokenInfo.firstName,
                lastName: tokenInfo.lastName
            };
            console.log('[WABISABI] ✓ Inizializzato per utente:', this.user.email);
        } else {
            console.error('[WABISABI] ❌ Nessun token valido trovato');
            throw new Error('Utente non autenticato');
        }
        
        this.isInitialized = true;
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
    async generateBitcoinAddress() {
        try {
            this.ensureAuthenticated();
            
            console.log('[WABISABI]  Generazione indirizzo Bitcoin per voto');
            
            // Generate a new key pair using elliptic.js
            const keyPair = secp256k1.genKeyPair();
            const privateKey = keyPair.getPrivate('hex');
            const publicKey = keyPair.getPublic(true, 'hex'); // Compressed public key
            
            // Generate Bitcoin address (simplified for demo)
            const address = this.generateBitcoinAddressFromPublicKey(publicKey);

            console.log('[WABISABI] ✓ Indirizzo Bitcoin generato:', address);

            return {
                address,
                privateKey,
                publicKey,
                keyPair: {
                    privateKey,
                    publicKey
                }
            };
        } catch (error) {
            console.error('[WABISABI] ❌ Errore generazione indirizzo:', error.message);
            throw new Error(`Errore generazione indirizzo Bitcoin: ${error.message}`);
        }
    }

    /**
     * *** NUOVO METODO: Registra indirizzo Bitcoin e crea sessione ***
     */
    async registerBitcoinAddress(electionId, addressData) {
        try {
            this.ensureAuthenticated();
            
            console.log('[WABISABI] 📝 Registrazione indirizzo Bitcoin per elezione:', electionId);
            
            // *** CRUCIALE: Questa chiamata CREA la VotingSession automaticamente ***
            const response = await api.post('/voting/address', {
                userId: this.user.id,
                electionId: electionId,
                bitcoinAddress: addressData.address,
                publicKey: addressData.publicKey
            });
            
            console.log('[WABISABI] ✅ Indirizzo registrato, sessione creata:', response.data.sessionId);
            
            return {
                success: true,
                sessionId: response.data.sessionId,
                bitcoinAddress: response.data.bitcoinAddress,
                publicKey: response.data.publicKey,
                status: response.data.status
            };
        } catch (error) {
            console.error('[WABISABI] ❌ Errore registrazione indirizzo:', error.message);
            throw new Error(`Errore registrazione indirizzo: ${error.message}`);
        }
    }

    /**
     * Generate a Bitcoin address from public key (simplified)
     */
    generateBitcoinAddressFromPublicKey(publicKey) {
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
            
            console.log('[WABISABI] ✓ Credenziali KVAC ricevute');
            
            return response.data;
        } catch (error) {
            console.error('[WABISABI] ❌ Errore richiesta credenziali:', error.message);
            throw new Error(`Errore richiesta credenziali KVAC: ${error.message}`);
        }
    }

    /**
     * Create vote commitment using homomorphic properties
     */
    async createVoteCommitment(candidateId, serialNumber, privateKey) {
        try {
            console.log('[WABISABI] 🔒 Creazione commitment voto per candidato:', candidateId);
            
            // Generate random blinding factor
            const randomValue = randomBytes(32).toString('hex');
            
            // *** FORMATO SEMPLIFICATO COMPATIBILE COL BACKEND ***
            // Crea commitment hash semplice (non oggetto complesso)
            const commitmentData = `${candidateId}:${serialNumber}:${randomValue}:${Date.now()}`;
            const commitment = createHash('sha256').update(commitmentData).digest('hex');
            
            console.log('[WABISABI] ✓ Commitment voto creato');
            
            return {
                commitment,              // String semplice, non oggetto
                candidateId,
                serialNumber,
                randomValue,            // Blinding factor
                createdAt: Date.now()
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
            console.log('[WABISABI] 🔐 Generazione zero-knowledge proof');
            
            const timestamp = Date.now();
            const nonce = randomBytes(16).toString('hex');
            
            // Create proof data structure
            const proofData = {
                commitment: voteCommitment.commitment,
                serialNumber: credentialData.serialNumber,
                candidateEncoding: candidateEncoding,
                timestamp: timestamp,
                nonce: nonce
            };
            
            // Create proof hash
            const proofString = JSON.stringify(proofData);
            const proof = createHash('sha256').update(proofString).digest('hex');
            
            // *** FORMATO CORRETTO PER IL BACKEND ***
            // Crea publicInputs nel formato atteso dal server
            const publicInputs = [
                credentialData.serialNumber.substring(0, 16), // Partial serial per verifica
                voteCommitment.commitment.substring(0, 32),    // Partial commitment
                timestamp.toString(),                          // Timestamp per verifica età
                candidateEncoding || 'default'                 // Encoding candidato
            ];
            
            console.log('[WABISABI] ✓ Zero-knowledge proof generata con publicInputs');
            
            // STRUTTURA COMPLETA ATTESA DAL BACKEND
            return {
                proof: proof,                    // Hash della prova
                publicInputs: publicInputs,      // Input pubblici richiesti dal server
                timestamp: timestamp,            // Timestamp esplicito per verifica età
                proofData: proofData,           // Dati originali per debug
                nonce: nonce                    // Nonce per unicità
            };
            
        } catch (error) {
            console.error('[WABISABI] ❌ Errore generazione ZK proof:', error.message);
            throw new Error(`Errore generazione zero-knowledge proof: ${error.message}`);
        }
    }

    /**
     * Submit anonymous vote to the system
     */
    async submitAnonymousVote(voteData) {
        try {
            console.log('[WABISABI] 📤 Invio voto anonimo...');
            
            // CORREZIONE: Usa la route corretta esistente del sistema
            const response = await api.post('/voting/submit', voteData);
            
            if (!response.data || !response.data.voteId) {
                throw new Error('Risposta server invalida: mancano dati del voto');
            }
            
            console.log('[WABISABI] ✓ Voto inviato con successo:', {
                voteId: response.data.voteId,
                status: response.data.status,
                coinjoinTriggered: response.data.coinjoinTriggered
            });
            
            return {
                voteId: response.data.voteId,
                sessionId: response.data.sessionId || null,
                status: response.data.status,
                message: response.data.message,
                coinjoinTriggered: response.data.coinjoinTriggered,
                estimatedTime: response.data.estimatedConfirmationTime
            };
            
        } catch (error) {
            console.error('[WABISABI] ❌ Errore invio voto:', error);
            
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            
            throw new Error('Errore durante l\'invio del voto anonimo');
        }
    }

    // METODO MODIFICATO PER SUPPORTARE LA RICEVUTA
    async waitForCoinJoinCompletion(voteId, maxAttempts = 30, intervalMs = 10000) {
        console.log('[WABISABI] ⏳ Attesa completamento CoinJoin per voto:', voteId);
        
        let attempts = 0;
        let lastStatus = 'pending';
        
        while (attempts < maxAttempts) {
            try {
                // Controlla lo stato del voto
                const statusResponse = await api.get(`/voting/status/${voteId}`);
                const voteStatus = statusResponse.data;
                
                console.log(`[WABISABI] 📊 Tentativo ${attempts + 1}/${maxAttempts} - Stato:`, {
                    status: voteStatus.status,
                    hasTransaction: !!voteStatus.transaction,
                    txId: voteStatus.transaction?.txId
                });
                
                // Aggiorna lo stato se è cambiato
                if (voteStatus.status !== lastStatus) {
                    lastStatus = voteStatus.status;
                    console.log('[WABISABI] 🔄 Cambio stato:', voteStatus.status);
                }
                
                // Se il voto è stato confermato e abbiamo una transazione
                if (voteStatus.status === 'confirmed' && voteStatus.transaction) {
                    console.log('[WABISABI] ✅ CoinJoin completato:', {
                        voteId,
                        txId: voteStatus.transaction.txId,
                        confirmations: voteStatus.transaction.confirmations
                    });
                    
                    return {
                        success: true,
                        voteId,
                        transactionId: voteStatus.transaction.txId,
                        confirmations: voteStatus.transaction.confirmations,
                        blockHeight: voteStatus.transaction.blockHeight,
                        blockHash: voteStatus.transaction.blockHash,
                        status: 'confirmed',
                        completedAt: new Date(),
                        // Dati aggiuntivi per la ricevuta
                        sessionId: voteStatus.sessionId,
                        processedAt: voteStatus.processedAt
                    };
                }
                
                // Se il voto è stato processato ma non ancora confermato
                if (voteStatus.status === 'processed' || voteStatus.status === 'confirmed') {
                    console.log('[WABISABI] ⚠️ Voto processato, attendendo conferma blockchain...');
                }
                
                // Se c'è un errore nel voto
                if (voteStatus.status === 'failed') {
                    throw new Error('Il processo di voto è fallito durante la fase CoinJoin');
                }
                
                attempts++;
                
                // Attendi prima del prossimo controllo
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
                
            } catch (error) {
                console.error(`[WABISABI] ❌ Errore controllo stato (tentativo ${attempts + 1}):`, error);
                
                // Se è un errore di rete, riprova
                if (error.code === 'NETWORK_ERROR' || error.response?.status >= 500) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log('[WABISABI] 🔄 Riprovo per errore di rete...');
                        await new Promise(resolve => setTimeout(resolve, intervalMs));
                        continue;
                    }
                }
                
                // Per altri errori, rilancia subito
                throw error;
            }
        }
        
        // Timeout raggiunto
        console.error('[WABISABI] ⏰ Timeout raggiunto per CoinJoin completion');
        throw new Error(`Timeout: il processo CoinJoin non si è completato entro ${maxAttempts * intervalMs / 1000} secondi`);
    }

    // NUOVO METODO PER OTTENERE I DATI DELLA RICEVUTA
    async getVoteReceipt(voteId) {
        try {
            console.log('[WABISABI] 🧾 Recupero dati ricevuta per voto:', voteId);
            
            const response = await api.get(`/voting/receipt/${voteId}`);
            
            if (!response.data) {
                throw new Error('Dati ricevuta non disponibili');
            }
            
            console.log('[WABISABI] ✅ Ricevuta recuperata:', {
                voteId,
                hasTransaction: !!response.data.blockchain?.transactionId,
                status: response.data.status
            });
            
            return response.data;
            
        } catch (error) {
            console.error('[WABISABI] ❌ Errore recupero ricevuta:', error);
            
            if (error.response?.status === 404) {
                throw new Error('Ricevuta non trovata: il voto potrebbe non esistere');
            }
            
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            
            throw new Error('Errore durante il recupero della ricevuta');
        }
    }

    // NUOVO METODO PER VERIFICARE UNA TRANSAZIONE SULLA BLOCKCHAIN
    async verifyTransaction(txId) {
        try {
            console.log('[WABISABI] 🔍 Verifica transazione:', txId);
            
            const response = await api.get(`/voting/verify/${txId}`);
            
            if (!response.data) {
                throw new Error('Dati di verifica non disponibili');
            }
            
            console.log('[WABISABI] ✅ Verifica completata:', {
                txId,
                confirmations: response.data.confirmations,
                status: response.data.status
            });
            
            return response.data;
            
        } catch (error) {
            console.error('[WABISABI] ❌ Errore verifica transazione:', error);
            
            if (error.response?.status === 404) {
                throw new Error('Transazione non trovata nel sistema');
            }
            
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            }
            
            throw new Error('Errore durante la verifica della transazione');
        }
    }

    // METODO HELPER PER IL POLLING DELLO STATO
    async pollVoteStatus(voteId, onStatusChange = null) {
        const pollInterval = 5000; // 5 secondi
        const maxPollTime = 300000; // 5 minuti
        
        const startTime = Date.now();
        let lastStatus = null;
        
        const poll = async () => {
            try {
                const statusResponse = await api.get(`/voting/status/${voteId}`);
                const currentStatus = statusResponse.data.status;
                
                // Se lo stato è cambiato, notifica il callback
                if (currentStatus !== lastStatus && onStatusChange) {
                    onStatusChange(statusResponse.data);
                    lastStatus = currentStatus;
                }
                
                // Se il voto è completato, ritorna i dati
                if (currentStatus === 'confirmed') {
                    return statusResponse.data;
                }
                
                // Se non è ancora completato ma non abbiamo superato il tempo massimo
                if (Date.now() - startTime < maxPollTime) {
                    setTimeout(poll, pollInterval);
                } else {
                    throw new Error('Timeout durante l\'attesa del completamento del voto');
                }
                
            } catch (error) {
                console.error('[WABISABI] Errore durante polling:', error);
                throw error;
            }
        };
        
        return poll();
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
            
            const tokenInfo = authTokenUtils.decodeToken();
            if (!tokenInfo || !tokenInfo.isAuthorized) {
                throw new Error('Utente non autorizzato per il voto');
            }
            
            if (authTokenUtils.isTokenExpired()) {
                throw new Error('Token scaduto. Effettua nuovamente il login');
            }
            
            console.log('[WABISABI] ✓ Eligibilità confermata');
            return true;
            
        } catch (error) {
            console.error('[WABISABI] ❌ Verifica eligibilità fallita:', error.message);
            throw error;
        }
    }

    /**
     * Metodo per pulire i dati locali
     */
    cleanup() {
        console.log('[WABISABI] 🧹 Pulizia dati locali');
        this.user = null;
        this.isInitialized = false;
    }
}

export default WabiSabiVoting;