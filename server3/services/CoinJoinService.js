// Servizio per la gestione del protocollo CoinJoin WabiSabi

const crypto = require('crypto');
const BitcoinService = require('./BitcoinService');
const WabiSabiKVACService = require('./WabiSabiKVACService');
const { 
    VotingSession, 
    Vote, 
    Transaction, 
    Election, 
    Candidate 
} = require('../shared/database_config');

class CoinJoinService {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> CoinJoinSession
        this.ROUND_TIMEOUT = 300000; // 5 minuti timeout per round
        this.MIN_PARTICIPANTS = 2; // Minimo partecipanti per CoinJoin
        this.MAX_PARTICIPANTS = 50; // Massimo partecipanti per round
        this.COINJOIN_FEE = 1000; // Fee in satoshi
    }

    /**
     * Trigger del processo CoinJoin quando raggiunti voti sufficienti
     */
    async triggerCoinJoin(sessionId, electionId) {
        try {
            console.log(`[COINJOIN] 🚀 Avvio CoinJoin per sessione ${sessionId}`);
    
            // Verifica che la sessione non sia già in elaborazione
            if (this.activeSessions.has(sessionId)) {
                console.log(`[COINJOIN] ⚠️ Sessione ${sessionId} già in elaborazione`);
                return;
            }
    
            // Carica i voti pending per questa sessione
            const pendingVotes = await Vote.findAll({
                where: {
                    sessionId: sessionId,
                    status: 'pending'
                },
                // CORREZIONE: Usa submitted_at invece di submittedAt
                order: [['submitted_at', 'ASC']]
            });
    
            console.log(`[COINJOIN] 📊 Trovati ${pendingVotes.length} voti pendenti`);
    
            if (pendingVotes.length < this.MIN_PARTICIPANTS) {
                console.log(`[COINJOIN] ⚠️ Voti insufficienti: ${pendingVotes.length} < ${this.MIN_PARTICIPANTS}`);
                return;
            }
    
            // Aggiorna stato sessione
            await VotingSession.update(
                { status: 'output_registration' },
                { where: { id: sessionId } }
            );
    
            // Crea sessione CoinJoin
            const coinJoinSession = {
                sessionId,
                electionId,
                participants: pendingVotes.slice(0, this.MAX_PARTICIPANTS),
                startedAt: new Date(),
                status: 'input_registration',
                round: 1,
                transactions: []
            };
    
            // CORREZIONE: Salva correttamente la sessione nella mappa
            this.activeSessions.set(sessionId, coinJoinSession);
    
            console.log(`[COINJOIN] ✅ Sessione CoinJoin creata per ${coinJoinSession.participants.length} partecipanti`);
    
            // Avvia il processo in background
            this.processCoinJoinRounds(coinJoinSession)
                .catch(error => {
                    console.error(`[COINJOIN] ❌ Errore processo CoinJoin:`, error);
                    this.handleCoinJoinError(sessionId, error);
                });
    
            console.log(`[COINJOIN] ✅ CoinJoin avviato per ${coinJoinSession.participants.length} partecipanti`);
    
            return coinJoinSession;
    
        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore trigger CoinJoin:`, error);
            throw error;
        }
    }

    /**
     * Processa i round del protocollo CoinJoin WabiSabi
     */
    async processCoinJoinRounds(coinJoinSession) {
        try {
            const { sessionId, participants } = coinJoinSession;
            
            console.log(`[COINJOIN] 🔄 Inizio round ${coinJoinSession.round} per sessione ${sessionId}`);

            // ROUND 1: Input Registration
            await this.inputRegistrationRound(coinJoinSession);

            // ROUND 2: Output Registration  
            await this.outputRegistrationRound(coinJoinSession);

            // ROUND 3: Transaction Signing
            await this.transactionSigningRound(coinJoinSession);

            // ROUND 4: Broadcasting
            await this.broadcastTransaction(coinJoinSession);

            // Finalizza
            await this.finalizeCoinJoin(coinJoinSession);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore nei round CoinJoin:`, error);
            await this.handleCoinJoinError(coinJoinSession.sessionId, error);
        }
    }

    /**
     * Round 1: Input Registration - Registra gli input dei partecipanti
     */
    async inputRegistrationRound(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 📥 Input Registration Round - Sessione ${coinJoinSession.sessionId}`);

            coinJoinSession.status = 'input_registration';
            const inputs = [];

            for (const vote of coinJoinSession.participants) {
                // Simula registrazione input UTXO
                const input = {
                    voteId: vote.id,
                    serialNumber: vote.serialNumber,
                    commitment: vote.commitment,
                    utxo: await this.generateMockUTXO(vote),
                    registeredAt: new Date()
                };

                inputs.push(input);
                console.log(`[COINJOIN] ✓ Input registrato per voto ${vote.id}`);
            }

            coinJoinSession.inputs = inputs;
            coinJoinSession.round = 2;

            // Aggiorna stato voti
            await Vote.update(
                { status: 'processed' },
                { 
                    where: { 
                        id: coinJoinSession.participants.map(p => p.id) 
                    } 
                }
            );

            console.log(`[COINJOIN] ✅ Input Registration completato: ${inputs.length} input`);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore Input Registration:`, error);
            throw error;
        }
    }

    /**
     * Round 2: Output Registration - Registra gli output anonimi
     */
    async outputRegistrationRound(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 📤 Output Registration Round - Sessione ${coinJoinSession.sessionId}`);

            coinJoinSession.status = 'output_registration';
            const outputs = [];

            // Carica candidati per l'elezione
            const candidates = await Candidate.findAll({
                where: { electionId: coinJoinSession.electionId }
            });

            const candidateMap = new Map(candidates.map(c => [c.voteEncoding, c]));

            for (const input of coinJoinSession.inputs) {
                // Estrae il voto dal commitment (in un sistema reale, richiederebbe ZK proofs)
                const voteData = this.extractVoteFromCommitment(input.commitment);
                
                // Trova candidato corrispondente
                const candidate = candidateMap.get(voteData.candidateEncoding);
                if (!candidate) {
                    console.error(`[COINJOIN] ❌ Candidato non trovato per encoding ${voteData.candidateEncoding}`);
                    continue;
                }

                const output = {
                    candidateId: candidate.id,
                    candidateBitcoinAddress: candidate.bitcoinAddress,
                    voteValue: voteData.voteValue,
                    anonymizedCommitment: this.anonymizeCommitment(input.commitment),
                    registeredAt: new Date()
                };

                outputs.push(output);
                console.log(`[COINJOIN] ✓ Output registrato per candidato ${candidate.name}`);
            }

            coinJoinSession.outputs = outputs;
            coinJoinSession.round = 3;

            console.log(`[COINJOIN] ✅ Output Registration completato: ${outputs.length} output`);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore Output Registration:`, error);
            throw error;
        }
    }

    /**
     * Round 3: Transaction Signing - Firma la transazione aggregata
     */
    async transactionSigningRound(coinJoinSession) {
        try {
            console.log(`[COINJOIN] ✍️ Transaction Signing Round - Sessione ${coinJoinSession.sessionId}`);

            coinJoinSession.status = 'signing';

            // Costruisce la transazione CoinJoin
            const transaction = await this.buildCoinJoinTransaction(coinJoinSession);
            
            // Simula processo di firma (in un sistema reale, ogni partecipante firma)
            const signedTransaction = await this.signCoinJoinTransaction(transaction);

            coinJoinSession.transaction = signedTransaction;
            coinJoinSession.round = 4;

            console.log(`[COINJOIN] ✅ Transazione firmata: ${signedTransaction.txId}`);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore Transaction Signing:`, error);
            throw error;
        }
    }

    /**
     * Round 4: Broadcasting - Trasmette la transazione alla blockchain
     */
    async broadcastTransaction(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 📡 Broadcasting Transaction - Sessione ${coinJoinSession.sessionId}`);

            const { transaction } = coinJoinSession;
            
            // Broadcast alla blockchain
            const broadcastResult = await BitcoinService.broadcastTransaction(transaction.rawTx);
            
            // Salva nel database
            const dbTransaction = await Transaction.create({
                electionId: coinJoinSession.electionId,
                sessionId: coinJoinSession.sessionId,
                txId: broadcastResult.txId,
                type: 'coinjoin',
                rawData: transaction.rawTx,
                metadata: {
                    inputCount: coinJoinSession.inputs.length,
                    outputCount: coinJoinSession.outputs.length,
                    participants: coinJoinSession.participants.length,
                    totalVotes: coinJoinSession.outputs.reduce((sum, o) => sum + o.voteValue, 0)
                },
                confirmations: 0
            });

            // Aggiorna voti con transaction ID
            await Vote.update(
                { 
                    status: 'confirmed',
                    transactionId: broadcastResult.txId,
                    processedAt: new Date()
                },
                { 
                    where: { 
                        id: coinJoinSession.participants.map(p => p.id) 
                    } 
                }
            );

            coinJoinSession.broadcastedAt = new Date();
            coinJoinSession.txId = broadcastResult.txId;

            console.log(`[COINJOIN] ✅ Transazione trasmessa: ${broadcastResult.txId}`);

            // Avvia monitoring delle conferme
            this.monitorTransactionConfirmations(broadcastResult.txId);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore Broadcasting:`, error);
            throw error;
        }
    }

    /**
     * Finalizza il processo CoinJoin
     */
    async finalizeCoinJoin(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 🏁 Finalizzazione CoinJoin - Sessione ${coinJoinSession.sessionId}`);

            // Aggiorna stato sessione
            await VotingSession.update(
                { 
                    status: 'completed',
                    endTime: new Date(),
                    finalTallyTransactionId: coinJoinSession.txId
                },
                { where: { id: coinJoinSession.sessionId } }
            );

            // Aggiorna contatori candidati
            await this.updateCandidateVoteCounts(coinJoinSession);

            // Rimuove dalla memoria
            this.activeSessions.delete(coinJoinSession.sessionId);

            console.log(`[COINJOIN] ✅ CoinJoin completato per sessione ${coinJoinSession.sessionId}`);

            return {
                success: true,
                sessionId: coinJoinSession.sessionId,
                txId: coinJoinSession.txId,
                participantsCount: coinJoinSession.participants.length,
                completedAt: new Date()
            };

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore finalizzazione:`, error);
            throw error;
        }
    }

    /**
     * Costruisce la transazione CoinJoin aggregata
     */
    async buildCoinJoinTransaction(coinJoinSession) {
        const { inputs, outputs } = coinJoinSession;

        // Simula costruzione transazione Bitcoin
        const transaction = {
            version: 2,
            inputs: inputs.map(input => ({
                txid: input.utxo.txid,
                vout: input.utxo.vout,
                scriptSig: '', // Sarà popolato durante la firma
                sequence: 0xffffffff
            })),
            outputs: outputs.map(output => ({
                address: output.candidateBitcoinAddress,
                value: output.voteValue * 100000, // Converte in satoshi
                scriptPubKey: BitcoinService.addressToScriptPubKey(output.candidateBitcoinAddress)
            })),
            lockTime: 0
        };

        // Calcola hash della transazione
        const txData = JSON.stringify(transaction);
        const txId = crypto.createHash('sha256').update(txData).digest('hex');

        return {
            txId,
            rawTx: txData,
            transaction
        };
    }

    /**
     * Firma la transazione CoinJoin (simulazione)
     */
    async signCoinJoinTransaction(transaction) {
        // In un sistema reale, ogni partecipante dovrebbe firmare i propri input
        const signatures = transaction.transaction.inputs.map((input, index) => {
            return {
                inputIndex: index,
                signature: crypto.createHash('sha256')
                    .update(`${transaction.txId}:${index}:signature`)
                    .digest('hex')
            };
        });

        return {
            ...transaction,
            signatures,
            signedAt: new Date()
        };
    }

    /**
     * Estrae il voto dal commitment (simulazione - in realtà richiederebbe ZK proofs)
     */
    extractVoteFromCommitment(commitment) {
        // Simulazione: estrae candidato basandosi sull'hash del commitment
        const commitmentHash = crypto.createHash('sha256').update(commitment).digest('hex');
        const candidateEncoding = parseInt(commitmentHash.substring(0, 2), 16) % 10; // 0-9
        
        return {
            candidateEncoding,
            voteValue: 1
        };
    }

    /**
     * Anonimizza un commitment per l'output registration
     */
    anonymizeCommitment(commitment) {
        return crypto.createHash('sha256')
            .update(`anonymous:${commitment}:${Date.now()}`)
            .digest('hex');
    }

    /**
     * Genera UTXO mock per testing
     */
    async generateMockUTXO(vote) {
        return {
            txid: crypto.createHash('sha256').update(`utxo:${vote.id}`).digest('hex'),
            vout: 0,
            value: 100000, // 0.001 BTC in satoshi
            scriptPubKey: 'mock_script_pubkey'
        };
    }

    /**
     * Aggiorna i contatori dei voti per i candidati
     */
    async updateCandidateVoteCounts(coinJoinSession) {
        try {
            const voteCounts = new Map();

            // Conta i voti per candidato
            for (const output of coinJoinSession.outputs) {
                const current = voteCounts.get(output.candidateId) || 0;
                voteCounts.set(output.candidateId, current + output.voteValue);
            }

            // Aggiorna database
            for (const [candidateId, voteCount] of voteCounts) {
                await Candidate.increment(
                    'totalVotesReceived',
                    { 
                        by: voteCount,
                        where: { id: candidateId }
                    }
                );
            }

            console.log(`[COINJOIN] ✅ Aggiornati contatori per ${voteCounts.size} candidati`);

        } catch (error) {
            console.error(`[COINJOIN] ❌ Errore aggiornamento contatori:`, error);
        }
    }

    /**
     * Monitora le conferme della transazione
     */
    monitorTransactionConfirmations(txId) {
        console.log(`[COINJOIN] 👀 Avvio monitoring conferme per ${txId}`);
        
        // Avvia polling per conferme (ogni 30 secondi)
        const checkConfirmations = async () => {
            try {
                const confirmations = await BitcoinService.getTransactionConfirmations(txId);
                
                await Transaction.update(
                    { confirmations },
                    { where: { txId } }
                );

                if (confirmations >= 6) {
                    console.log(`[COINJOIN] ✅ Transazione ${txId} completamente confermata (${confirmations} conf)`);
                    return; // Stop monitoring
                }

                // Continua monitoring
                setTimeout(checkConfirmations, 30000);

            } catch (error) {
                console.error(`[COINJOIN] ❌ Errore monitoring ${txId}:`, error);
            }
        };

        setTimeout(checkConfirmations, 30000);
    }

    /**
     * Gestisce errori durante il CoinJoin
     */
    async handleCoinJoinError(sessionId, error) {
        try {
            console.error(`[COINJOIN] ❌ Gestione errore per sessione ${sessionId}:`, error);

            // Aggiorna stato sessione
            await VotingSession.update(
                { status: 'failed' },
                { where: { id: sessionId } }
            );

            // Ripristina stato voti a pending per retry
            const session = this.activeSessions.get(sessionId);
            if (session) {
                await Vote.update(
                    { status: 'pending' },
                    { 
                        where: { 
                            id: session.participants.map(p => p.id) 
                        } 
                    }
                );
            }

            // Rimuove dalla memoria
            this.activeSessions.delete(sessionId);

        } catch (dbError) {
            console.error(`[COINJOIN] ❌ Errore gestione errore:`, dbError);
        }
    }

    /**
     * Ottiene statistiche sulle sessioni CoinJoin attive
     */
    getActiveSessionsStats() {
        const stats = Array.from(this.activeSessions.values()).map(session => ({
            sessionId: session.sessionId,
            electionId: session.electionId,
            status: session.status,
            participants: session.participants.length,
            round: session.round,
            startedAt: session.startedAt,
            txId: session.txId
        }));

        return {
            activeSessionsCount: this.activeSessions.size,
            sessions: stats,
            config: {
                minParticipants: this.MIN_PARTICIPANTS,
                maxParticipants: this.MAX_PARTICIPANTS,
                roundTimeout: this.ROUND_TIMEOUT,
                coinjoinFee: this.COINJOIN_FEE
            }
        };
    }
}

module.exports = new CoinJoinService();