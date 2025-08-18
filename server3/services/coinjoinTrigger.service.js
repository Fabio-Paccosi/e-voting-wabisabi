// server3/services/coinjoinTrigger.service.js - VERSIONE CORRETTA
const path = require('path');
const bitcoinjs = require('bitcoinjs-lib');
const axios = require('axios');
const crypto = require('crypto');

// Correzione: Importa Op da Sequelize
const { Op } = require('sequelize');

// Correzione: Usa il database_config locale
const {
    sequelize,
    User,                       
    Election,
    Candidate,
    VotingSession,
    Vote,
    Transaction,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('vote');

class CoinJoinTriggerService {
    constructor() {
        this.checkInterval = 30000; // Check ogni 30 secondi
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.checkLoop();
        console.log('✅ [CoinJoin Service] Servizio trigger avviato');
    }

    async checkLoop() {
        while (this.isRunning) {
            try {
                await this.checkPendingVotes();
            } catch (error) {
                console.error('❌ [CoinJoin Service] Errore nel check dei voti pendenti:', error);
            }
            
            await this.sleep(this.checkInterval);
        }
    }

    async checkPendingVotes() {
        try {
            // Trova elezioni attive con CoinJoin abilitato
            const activeElections = await Election.findAll({
                where: {
                    status: 'active',
                    coinjoinEnabled: true
                }
            });

            console.log(`📊 [CoinJoin Service] Controllo ${activeElections.length} elezioni attive`);

            for (const election of activeElections) {
                await this.processElectionVotes(election);
            }
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore query elezioni:', error);
        }
    }

    async processElectionVotes(election) {
        try {
            // Conta voti pendenti per questa elezione
            const pendingVotes = await Vote.count({
                where: {
                    status: 'pending'
                },
                include: [{
                    model: VotingSession,
                    as: 'session',
                    where: { electionId: election.id },
                    required: true
                }]
            });

            console.log(`📊 [CoinJoin Service] Elezione "${election.title}": ${pendingVotes}/${election.coinjoinTrigger} voti pendenti`);

            // Se abbiamo raggiunto il trigger, avvia CoinJoin
            if (pendingVotes >= election.coinjoinTrigger) {
                console.log(`🚀 [CoinJoin Service] Trigger raggiunto per elezione "${election.title}"!`);
                await this.executeCoinJoin(election);
            }
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore processamento voti:', error);
        }
    }

    async executeCoinJoin(election) {
        try {
            console.log(`🔄 [CoinJoin Service] Esecuzione CoinJoin per "${election.title}"`);

            // 1. Raccogli tutti i voti pendenti per questa elezione
            const pendingVotes = await Vote.findAll({
                where: { status: 'pending' },
                include: [{
                    model: VotingSession,
                    as: 'session',
                    where: { electionId: election.id },
                    required: true
                }]
            });

            if (pendingVotes.length === 0) {
                console.log('⚠️ [CoinJoin Service] Nessun voto pendente trovato');
                return;
            }

            // 2. Costruisci la transazione CoinJoin - METODO CORRETTO
            const coinjoinTx = await this.buildCoinJoinTransaction(election, pendingVotes);

            // 3. Broadcast della transazione
            const txId = await this.broadcastTransaction(coinjoinTx, election.blockchainNetwork);

            // 4. Aggiorna lo stato dei voti
            await this.updateVotesStatus(pendingVotes, txId);

            // 5. Salva la transazione nel database
            await Transaction.create({
                txId: txId,
                type: 'coinjoin',
                electionId: election.id,
                rawData: JSON.stringify(coinjoinTx),
                metadata: {
                    votesProcessed: pendingVotes.length,
                    outputsCount: coinjoinTx.outputs ? coinjoinTx.outputs.length : 0,
                    network: election.blockchainNetwork
                }
            });

            // 6. Notifica completamento
            await this.notifyCoinJoinCompletion(election, txId, pendingVotes.length);

            console.log(`✅ [CoinJoin Service] CoinJoin completato per "${election.title}"!`);

        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore durante CoinJoin:', error);
            throw error;
        }
    }

    // CORREZIONE: Implementazione del metodo mancante
    async buildCoinJoinTransaction(election, votes) {
        try {
            console.log(`[CoinJoin Service] Costruzione transazione per ${votes.length} voti`);

            // Aggrega i commitment per candidato
            const aggregatedCommitments = {};

            for (const vote of votes) {
                try {
                    let commitment;
                    
                    // Gestione sicura del parsing del commitment
                    if (typeof vote.commitment === 'string') {
                        if (vote.commitment.startsWith('{') || vote.commitment.startsWith('[')) {
                            try {
                                commitment = JSON.parse(vote.commitment);
                            } catch (parseError) {
                                console.error(`[CoinJoin] Errore parsing JSON per voto ${vote.id}:`, parseError);
                                commitment = { candidateValue: vote.commitment };
                            }
                        } else {
                            commitment = { candidateValue: vote.commitment };
                        }
                    } else if (typeof vote.commitment === 'object') {
                        commitment = vote.commitment;
                    } else {
                        console.error(`[CoinJoin] Tipo commitment non supportato per voto ${vote.id}:`, typeof vote.commitment);
                        continue;
                    }

                    // Estrai il valore del candidato - CORREZIONE per trovare candidati
                    let candidateValue = commitment.candidateValue || commitment.candidate;
                    
                    // Se non abbiamo un valore, prova a usare candidateEncoding 
                    if (!candidateValue && vote.candidateEncoding) {
                        candidateValue = vote.candidateEncoding;
                    }
                    
                    // Se ancora non abbiamo un valore, usa l'ID del voto come fallback
                    if (!candidateValue) {
                        candidateValue = `fallback_${vote.id}`;
                        console.warn(`[CoinJoin] Usando fallback per voto ${vote.id}`);
                    }

                    // Trova il candidato nell'elezione - CORREZIONE per candidati mancanti
                    const candidate = await this.findCandidateByEncoding(election.id, candidateValue);
                    
                    if (candidate) {
                        const candidateHash = candidate.bitcoinAddress || candidate.id;
                        aggregatedCommitments[candidateHash] = (aggregatedCommitments[candidateHash] || 0) + 1;
                        console.log(`[CoinJoin] Voto ${vote.id} processato per candidato ${candidate.name || candidateHash}`);
                    } else {
                        console.warn(`[CoinJoin] ⚠️ Candidato non trovato per encoding ${candidateValue}, usando valore diretto`);
                        aggregatedCommitments[candidateValue] = (aggregatedCommitments[candidateValue] || 0) + 1;
                    }
                    
                } catch (voteError) {
                    console.error(`[CoinJoin] Errore processamento voto ${vote.id}:`, voteError);
                    continue;
                }
            }

            console.log(`[CoinJoin] Aggregazione completata:`, aggregatedCommitments);

            // Costruisci la transazione Bitcoin simulata
            const outputs = Object.entries(aggregatedCommitments).map(([candidateId, voteCount]) => ({
                address: candidateId,
                value: voteCount * 100000, // Valore in satoshi
                scriptPubKey: this.addressToScriptPubKey(candidateId)
            }));

            const transaction = {
                version: 2,
                inputs: [], // In produzione, dovrebbero essere gli UTXO degli utenti
                outputs: outputs,
                lockTime: 0,
                timestamp: Date.now()
            };

            // Genera hash della transazione
            const txData = JSON.stringify(transaction);
            const txId = crypto.createHash('sha256').update(txData).digest('hex');

            return {
                txId,
                rawTx: txData,
                transaction,
                outputs
            };

        } catch (error) {
            console.error(`[CoinJoin] Errore costruzione transazione:`, error);
            throw error;
        }
    }

    // NUOVO: Metodo per trovare candidati con gestione degli errori - CORRETTO
    async findCandidateByEncoding(electionId, encoding) {
        try {
            // CORREZIONE: Cerca direttamente nel campo voteEncoding
            let candidate = await Candidate.findOne({
                where: {
                    electionId: electionId,
                    voteEncoding: parseInt(encoding) // Converte a numero se necessario
                }
            });

            // Se non trovato con voteEncoding, prova altri campi come fallback
            if (!candidate) {
                candidate = await Candidate.findOne({
                    where: {
                        electionId: electionId,
                        [Op.or]: [
                            { bitcoinAddress: encoding },
                            { id: encoding },
                            { name: encoding }
                        ]
                    }
                });
            }

            // Se ancora non trovato, prova mappatura per indice numerico
            if (!candidate && !isNaN(encoding)) {
                const allCandidates = await Candidate.findAll({
                    where: { electionId: electionId },
                    order: [['voteEncoding', 'ASC']]
                });

                const numericEncoding = parseInt(encoding);
                candidate = allCandidates.find(c => c.voteEncoding === numericEncoding);
            }

            return candidate;
        } catch (error) {
            console.error(`[CoinJoin] Errore ricerca candidato:`, error);
            return null;
        }
    }

    // Helper per convertire indirizzo in scriptPubKey (simulazione)
    addressToScriptPubKey(address) {
        return `scriptPubKey_${crypto.createHash('sha256').update(address).digest('hex').substring(0, 16)}`;
    }

    async broadcastTransaction(tx, network) {
        try {
            // CORREZIONE: Gestione migliorata del broadcast
            console.log(`📡 [CoinJoin Service] Broadcasting su ${network}...`);
            
            // Prova prima con il nodo Bitcoin locale (se disponibile)
            try {
                const rpcResult = await this.broadcastToLocalNode(tx, network);
                if (rpcResult) {
                    console.log(`✅ [CoinJoin Service] Broadcast locale riuscito: ${rpcResult}`);
                    return rpcResult;
                }
            } catch (rpcError) {
                console.log(`🔄 [CoinJoin Service] Nodo locale non disponibile, uso simulazione`);
            }

            // Fallback a simulazione
            const mockTxId = `tx_${network}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
            
            // Simula delay network
            await this.sleep(1000);
            
            console.log(`✅ [CoinJoin Service] Broadcast simulato: ${mockTxId}`);
            return mockTxId;
            
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore broadcast:', error);
            throw error;
        }
    }

    async broadcastToLocalNode(tx, network) {
        // Tentativo di connessione al nodo Bitcoin locale
        const rpcUrl = process.env.BITCOIN_RPC_URL || 'http://localhost:18332';
        
        try {
            const response = await axios.post(rpcUrl, {
                jsonrpc: '1.0',
                id: 'coinjoin',
                method: 'sendrawtransaction',
                params: [tx.rawTx]
            }, {
                timeout: 5000,
                auth: {
                    username: process.env.BITCOIN_RPC_USER || 'bitcoin',
                    password: process.env.BITCOIN_RPC_PASS || 'password'
                }
            });

            return response.data.result;
        } catch (error) {
            throw new Error(`RPC failed: ${error.message}`);
        }
    }

    async updateVotesStatus(votes, txId) {
        try {
            const updatePromises = votes.map(vote => 
                vote.update({
                    status: 'confirmed',
                    transactionId: txId,
                    confirmedAt: new Date()
                })
            );
            
            await Promise.all(updatePromises);
            console.log(`✅ [CoinJoin Service] Aggiornati ${votes.length} voti con txId: ${txId}`);
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore aggiornamento voti:', error);
            throw error;
        }
    }

    async notifyCoinJoinCompletion(election, txId, voteCount) {
        // Implementa notifiche (email, websocket, etc.)
        console.log(`📧 [CoinJoin Service] Notifica CoinJoin completato:`);
        console.log(`   - Elezione: ${election.title}`);
        console.log(`   - Transaction ID: ${txId}`);
        console.log(`   - Voti processati: ${voteCount}`);
        console.log(`   - Network: ${election.blockchainNetwork}`);
        
        // TODO: Implementare invio email/notifiche push
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.isRunning = false;
        console.log('⏹️ [CoinJoin Service] Servizio fermato');
    }

    // Getter per verificare lo stato del servizio
    get status() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval
        };
    }
}

// Export singleton
module.exports = new CoinJoinTriggerService();