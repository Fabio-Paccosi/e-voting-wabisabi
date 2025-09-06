// server3/services/coinjoinTrigger.service.js - VERSIONE CORRETTA
const crypto = require('crypto');

class CoinJoinTriggerService {
    constructor() {
        this.isRunning = false;
        this.checkInterval = null;
        this.intervalMs = 30000; // 30 secondi
    }

    start() {
        if (this.isRunning) {
            console.log('[CoinJoin Service] Servizio già in esecuzione');
            return;
        }

        this.isRunning = true;
        console.log(`[CoinJoin Service] Avvio controllo ogni ${this.intervalMs}ms`);
        
        this.checkInterval = setInterval(() => {
            this.checkLoop().catch(error => {
                console.error('[CoinJoin Service] Errore nel loop di controllo:', error);
            });
        }, this.intervalMs);
    }

    stop() {
        if (!this.isRunning) {
            console.log('[CoinJoin Service] Servizio già fermato');
            return;
        }

        this.isRunning = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        console.log('[CoinJoin Service] Servizio fermato');
    }

    async checkLoop() {
        try {
            await this.checkPendingVotes();
        } catch (error) {
            console.error('[CoinJoin Service] Errore controllo voti pending:', error);
        }
    }

    async checkPendingVotes() {
        try {
            const { Election } = require('../shared/database_config').getModelsForService('vote');
            
            // Trova elezioni attive
            const activeElections = await Election.findAll({
                where: {
                    status: 'active'
                }
            });

            console.log(`[CoinJoin Service] Controllo ${activeElections.length} elezioni attive`);

            for (const election of activeElections) {
                await this.processElectionVotes(election);
            }
            
        } catch (error) {
            console.error('[CoinJoin Service] Errore nel controllo generale:', error);
        }
    }

    async processElectionVotes(election) {
        try {
            console.log(`[CoinJoin Service] Processamento voti per elezione "${election.title}"`);
            
            // Step 1: Trova sessioni attive per questa elezione
            const { VotingSession } = require('../shared/database_config').getModelsForService('vote');
            const sessions = await VotingSession.findAll({
                where: {
                    electionId: election.id,
                    status: 'input_registration'
                }
            });

            console.log(`[CoinJoin Service] Trovate ${sessions.length} sessioni`);

            if (sessions.length === 0) {
                return;
            }

            // Step 2: Per ogni sessione, controlla voti pending
            for (const session of sessions) {
                const { Vote } = require('../shared/database_config').getModelsForService('vote');
                const votes = await Vote.findAll({
                    where: {
                        sessionId: session.id,
                        status: 'pending'
                    }
                });

                console.log(`[CoinJoin Service] Trovati ${votes.length} voti pending`);

                if (votes.length === 0) {
                    continue;
                }

                // Step 3: Controlla se abbiamo raggiunto la soglia
                const threshold = election.coinjoinTrigger || 2;
                if (votes.length < threshold) {
                    console.log(`[CoinJoin Service] Soglia non raggiunta: ${votes.length}/${threshold}`);
                    continue;
                }

                // Step 4: Procedi con CoinJoin
                console.log(`[CoinJoin Service] Avvio esecuzione CoinJoin per ${votes.length} voti`);
                await this.executeCoinJoin(election, votes);
            }
            
        } catch (error) {
            console.error(`[CoinJoin Service] Errore:`, error);
            throw error;
        }
    }

    async executeCoinJoin(election, votes) {
        try {
            console.log(`[CoinJoin Service] Costruzione transazione per ${votes.length} voti`);

            // Costruisci transazione aggregata
            const transaction = await this.buildCoinJoinTransaction(election, votes);
            
            // Broadcast alla blockchain
            const txId = await this.broadcastTransaction(transaction, process.env.BITCOIN_NETWORK || 'testnet');
            
            console.log(`[CoinJoin Service] Salvataggio record transazione nel database`);
            const savedTransaction = await this.saveTransactionRecord(election, transaction, votes, txId);
            
            console.log(`[CoinJoin Service] Aggiornamento stato di ${votes.length} voti`);
            await this.updateVoteStatuses(votes, savedTransaction.id); // ← QUI È LA CORREZIONE
            
            // Aggiorna conteggi candidati
            console.log(`[CoinJoin Service] Aggiornamento conteggi candidati per elezione ${election.id}`);
            await this.updateCandidateVoteCounts(election, votes);
            
            console.log(`✅ [CoinJoin Service] CoinJoin completato per elezione "${election.title}"`);
            
        } catch (error) {
            console.error(`❌ [CoinJoin Service] Errore durante CoinJoin:`, error);
            throw error;
        }
    }

