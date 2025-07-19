// server3/app.js
// Server 3: Users Vote Processing & Blockchain Node

const express = require('express');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());

// Configurazione Bitcoin
const BITCOIN_NETWORK = process.env.BITCOIN_NETWORK === 'mainnet' 
    ? bitcoin.networks.bitcoin 
    : bitcoin.networks.testnet;

// URL del nodo Bitcoin (Electrum o Bitcoin Core)
const BITCOIN_NODE_URL = process.env.BITCOIN_NODE_URL || 'http://localhost:8332';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER || 'user';
const BITCOIN_RPC_PASS = process.env.BITCOIN_RPC_PASS || 'pass';

// ====================
// SIMULAZIONE DATABASE
// ====================
const db = {
    votes: new Map(),
    transactions: new Map(),
    votingSessions: new Map()
};

// ====================
// VOTE PROCESSOR
// ====================
class VoteProcessor {
    constructor() {
        this.processedSerials = new Set(); // Per prevenire double-voting
        this.pendingCommitments = new Map(); // Commitments in attesa di aggregazione
    }

    // Processa un voto anonimo
    async processVote(voteData) {
        const { commitment, zkProof, serialNumber } = voteData;

        // Verifica che il serial number non sia già stato usato
        if (this.processedSerials.has(serialNumber)) {
            throw new Error('Serial number già utilizzato - doppio voto rilevato');
        }

        // Verifica il commitment omomorfico
        if (!this.verifyCommitment(commitment)) {
            throw new Error('Commitment non valido');
        }

        // Verifica la zero-knowledge proof
        if (!this.verifyZKProof(zkProof, commitment)) {
            throw new Error('Zero-knowledge proof non valida');
        }

        // Salva il voto
        const voteId = uuidv4();
        const vote = {
            id: voteId,
            serialNumber,
            commitment,
            status: 'pending',
            transactionId: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        db.votes.set(voteId, vote);
        this.processedSerials.add(serialNumber);
        this.pendingCommitments.set(voteId, commitment);

        return voteId;
    }

    // Verifica un commitment omomorfico (Pedersen commitment)
    verifyCommitment(commitment) {
        try {
            // Verifica struttura base del commitment
            if (!commitment.value || !commitment.blinding) {
                return false;
            }

            // In un'implementazione reale, verificheremmo che:
            // C = g^v * h^r (dove v è il valore, r è il blinding factor)
            // Per ora, verifica solo che i valori siano nel formato corretto
            const valueBuffer = Buffer.from(commitment.value, 'hex');
            const blindingBuffer = Buffer.from(commitment.blinding, 'hex');

            return valueBuffer.length === 32 && blindingBuffer.length === 32;
        } catch (error) {
            console.error('Errore verifica commitment:', error);
            return false;
        }
    }

    // Verifica una zero-knowledge proof
    verifyZKProof(zkProof, commitment) {
        try {
            // Verifica che la proof dimostri che il voto è valido (0 o 1)
            // senza rivelare il valore effettivo
            
            if (!zkProof.challenge || !zkProof.response) {
                return false;
            }

            // In un'implementazione reale, verificheremmo:
            // 1. Che il commitment contenga un valore valido (0 o 1)
            // 2. Che la proof sia corretta rispetto al commitment
            // Usando il protocollo Schnorr o simile

            // Per ora, verifica simulata
            const challenge = Buffer.from(zkProof.challenge, 'hex');
            const response = Buffer.from(zkProof.response, 'hex');

            return challenge.length === 32 && response.length === 32;
        } catch (error) {
            console.error('Errore verifica ZK proof:', error);
            return false;
        }
    }

    // Aggrega i commitment omomorficamente per il conteggio
    aggregateCommitments(commitments) {
        // In crittografia omomorfica, possiamo sommare i commitment
        // senza conoscere i valori sottostanti
        
        // C_total = C1 * C2 * ... * Cn (moltiplicazione su curva ellittica)
        // che corrisponde a v_total = v1 + v2 + ... + vn

        // Simulazione dell'aggregazione
        let totalValue = BigInt(0);
        let totalBlinding = BigInt(0);

        commitments.forEach(commitment => {
            // In produzione, useremmo operazioni su curva ellittica
            totalValue += BigInt('0x' + commitment.value);
            totalBlinding += BigInt('0x' + commitment.blinding);
        });

        return {
            aggregatedValue: totalValue.toString(16),
            aggregatedBlinding: totalBlinding.toString(16),
            voteCount: commitments.length
        };
    }

    // Conta i voti dopo la chiusura
    async countVotes(sessionId) {
        const votes = [];
        for (const [voteId, vote] of db.votes) {
            if (vote.sessionId === sessionId && vote.status === 'confirmed') {
                votes.push(vote);
            }
        }

        // Separa i commitment per candidato (basandosi su qualche criterio)
        // In pratica, ogni commitment dovrebbe indicare per quale candidato è
        const commitmentsByCandidate = this.separateCommitmentsByCandidate(votes);

        // Aggrega i commitment per ogni candidato
        const results = {};
        for (const [candidateId, commitments] of Object.entries(commitmentsByCandidate)) {
            results[candidateId] = this.aggregateCommitments(commitments);
        }

        return results;
    }

    // Separa i commitment per candidato (implementazione semplificata)
    separateCommitmentsByCandidate(votes) {
        // In un sistema reale, useremmo qualche meccanismo crittografico
        // per determinare a quale candidato appartiene ogni voto
        // mantenendo l'anonimato

        const candidateCommitments = {
            'candidate_0': [], // John
            'candidate_1': []  // Jane
        };

        votes.forEach(vote => {
            // Determina il candidato basandosi su qualche proprietà del commitment
            // (in produzione, questo sarebbe fatto crittograficamente)
            const candidateIndex = parseInt(vote.commitment.value.slice(-1), 16) % 2;
            const candidateKey = `candidate_${candidateIndex}`;
            candidateCommitments[candidateKey].push(vote.commitment);
        });

        return candidateCommitments;
    }
}

// ====================
// TRANSACTION MANAGER
// ====================
class TransactionManager {
    constructor() {
        this.feeRate = 10; // satoshi per byte
    }

