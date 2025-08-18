// server3/services/coinjoinTrigger.service.js - FIXED VERSION
const path = require('path');
const bitcoinjs = require('bitcoinjs-lib');
const axios = require('axios');

// CORREZIONE: Usa il database_config locale invece del percorso assoluto
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

            // 2. Costruisci la transazione CoinJoin
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
                rawData: coinjoinTx.toHex(),
                metadata: {
                    votesProcessed: pendingVotes.length,
                    outputs: coinjoinTx.outputs.length,
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

    async buildCoinJoinTransaction(election, votes) {
        try {
            console.log(`[CoinJoin Service] Costruzione transazione per ${votes.length} voti`);
    
            const aggregatedCommitments = {};
            
            for (const vote of votes) {
                try {
                    let commitment;
                    
                    // Gestione sicura del parsing del commitment
                    if (typeof vote.commitment === 'string') {
                        // Verifica se è un JSON valido
                        if (vote.commitment.startsWith('{') || vote.commitment.startsWith('[')) {
                            try {
                                commitment = JSON.parse(vote.commitment);
                            } catch (parseError) {
                                console.error(`[CoinJoin] Errore parsing JSON per voto ${vote.id}:`, parseError);
                                console.log(`[CoinJoin] Commitment raw:`, vote.commitment);
                                
                                // Fallback: tratta come commitment semplice
                                commitment = { candidateValue: vote.commitment };
                            }
                        } else {
                            // Commitment è una stringa semplice, non JSON
                            commitment = { candidateValue: vote.commitment };
                        }
                    } else if (typeof vote.commitment === 'object') {
                        // Commitment è già un oggetto
                        commitment = vote.commitment;
                    } else {
                        console.error(`[CoinJoin] Tipo commitment non supportato per voto ${vote.id}:`, typeof vote.commitment);
                        continue;
                    }
    
                    const candidateValue = commitment.candidateValue || commitment.candidate || 0;
                    
                    aggregatedCommitments[candidateValue] = (aggregatedCommitments[candidateValue] || 0) + 1;
                    
                    console.log(`[CoinJoin] Voto ${vote.id} processato per candidato ${candidateValue}`);
                    
                } catch (voteError) {
                    console.error(`[CoinJoin] Errore processamento voto ${vote.id}:`, voteError);
                    continue;
                }
            }
    
            console.log(`[CoinJoin] Aggregazione completata:`, aggregatedCommitments);
    
            // Continua con la costruzione della transazione...
            return await this.buildBitcoinTransaction(election, aggregatedCommitments);
    
        } catch (error) {
            console.error(`[CoinJoin] Errore costruzione transazione:`, error);
            throw error;
        }
    }
    
    // Funzione helper per validare il formato del commitment
    validateCommitment(commitment) {
        if (typeof commitment === 'string') {
            // Se è una stringa, verifica se è JSON valido
            try {
                const parsed = JSON.parse(commitment);
                return { valid: true, data: parsed };
            } catch (e) {
                // Non è JSON, trattalo come valore semplice
                return { valid: true, data: { candidateValue: commitment } };
            }
        } else if (typeof commitment === 'object' && commitment !== null) {
            return { valid: true, data: commitment };
        }
        
        return { valid: false, error: 'Formato commitment non valido' };
    }

    async broadcastTransaction(tx, network) {
        try {
            // In produzione, implementare broadcast reale
            // Per ora simuliamo con un ID fittizio
            const mockTxId = `tx_${network}_${Date.now().toString(36)}`;
            
            console.log(`📡 [CoinJoin Service] Broadcasting su ${network}: ${mockTxId}`);
            
            // Simula delay network
            await this.sleep(2000);
            
            return mockTxId;
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore broadcast:', error);
            throw error;
        }
    }

    async updateVotesStatus(votes, txId) {
        const updatePromises = votes.map(vote => 
            vote.update({
                status: 'confirmed',
                transactionId: txId,
                confirmedAt: new Date()
            })
        );
        
        await Promise.all(updatePromises);
        console.log(`✅ [CoinJoin Service] Aggiornati ${votes.length} voti con txId: ${txId}`);
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