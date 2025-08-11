// server3/services/coinjoinTrigger.service.js
const path = require('path');
const bitcoinjs = require('bitcoinjs-lib');
const axios = require('axios');

// Importa i modelli dal percorso corretto
// Assumendo che database/models/index.js sia nella root del progetto
const modelsPath = path.join(__dirname, '../../../database/models');
const { Vote, VotingSession, Election, Transaction, Candidate } = require(modelsPath);

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
                console.log(`🚀 [CoinJoin Service] Trigger raggiunto per elezione "${election.title}"! Avvio CoinJoin...`);
                await this.initiateCoinJoin(election);
            }
        } catch (error) {
            console.error(`❌ [CoinJoin Service] Errore processamento elezione ${election.id}:`, error);
        }
    }

    async initiateCoinJoin(election) {
        let session = null;
        
        try {
            // Crea nuova sessione di voting
            session = await VotingSession.create({
                electionId: election.id,
                status: 'aggregating',
                startTime: new Date(),
                metadata: {
                    triggerThreshold: election.coinjoinTrigger,
                    network: election.blockchainNetwork
                }
            });

            console.log(`📝 [CoinJoin Service] Creata sessione ${session.id}`);

            // Recupera tutti i voti pendenti con lock per evitare race conditions
            const votes = await Vote.findAll({
                where: { status: 'pending' },
                include: [{
                    model: VotingSession,
                    as: 'session',
                    where: { electionId: election.id },
                    required: true
                }],
                lock: true
            });

            if (votes.length === 0) {
                console.log('⚠️ [CoinJoin Service] Nessun voto pendente trovato');
                await session.update({ status: 'failed' });
                return;
            }

            console.log(`🔢 [CoinJoin Service] Aggregazione di ${votes.length} voti`);

            // Aggrega i commitment per candidato
            const aggregatedCommitments = await this.aggregateCommitments(votes);

            // Recupera i candidati
            const candidates = await Candidate.findAll({
                where: { electionId: election.id }
            });

            // Costruisci transazione CoinJoin
            const coinjoinTx = await this.buildCoinJoinTransaction(
                election,
                votes,
                aggregatedCommitments,
                candidates
            );

            // Broadcast alla rete Bitcoin
            const txId = await this.broadcastTransaction(coinjoinTx, election.blockchainNetwork);

            // Aggiorna stato voti e sessione
            await this.updateVotesStatus(votes, txId);
            await session.update({
                status: 'completed',
                endTime: new Date(),
                transactionId: txId,
                metadata: {
                    ...session.metadata,
                    votesProcessed: votes.length,
                    txId: txId
                }
            });

            // Registra transazione
            await Transaction.create({
                electionId: election.id,
                sessionId: session.id,
                txId,
                type: 'coinjoin',
                rawData: coinjoinTx.toHex ? coinjoinTx.toHex() : JSON.stringify(coinjoinTx),
                metadata: {
                    voteCount: votes.length,
                    aggregatedCommitments,
                    timestamp: new Date().toISOString()
                },
                status: 'broadcasted'
            });

            console.log(`✅ [CoinJoin Service] CoinJoin completato! TxID: ${txId}`);
            
            // Notifica admin e utenti
            await this.notifyCoinJoinCompletion(election, txId, votes.length);

        } catch (error) {
            console.error('❌ [CoinJoin Service] Errore durante CoinJoin:', error);
            
            if (session) {
                await session.update({
                    status: 'failed',
                    endTime: new Date(),
                    metadata: {
                        ...session.metadata,
                        error: error.message
                    }
                });
            }
            
            throw error;
        }
    }

    async aggregateCommitments(votes) {
        // Implementa aggregazione omomorfica dei commitment
        const aggregated = {};
        
        for (const vote of votes) {
            // Assumendo che il commitment contenga il valore del candidato
            const candidateValue = vote.commitment?.candidateValue || vote.metadata?.candidateValue || 0;
            
            if (!aggregated[candidateValue]) {
                aggregated[candidateValue] = 0;
            }
            
            // Somma semplice per ora (in produzione usare aggregazione omomorfica vera)
            aggregated[candidateValue] += 1;
        }
        
        console.log(`📊 [CoinJoin Service] Risultati aggregati:`, aggregated);
        return aggregated;
    }

    async buildCoinJoinTransaction(election, votes, aggregatedCommitments, candidates) {
        try {
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
}

// Export singleton
module.exports = new CoinJoinTriggerService();