    // Crea una transazione CoinJoin per un batch di voti
    async createCoinJoinTransaction(votes) {
        try {
            // Crea una nuova transazione
            const psbt = new bitcoin.Psbt({ network: BITCOIN_NETWORK });

            // Aggiungi input per ogni voto (UTXO riservati)
            for (const vote of votes) {
                // In produzione, recupereremmo gli UTXO reali dal wallet dell'utente
                const input = {
                    hash: crypto.randomBytes(32), // Transaction hash simulato
                    index: 0,
                    witnessUtxo: {
                        script: Buffer.from('001404...', 'hex'), // Script simulato
                        value: 100000 // 0.001 BTC in satoshi
                    }
                };
                psbt.addInput(input);
            }

            // Aggiungi output per la transazione di voto
            // Un output per l'OP_RETURN con i dati aggregati dei voti
            const voteData = this.encodeVoteData(votes);
            const opReturnScript = bitcoin.script.compile([
                bitcoin.opcodes.OP_RETURN,
                voteData
            ]);

            psbt.addOutput({
                script: opReturnScript,
                value: 0
            });

            // Aggiungi output per il change (ritorno dei fondi meno le fee)
            const totalInput = votes.length * 100000; // 0.001 BTC per voto
            const fee = this.calculateFee(psbt);
            const changeAmount = totalInput - fee;

            // Indirizzo di change (in produzione, uno per ogni partecipante)
            const changeAddress = this.generateChangeAddress();
            psbt.addOutput({
                address: changeAddress,
                value: changeAmount
            });

            return {
                psbt: psbt.toBase64(),
                fee,
                inputCount: votes.length,
                outputCount: 2
            };
        } catch (error) {
            console.error('Errore creazione CoinJoin:', error);
            throw error;
        }
    }