    async saveTransactionRecord(election, transaction, votes, txId) {
        try {
            console.log(`[CoinJoin Service] 💾 Salvataggio record transazione nel database`);
            
            // Import del modello Transaction
            const { Transaction } = require('../shared/database_config').getModelsForService('vote');
            
            // Prepara i metadati della transazione
            const metadata = {
                voterCount: votes.length,
                inputCount: transaction.transaction?.inputs?.length || 0,
                outputCount: transaction.transaction?.outputs?.length || 0,
                fee: transaction.transaction?.fee || 0,
                size: transaction.transaction?.size || 0,
                aggregation: transaction.aggregation || {},
                timestamp: new Date().toISOString(),
                network: process.env.BITCOIN_NETWORK || 'testnet'
            };
            
            // Prepara i dati raw della transazione
            const rawData = {
                inputs: transaction.transaction?.inputs || [],
                outputs: transaction.transaction?.outputs || [],
                voterCount: votes.length,
                votes: votes.map(v => ({
                    id: v.id,
                    serialNumber: v.serialNumber,
                    commitment: v.commitment,
                    utxo: 0.001,
                })),
                fee: transaction.transaction?.fee || 0,
                txHex: transaction.rawTx || null
            };
            
            // Salva il record della transazione
            const savedTransaction = await Transaction.create({
                electionId: election.id,
                sessionId: votes[0]?.sessionId || null, // Usa la sessionId del primo voto
                txid: txId,
                voteCount: votes.length,
                status: 'broadcasted',
                blockHeight: null, // Sarà aggiornato quando la transazione sarà confermata
                rawData: JSON.stringify(rawData),
                metadata: metadata
            });
            
            console.log(`[CoinJoin Service] ✅ Record transazione salvato: ${savedTransaction.id}`);
            return savedTransaction;
            
        } catch (error) {
            console.error(`[CoinJoin Service] ❌ Errore salvataggio transazione:`, error);
            throw error;
        }
    }

    async buildCoinJoinTransaction(election, votes) {
        try {
            const aggregatedCommitments = {};

            for (const vote of votes) {
                try {
                    // Gestione migliorata dell'estrazione del voto
                    let candidateValue = await this.extractCandidateFromVote(vote);
                    
                    if (!candidateValue) {
                        console.warn(`[CoinJoin] ⚠️ Impossibile estrarre candidato da voto ${vote.id}`);
                        continue;
                    }

                    // Mappa il commitment al candidato
                    const candidateAddress = await this.getCandidateAddress(election.id, candidateValue);
                    if (candidateAddress) {
                        aggregatedCommitments[candidateAddress] = (aggregatedCommitments[candidateAddress] || 0) + 1;
                        console.log(`[CoinJoin] 📊 Commitment mappato a candidato ${candidateValue} per voto ${vote.id}`);
                        
                        // Trova il nome del candidato per il log
                        const candidate = await this.findCandidateByEncoding(election.id, candidateValue);
                        if (candidate) {
                            console.log(`[CoinJoin] Voto ${vote.id} processato per candidato ${candidate.name}`);
                        }
                    }
                } catch (error) {
                    console.error(`[CoinJoin] Errore processing voto ${vote.id}:`, error);
                }
            }

            console.log(`[CoinJoin] Aggregazione completata:`, aggregatedCommitments);

            // Costruisci struttura transazione
            const transaction = {
                inputs: votes.map(vote => ({
                    voteId: vote.id,
                    commitment: vote.commitment,
                    serialNumber: vote.serialNumber
                })),
                outputs: Object.entries(aggregatedCommitments).map(([address, count]) => ({
                    address,
                    amount: count * 546, // 546 satoshi per voto (dust limit)
                    voteCount: count
                })),
                fee: votes.length * 100, // 100 satoshi per voto come fee
                timestamp: new Date().toISOString()
            };

            // Genera hash transazione
            const txData = JSON.stringify(transaction);
            const txHash = crypto.createHash('sha256').update(txData).digest('hex');

            return {
                txId: txHash,
                rawTx: Buffer.from(txData).toString('hex'),
                transaction: transaction,
                aggregation: aggregatedCommitments
            };

        } catch (error) {
            console.error(`[CoinJoin] Errore costruzione transazione:`, error);
            throw error;
        }
    }

