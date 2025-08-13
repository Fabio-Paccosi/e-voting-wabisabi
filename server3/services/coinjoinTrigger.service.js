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
            console.log(`🔨 [CoinJoin Service] Costruzione transazione per ${votes.length} voti`);

            // Raggruppa i commitment per candidato
            const aggregatedCommitments = {};
            
            for (const vote of votes) {
                // Decodifica il commitment (assumiamo sia JSON)
                const commitment = JSON.parse(vote.commitment);
                const candidateValue = commitment.candidateValue || 0;
                
                aggregatedCommitments[candidateValue] = (aggregatedCommitments[candidateValue] || 0) + 1;
            }

            // Ottieni candidati dell'elezione
            const candidates = await Candidate.findAll({
                where: { electionId: election.id }
            });

            // Determina la rete Bitcoin
            const network = election.blockchainNetwork === 'mainnet' 
                ? bitcoinjs.networks.bitcoin 
                : bitcoinjs.networks.testnet;

            // Per ora restituiamo una transazione mock
            // In produzione, costruire vera transazione Bitcoin
            const mockTx = {
                network: election.blockchainNetwork,
                inputs: votes.length,
                outputs: [],
                toHex: () => `mock_tx_${Date.now()}`
            };

            // Aggiungi output per ogni candidato con voti
            for (const candidate of candidates) {
                const voteCount = aggregatedCommitments[candidate.valueEncoding] || 0;
                if (voteCount > 0) {
                    mockTx.outputs.push({
                        address: candidate.bitcoinAddress,
                        votes: voteCount,
                        candidateId: candidate.id
                    });
                }
            }

            console.log(`🔨 [CoinJoin Service] Transazione costruita con ${mockTx.outputs.length} output`);
            return mockTx;
        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore costruzione transazione:', error);
            throw error;
        }
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