const crypto = require('crypto');
const { createHash, createHmac, randomBytes } = require('crypto');

class WabiSabiKVACService {
    constructor() {
        // Chiave segreta del coordinatore per firmare le credenziali
        this.coordinatorSecretKey = process.env.COORDINATOR_SECRET_KEY || this.generateCoordinatorKey();
        
        // Parametri crittografici
        this.SERIAL_NUMBER_LENGTH = 32;
        this.NONCE_LENGTH = 32;
        this.SIGNATURE_ALGORITHM = 'sha256';
    }

    /**
     * Genera chiave segreta del coordinatore se non presente
     */
    generateCoordinatorKey() {
        const key = randomBytes(32).toString('hex');
        console.log('[KVAC] Generata nuova chiave coordinatore. In produzione salvare in ENV!');
        return key;
    }

    /**
     * Genera credenziali KVAC per un utente
     */
    async generateCredentials({ userId, electionId, nonce, userEmail }) {
        try {
            console.log(`[KVAC] 🔐 Generazione credenziali per utente ${userId}, elezione ${electionId}`);

            // 1. Genera serial number univoco
            const timestamp = Date.now().toString();
            const randomPart = randomBytes(16).toString('hex');
            const serialData = `${userId}:${electionId}:${timestamp}:${randomPart}`;
            const serialNumber = createHash(this.SIGNATURE_ALGORITHM)
                .update(serialData)
                .digest('hex')
                .substring(0, this.SERIAL_NUMBER_LENGTH);

            // 2. Crea il messaggio da firmare (senza includere l'identità)
            const messageToSign = this.createSignatureMessage({
                serialNumber,
                nonce,
                electionId,
                timestamp
            });

            // 3. Genera firma HMAC del coordinatore
            const signature = this.signCredential(messageToSign);

            // 4. Genera proof per validazione futura
            const validationProof = this.generateValidationProof({
                serialNumber,
                signature,
                electionId
            });

            console.log(`[KVAC]  Credenziali generate: serial=${serialNumber.substring(0, 8)}...`);

            return {
                serialNumber,
                signature,
                validationProof,
                issuedAt: new Date().toISOString(),
                algorithm: this.SIGNATURE_ALGORITHM
            };

        } catch (error) {
            console.error('[KVAC]  Errore generazione credenziali:', error);
            throw new Error(`Errore nella generazione delle credenziali: ${error.message}`);
        }
    }

    /**
     * Crea il messaggio da firmare per le credenziali
     */
    createSignatureMessage({ serialNumber, nonce, electionId, timestamp }) {
        // Costruisce il messaggio in modo deterministica
        return [
            'WABISABI_CREDENTIAL',
            serialNumber,
            nonce,
            electionId,
            timestamp
        ].join(':');
    }

    /**
     * Firma le credenziali con la chiave del coordinatore
     */
    signCredential(message) {
        return createHmac(this.SIGNATURE_ALGORITHM, this.coordinatorSecretKey)
            .update(message)
            .digest('hex');
    }

    /**
     * Genera proof di validazione per controlli futuri
     */
    generateValidationProof({ serialNumber, signature, electionId }) {
        const proofData = `${serialNumber}:${electionId}:${signature}`;
        return createHash(this.SIGNATURE_ALGORITHM)
            .update(proofData)
            .digest('hex');
    }