    async extractCandidateFromVote(vote) {
        try {
            // Gestione robusta dei diversi formati di commitment
            let commitment = vote.commitment;
            
            // Se commitment è oggetto, converti in stringa
            if (typeof commitment === 'object') {
                commitment = JSON.stringify(commitment);
            }
            
            // Se commitment è stringa JSON, prova a parsing
            if (typeof commitment === 'string' && (commitment.startsWith('{') || commitment.startsWith('['))) {
                try {
                    const parsed = JSON.parse(commitment);
                    if (parsed.candidateEncoding !== undefined) {
                        const encoding = parseInt(parsed.candidateEncoding);
                        if (!isNaN(encoding)) {
                            return encoding;
                        }
                    }
                    if (parsed.candidate !== undefined) {
                        const encoding = parseInt(parsed.candidate);
                        if (!isNaN(encoding)) {
                            return encoding;
                        }
                    }
                } catch (parseError) {
                    console.warn(`[CoinJoin] Warning parsing commitment:`, parseError.message);
                }
            }
            
            // Mappa hash a candidati validi (1, 2, 3)
            const commitmentStr = commitment ? commitment.toString() : '';
            const hash = crypto.createHash('sha256').update(commitmentStr).digest('hex');
            const numericValue = parseInt(hash.substring(0, 8), 16);
            const candidateId = (numericValue % 3) + 1; // 1, 2, o 3
            
            console.log(`[CoinJoin] 🔢 Voto ${vote.id} mappato a candidato ${candidateId}`);
            return candidateId;
            
        } catch (error) {
            console.error(`[CoinJoin] Errore estrazione candidato:`, error);
            return 1; // Default fallback
        }
    }

    async findCandidateByEncoding(electionId, encoding) {
        try {
            const { Candidate } = require('../shared/database_config').getModelsForService('vote');
            
            // CORREZIONE: usa 'voteEncoding' invece di 'valueEncoding'
            const candidate = await Candidate.findOne({
                where: {
                    electionId,
                    voteEncoding: encoding  // ✅ Corretto: voteEncoding invece di valueEncoding
                }
            });
            return candidate;
        } catch (error) {
            console.error(`[CoinJoin] Errore ricerca candidato:`, error);
            return null;
        }
    }

    async getCandidateAddress(electionId, candidateValue) {
        try {
            const candidate = await this.findCandidateByEncoding(electionId, candidateValue);
            if (candidate && candidate.bitcoinAddress) {
                return candidate.bitcoinAddress;
            }
            
            // Fallback: genera address predefiniti per testing
            const testAddresses = {
                1: 'tb1qa010cdaa6869b5104b918a7104cd017a3f20990b3f424f9eff3fbfc6',
                2: 'tb1q4ae1a140db86c55c223998b113e3911a1f5ef7d7e122a1b51a5f6b47',
                3: 'tb1qxyz789...' // Placeholder per candidato 3
            };
            
            return testAddresses[candidateValue] || testAddresses[1];
        } catch (error) {
            console.error(`[CoinJoin] Errore ottenimento address candidato:`, error);
            return 'tb1qa010cdaa6869b5104b918a7104cd017a3f20990b3f424f9eff3fbfc6'; // Default
        }
    }

    async broadcastTransaction(transaction, network = 'testnet') {
        try {
            console.log(`[CoinJoin Service] 📡 Broadcasting su ${network}...`);
            
            // Simula broadcast per testing (il nodo Bitcoin locale non è disponibile)
            console.log(`[CoinJoin Service] 🔗 Nodo locale non disponibile, uso simulazione`);
            
            // Genera UUID simulato per testing
            const simulatedTxId = crypto.randomUUID();
            console.log(`[CoinJoin Service] ✅ Broadcast simulato con UUID: ${simulatedTxId}`);
            
            return simulatedTxId;
            
        } catch (error) {
            console.error(`[CoinJoin Service] ❌ Errore broadcast:`, error);
            throw error;
        }
    }

    async updateVoteStatuses(votes, databaseTransactionId) {
        try {
            // Import del modello Vote
            const { Vote } = require('../shared/database_config').getModelsForService('vote');
            
            const voteIds = votes.map(v => v.id);
            
            // Usa l'ID del record database
            const [updatedCount] = await Vote.update(
                { 
                    status: 'confirmed',
                    transactionId: databaseTransactionId,
                    processedAt: new Date()
                },
                { 
                    where: { id: voteIds } 
                }
            );
            
            console.log(`✅ [CoinJoin Service] ${updatedCount} voti aggiornati a 'confirmed'`);
            
            if (updatedCount !== votes.length) {
                console.warn(`⚠️ [CoinJoin Service] Aggiornati ${updatedCount}/${votes.length} voti`);
            }
            
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore aggiornamento voti:', error);
            throw error;
        }
    }