    // Codifica i dati dei voti per l'OP_RETURN
    encodeVoteData(votes) {
        // Crea un hash dei commitment aggregati
        const hasher = crypto.createHash('sha256');
        
        votes.forEach(vote => {
            hasher.update(vote.commitment.value);
        });

        const dataHash = hasher.digest();
        
        // Aggiungi metadati
        const metadata = Buffer.from(JSON.stringify({
            version: 1,
            voteCount: votes.length,
            timestamp: Date.now()
        }));

        // Combina hash e metadati (max 80 bytes per OP_RETURN)
        return Buffer.concat([dataHash, metadata.slice(0, 48)]);
    }

    // Calcola le fee della transazione
    calculateFee(psbt) {
        // Stima dimensione transazione (circa)
        const inputSize = 148 * psbt.inputCount;
        const outputSize = 34 * psbt.outputCount;
        const overheadSize = 10;
        const totalSize = inputSize + outputSize + overheadSize;

        return totalSize * this.feeRate;
    }

    // Genera un indirizzo di change
    generateChangeAddress() {
        const keyPair = bitcoin.ECPair.makeRandom({ network: BITCOIN_NETWORK });
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: BITCOIN_NETWORK
        });
        return address;
    }

    // Firma e trasmette la transazione
    async signAndBroadcastTransaction(psbtBase64, signatures) {
        try {
            const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: BITCOIN_NETWORK });

            // Applica le firme (in produzione, ogni partecipante firma il proprio input)
            signatures.forEach((signature, index) => {
                // Simulazione della firma
                psbt.signInput(index, bitcoin.ECPair.makeRandom({ network: BITCOIN_NETWORK }));
            });

            // Finalizza la transazione
            psbt.finalizeAllInputs();
            const transaction = psbt.extractTransaction();
            const txHex = transaction.toHex();

            // Trasmetti alla rete Bitcoin
            const txId = await this.broadcastTransaction(txHex);

            return {
                txId,
                txHex,
                success: true
            };
        } catch (error) {
            console.error('Errore firma/broadcast:', error);
            throw error;
        }
    }

    // Trasmette la transazione alla rete Bitcoin
    async broadcastTransaction(txHex) {
        try {
            // In produzione, invieremmo al nodo Bitcoin reale
            // usando RPC o API Electrum
            
            if (process.env.NODE_ENV === 'production') {
                const response = await axios.post(
                    BITCOIN_NODE_URL,
                    {
                        jsonrpc: '2.0',
                        method: 'sendrawtransaction',
                        params: [txHex],
                        id: 1
                    },
                    {
                        auth: {
                            username: BITCOIN_RPC_USER,
                            password: BITCOIN_RPC_PASS
                        }
                    }
                );
                return response.data.result;
            } else {
                // Simulazione per sviluppo
                return crypto.randomBytes(32).toString('hex');
            }
        } catch (error) {
            console.error('Errore broadcast transazione:', error);
            throw error;
        }
    }

    // Monitora lo stato di una transazione
    async getTransactionStatus(txId) {
        try {
            // In produzione, interrogheremmo il nodo Bitcoin
            if (process.env.NODE_ENV === 'production') {
                const response = await axios.post(
                    BITCOIN_NODE_URL,
                    {
                        jsonrpc: '2.0',
                        method: 'gettransaction',
                        params: [txId],
                        id: 1
                    },
                    {
                        auth: {
                            username: BITCOIN_RPC_USER,
                            password: BITCOIN_RPC_PASS
                        }
                    }
                );
                
                const tx = response.data.result;
                return {
                    confirmations: tx.confirmations || 0,
                    blockHash: tx.blockhash || null,
                    status: tx.confirmations > 0 ? 'confirmed' : 'pending'
                };
            } else {
                // Simulazione
                return {
                    confirmations: Math.floor(Math.random() * 6),
                    blockHash: crypto.randomBytes(32).toString('hex'),
                    status: Math.random() > 0.5 ? 'confirmed' : 'pending'
                };
            }
        } catch (error) {
            console.error('Errore verifica transazione:', error);
            throw error;
        }
    }
}