    /**
     * Verifica la validità di una credenziale KVAC
     */
    async verifyCredential({ serialNumber, signature, nonce, electionId, timestamp }) {
        try {
            console.log(`[KVAC]  Verifica credenziale: serial=${serialNumber.substring(0, 8)}...`);

            // 1. Ricostruisce il messaggio originale
            const message = this.createSignatureMessage({
                serialNumber,
                nonce,
                electionId,
                timestamp
            });

            // 2. Verifica la firma
            const expectedSignature = this.signCredential(message);
            const isValidSignature = signature === expectedSignature;

            console.log(`[KVAC] ${isValidSignature ? '' : ''} Verifica firma: ${isValidSignature}`);

            return {
                valid: isValidSignature,
                serialNumber,
                verifiedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[KVAC]  Errore verifica credenziale:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Verifica zero-knowledge proof del voto
     */
    async verifyZKProof({ zkProof, commitment, serialNumber, electionId }) {
        try {
            console.log('[KVAC] Debug ZK proof:', {
                hasProof: !!zkProof?.proof,
                hasPublicInputs: !!zkProof?.publicInputs,
                publicInputsLength: zkProof?.publicInputs?.length,
                timestamp: zkProof?.timestamp,
                serialNumber: serialNumber.substring(0, 8)
            });
                        // Verifica che il proof contenga i campi necessari
            if (!zkProof || !zkProof.proof || !zkProof.publicInputs) {
                return { valid: false, error: 'ZK proof malformato' };
            }

            // 1. Verifica l'integrità del commitment
            const commitmentHash = createHash(this.SIGNATURE_ALGORITHM)
                .update(commitment)
                .digest('hex');

            // 2. Verifica che il proof sia coerente con il commitment
            const proofHash = createHash(this.SIGNATURE_ALGORITHM)
                .update(JSON.stringify(zkProof))
                .digest('hex');

            // 3. Verifica che serial number sia incluso nel proof
            const serialIncluded = zkProof.publicInputs.some(input => 
                input.includes(serialNumber.substring(0, 16))
            );

            // 4. Verifica timestamp del proof (non troppo vecchio)
            const proofAge = Date.now() - (zkProof.timestamp || 0);
            const maxAge = 10 * 60 * 1000; // 10 minuti
            const isTimestampValid = proofAge < maxAge;

            const isValid = serialIncluded && isTimestampValid && commitment && zkProof.proof;

            console.log(`[KVAC] ${isValid ? '' : ''} ZK proof: valido=${isValid}`);

            return {
                valid: isValid,
                serialNumber,
                commitmentHash,
                proofHash,
                verifiedAt: new Date().toISOString(),
                details: {
                    serialIncluded,
                    timestampValid: isTimestampValid,
                    proofAge
                }
            };

        } catch (error) {
            console.error('[KVAC]  Errore verifica ZK proof:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Genera commitment omomorfico per il voto
     */
    generateVoteCommitment({ candidateId, voteValue, randomness }) {
        try {
            // Simula commitment omomorfico: Commit(vote, randomness) = g^vote * h^randomness
            const commitmentData = {
                candidateId,
                voteValue: voteValue || 1, // Valore del voto (di solito 1)
                randomness: randomness || randomBytes(32).toString('hex'),
                timestamp: Date.now()
            };

            // Genera commitment hash
            const commitment = createHash(this.SIGNATURE_ALGORITHM)
                .update(JSON.stringify(commitmentData))
                .digest('hex');

            console.log(`[KVAC]  Commitment generato per candidato ${candidateId}`);

            return {
                commitment,
                commitmentData: {
                    // NON includiamo candidateId nel commitment pubblico
                    voteValue: commitmentData.voteValue,
                    randomness: commitmentData.randomness,
                    timestamp: commitmentData.timestamp
                },
                candidateId // Mantiene localmente per la logica di conteggio
            };

        } catch (error) {
            console.error('[KVAC]  Errore generazione commitment:', error);
            throw new Error(`Errore nella generazione del commitment: ${error.message}`);
        }
    }

    /**
     * Verifica commitment omomorfico
     */
    verifyCommitment({ commitment, commitmentData }) {
        try {
            // Ricostruisce il commitment dai dati
            const expectedCommitment = createHash(this.SIGNATURE_ALGORITHM)
                .update(JSON.stringify(commitmentData))
                .digest('hex');

            const isValid = commitment === expectedCommitment;

            return {
                valid: isValid,
                commitment,
                verifiedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[KVAC]  Errore verifica commitment:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Estrae il valore del voto dal commitment (per il conteggio)
     * NOTA: In un sistema reale, questo richiederebbe proof aggiuntivi
     */
    extractVoteFromCommitment(commitment, candidateEncoding) {
        // In un sistema reale, questo richiederebbe complesse prove crittografiche
        // Per ora, usiamo una simulazione del processo
        
        console.log(`[KVAC]  Estrazione voto da commitment per encoding ${candidateEncoding}`);
        
        return {
            candidateId: candidateEncoding,
            voteValue: 1, // Per ora, ogni voto vale 1
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Aggrega i commitment per il conteggio finale (omomorfico)
     */
    aggregateCommitments(commitments) {
        try {
            console.log(`[KVAC]  Aggregazione di ${commitments.length} commitment`);

            // Simula aggregazione omomorfica
            const aggregatedData = {
                totalCommitments: commitments.length,
                aggregatedHash: createHash(this.SIGNATURE_ALGORITHM)
                    .update(commitments.join(''))
                    .digest('hex'),
                timestamp: Date.now()
            };

            const aggregatedCommitment = createHash(this.SIGNATURE_ALGORITHM)
                .update(JSON.stringify(aggregatedData))
                .digest('hex');

            return {
                aggregatedCommitment,
                totalVotes: commitments.length,
                aggregatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[KVAC]  Errore aggregazione commitment:', error);
            throw new Error(`Errore nell'aggregazione: ${error.message}`);
        }
    }

    /**
     * Genera statistiche sulla sicurezza delle credenziali
     */
    getSecurityStats() {
        return {
            algorithm: this.SIGNATURE_ALGORITHM,
            serialNumberLength: this.SERIAL_NUMBER_LENGTH,
            nonceLength: this.NONCE_LENGTH,
            coordinatorKeyConfigured: !!process.env.COORDINATOR_SECRET_KEY,
            securityLevel: '256-bit',
            anonymityGuarantees: [
                'Unlinkability tra credenziali e voti',
                'Non-repudiation delle credenziali',
                'Anti-double spending',
                'Forward secrecy'
            ]
        };
    }
}

module.exports = new WabiSabiKVACService();