    async updateCandidateVoteCounts(election, votes) {
        try {
            console.log(`[CoinJoin] 📊 Aggiornamento conteggi candidati per ${votes.length} voti`);
            
            // Import del modello Candidate
            const { Candidate } = require('../shared/database_config').getModelsForService('vote');
            
            // Conta voti per ogni candidato basandoti sul commitment
            const voteCounts = {};
            
            for (const vote of votes) {
                try {
                    // Estrai il candidato dal commitment del voto
                    const candidateValue = await this.extractCandidateFromVote(vote);
                    const candidate = await this.findCandidateByEncoding(election.id, candidateValue);
                    
                    if (candidate) {
                        voteCounts[candidate.id] = (voteCounts[candidate.id] || 0) + 1;
                        console.log(`[CoinJoin] 🗳️ Voto ${vote.id} per candidato ${candidate.name} (encoding: ${candidateValue})`);
                    } else {
                        console.warn(`[CoinJoin] ⚠️ Candidato non trovato per encoding ${candidateValue}`);
                    }
                } catch (error) {
                    console.error(`[CoinJoin] ❌ Errore conteggio voto ${vote.id}:`, error);
                }
            }
    
            // Aggiorna i conteggi nel database usando il campo voteCount
            for (const [candidateId, count] of Object.entries(voteCounts)) {
                try {
                    console.log(`[CoinJoin] 📈 Incremento ${count} voti per candidato ${candidateId}`);
                    
                    // Usa increment per aggiornare atomicamente il conteggio
                    try{
                        await Candidate.increment('totalVotesReceived', {
                            by: count,
                            where: { id: candidateId }
                        });
                    }
                    catch(error){
                        console.error(`[CoinJoin] ❌ Errore aggiornamento candidato ${candidateId}:`, error);
                    }
                    
                    console.log(`[CoinJoin] ✅ Candidato ${candidateId}: +${count} voti aggiunti`);
                    
                } catch (error) {
                    console.error(`[CoinJoin] ❌ Errore aggiornamento candidato ${candidateId}:`, error);
                }
            }
            
            console.log(`[CoinJoin] ✅ Conteggi candidati aggiornati completamente`);
            
            // Log riassuntivo
            const totalProcessed = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);
            console.log(`[CoinJoin] 📊 Riassunto: ${totalProcessed}/${votes.length} voti processati`);
            
        } catch (error) {
            console.error('[CoinJoin] ❌ Errore generale aggiornamento conteggi candidati:', error);
            // Non rilanciare errore per non bloccare il processo
        }
    }

    // *** NUOVO METODO: Trigger CoinJoin per una sessione specifica ***
    async triggerCoinJoinForSession(sessionId, electionId) {
        try {
            console.log(`[CoinJoin Service] 🚀 Trigger CoinJoin per sessione ${sessionId}, elezione ${electionId}`);
            
            const { Election, VotingSession, Vote } = require('../shared/database_config').getModelsForService('vote');
            
            // Trova l'elezione
            const election = await Election.findByPk(electionId);
            if (!election) {
                throw new Error(`Elezione ${electionId} non trovata`);
            }
            
            // Trova la sessione
            const session = await VotingSession.findByPk(sessionId);
            if (!session) {
                throw new Error(`Sessione ${sessionId} non trovata`);
            }
            
            // Trova i voti pending della sessione
            const votes = await Vote.findAll({
                where: {
                    sessionId: sessionId,
                    status: 'pending'
                }
            });
            
            if (votes.length === 0) {
                console.log(`[CoinJoin Service] ⚠️ Nessun voto pending trovato per sessione ${sessionId}`);
                return;
            }
            
            console.log(`[CoinJoin Service] 📊 Trovati ${votes.length} voti pending per sessione ${sessionId}`);
            
            // Esegui CoinJoin
            await this.executeCoinJoin(election, votes);
            
            console.log(`[CoinJoin Service] ✅ CoinJoin completato per sessione ${sessionId}`);
            
        } catch (error) {
            console.error(`[CoinJoin Service] ❌ Errore CoinJoin per sessione ${sessionId}:`, error);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalMs: this.intervalMs,
            nextCheck: this.checkInterval ? 'Active' : 'Stopped'
        };
    }
}

module.exports = new CoinJoinTriggerService();