// Istanzia i servizi
const voteProcessor = new VoteProcessor();
const transactionManager = new TransactionManager();

// ====================
// API ROUTES
// ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'vote-blockchain',
        network: BITCOIN_NETWORK === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet',
        timestamp: new Date().toISOString()
    });
});

// Processa un voto
app.post('/api/vote/process', async (req, res) => {
    try {
        const voteId = await voteProcessor.processVote(req.body);
        res.json({
            success: true,
            voteId,
            message: 'Voto processato con successo'
        });
    } catch (error) {
        console.error('Errore processamento voto:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Crea una transazione CoinJoin
app.post('/api/coinjoin/create', async (req, res) => {
    try {
        const { sessionId, votes } = req.body;

        // Crea la transazione CoinJoin
        const transaction = await transactionManager.createCoinJoinTransaction(votes);

        // Salva la transazione
        const txId = uuidv4();
        db.transactions.set(txId, {
            id: txId,
            sessionId,
            voteCount: votes.length,
            psbt: transaction.psbt,
            status: 'created',
            createdAt: new Date()
        });

        res.json({
            success: true,
            transactionId: txId,
            transaction,
            message: 'Transazione CoinJoin creata'
        });
    } catch (error) {
        console.error('Errore creazione CoinJoin:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Firma e trasmette una transazione
app.post('/api/transaction/broadcast', async (req, res) => {
    try {
        const { transactionId, signatures } = req.body;
        
        const transaction = db.transactions.get(transactionId);
        if (!transaction) {
            return res.status(404).json({ error: 'Transazione non trovata' });
        }

        const result = await transactionManager.signAndBroadcastTransaction(
            transaction.psbt,
            signatures
        );

        // Aggiorna lo stato della transazione
        transaction.txId = result.txId;
        transaction.status = 'broadcasted';
        transaction.broadcastedAt = new Date();

        res.json({
            success: true,
            ...result,
            message: 'Transazione trasmessa con successo'
        });
    } catch (error) {
        console.error('Errore broadcast transazione:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verifica lo stato di una transazione
app.get('/api/transaction/:txId/status', async (req, res) => {
    try {
        const status = await transactionManager.getTransactionStatus(req.params.txId);
        res.json({
            success: true,
            txId: req.params.txId,
            ...status
        });
    } catch (error) {
        console.error('Errore verifica stato:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Conta i voti per una sessione
app.get('/api/voting/session/:sessionId/count', async (req, res) => {
    try {
        const results = await voteProcessor.countVotes(req.params.sessionId);
        res.json({
            success: true,
            sessionId: req.params.sessionId,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Errore conteggio voti:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Informazioni sul nodo Bitcoin
app.get('/api/bitcoin/info', async (req, res) => {
    try {
        // In produzione, recupereremmo info dal nodo Bitcoin
        const info = {
            network: BITCOIN_NETWORK === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet',
            blockHeight: 820000, // Simulato
            connected: true,
            version: '0.21.0'
        };

        res.json({
            success: true,
            ...info
        });
    } catch (error) {
        console.error('Errore info Bitcoin:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Gestione errori globale
app.use((err, req, res, next) => {
    console.error('Errore non gestito:', err);
    res.status(500).json({
        error: 'Si è verificato un errore interno del server',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Avvio del server
app.listen(PORT, () => {
    console.log(`Server 3 (Vote Processing & Blockchain) in ascolto sulla porta ${PORT}`);
    console.log(`Rete Bitcoin: ${BITCOIN_NETWORK === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet'}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, voteProcessor, transactionManager };