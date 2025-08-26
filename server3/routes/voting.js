const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { randomBytes, createHash, createHmac } = require('crypto');

// Import dei modelli dal database_config.js
const {
    sequelize,
    User,                       
    Election,
    ElectionWhitelist,
    Candidate,
    Credential,
    VotingSession,
    Vote,
    Transaction,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('vote');

// Import servizi
const CoinJoinService = require('../services/CoinJoinService');
const WabiSabiKVACService = require('../services/WabiSabiKVACService');
const BitcoinService = require('../services/BitcoinService');

// Middleware per estrarre informazioni utente dagli header
const extractUserFromHeaders = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];
    
    if (!userId) {
        return res.status(401).json({ error: 'Header utente mancante' });
    }
    
    req.user = { id: userId, email: userEmail };
    next();
};

// Configurazione WabiSabi
const WABISABI_CONFIG = {
    COINJOIN_THRESHOLD: 2, // Minimo voti per trigger CoinJoin
    CREDENTIAL_EXPIRY: 3600000, // 1 ora in millisecondi
    MAX_VOTING_SESSIONS: 10, // Massimo sessioni attive per elezione
    NETWORK: process.env.BITCOIN_NETWORK || 'testnet'
};

// POST /api/voting/address - Genera indirizzo Bitcoin per sessione di voto
router.post('/address', extractUserFromHeaders, async (req, res) => {
    try {
        const { userId, electionId, bitcoinAddress, publicKey } = req.body;
        const requestUserId = req.user.id;

        console.log(`[VOTING] 🪙 Richiesta indirizzo Bitcoin per utente ${requestUserId}, elezione ${electionId}`);

        // Verifica autorizzazione
        if (userId !== requestUserId) {
            return res.status(403).json({ error: 'Utente non autorizzato' });
        }

        // Verifica che l'elezione esista e sia attiva
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        if (election.status !== 'active' || !election.isActive) {
            return res.status(400).json({ error: 'Elezione non attiva' });
        }

        // Verifica che l'utente sia in whitelist e non abbia già votato
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { userId, electionId }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ error: 'Utente non autorizzato per questa elezione' });
        }

        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ error: 'Utente ha già votato' });
        }

        // Trova o crea sessione di voto attiva
        let votingSession = await VotingSession.findOne({
            where: {
                electionId,
                status: ['preparing', 'input_registration']
            }
        });

        if (!votingSession) {
            // Crea nuova sessione di voto
            votingSession = await VotingSession.create({
                electionId,
                startTime: new Date(),
                status: 'input_registration',
                transactionCount: 0
            });
            console.log(`[VOTING] 🆕 Nuova sessione di voto creata: ${votingSession.id}`);
        }

        // Verifica che l'indirizzo Bitcoin sia valido
        if (!BitcoinService.isValidAddress(bitcoinAddress, WABISABI_CONFIG.NETWORK)) {
            return res.status(400).json({ error: 'Indirizzo Bitcoin non valido' });
        }

        // Registra l'indirizzo per questa sessione
        const addressRecord = {
            sessionId: votingSession.id,
            userId,
            bitcoinAddress,
            publicKey,
            registeredAt: new Date()
        };

        // TODO: Salvare nel database (tabella user_addresses o simile)
        console.log(`[VOTING]  Indirizzo registrato per sessione ${votingSession.id}`);

        res.json({
            success: true,
            sessionId: votingSession.id,
            bitcoinAddress,
            publicKey,
            status: 'address_registered',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[VOTING]  Errore generazione indirizzo:', error);
        res.status(500).json({ 
            error: 'Errore nella generazione dell\'indirizzo Bitcoin',
            details: error.message 
        });
    }
});

// POST /api/voting/credentials - Richiesta credenziali KVAC
router.post('/credentials', extractUserFromHeaders, async (req, res) => {
    try {
        const { userId, electionId, nonce } = req.body;
        const requestUserId = req.user.id;

        console.log(`[VOTING] 🔐 Richiesta credenziali KVAC per utente ${requestUserId}, elezione ${electionId}`);

        // Verifica autorizzazione
        if (userId !== requestUserId) {
            return res.status(403).json({ error: 'Utente non autorizzato' });
        }

        // Verifica che l'utente sia autorizzato per l'elezione
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { userId, electionId }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ error: 'Utente non in whitelist per questa elezione' });
        }

        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ error: 'Utente ha già votato' });
        }

        /*
        // Verifica che non esistano già credenziali non usate per questo utente/elezione
        const existingCredential = await Credential.findOne({
            where: {
                user_id: userId,
                is_used: false,
                created_at: {
                    [require('sequelize').Op.gt]: new Date(Date.now() - WABISABI_CONFIG.CREDENTIAL_EXPIRY)
                }
            }
        });

        if (existingCredential) {
            console.log(`[VOTING] ♻️ Riutilizzo credenziali esistenti per utente ${userId}`);
            return res.json({
                success: true,
                credentialId: existingCredential.id,
                serialNumber: existingCredential.serial_number,
                signature: existingCredential.signature,
                nonce: existingCredential.nonce,
                issuedAt: existingCredential.issued_at,
                expiresAt: new Date(existingCredential.created_at.getTime() + WABISABI_CONFIG.CREDENTIAL_EXPIRY)
            });
        }
        */

        // Genera nuove credenziali KVAC
        const credentialData = await WabiSabiKVACService.generateCredentials({
            user_id: userId,        
            electionId,
            nonce,
            userEmail: req.user.email
        });

        // Salva nel database
        const credential = await Credential.create({
            user_id: userId,        
            serial_number: credentialData.serialNumber,  
            nonce,
            signature: credentialData.signature,
            is_used: false,         
            issued_at: new Date()  
        });

        console.log(`[VOTING]  Credenziali KVAC generate: ${credential.id}`);

        res.json({
            success: true,
            credentialId: credential.id,
            serialNumber: credential.serial_number,
            signature: credential.signature,
            nonce: credential.nonce,
            issuedAt: credential.issued_at,
            expiresAt: new Date(credential.created_at.getTime() + WABISABI_CONFIG.CREDENTIAL_EXPIRY)
        });

    } catch (error) {
        console.error('[VOTING]  Errore generazione credenziali:', error);
        res.status(500).json({ 
            error: 'Errore nella generazione delle credenziali',
            details: error.message 
        });
    }
});

// POST /api/voting/submit - Invio voto anonimo
router.post('/submit', async (req, res) => {
    try {
        const { electionId, commitment, zkProof, serialNumber, bitcoinAddress } = req.body;
        
        // 1.   usa camelCase
        const election = await Election.findByPk(electionId);
        if (!election || election.status !== 'active') {
            return res.status(400).json({ error: 'Elezione non attiva' });
        }

        // 2.   usa camelCase
        const credential = await Credential.findOne({
            where: { 
                serial_number: serialNumber  
            }
        });

        if (!credential) {
            return res.status(400).json({ error: 'Credenziale non valida' });
        }

        if (credential.isUsed) { 
            return res.status(400).json({ error: 'Credenziale già utilizzata' });
        }

        // 3. Verifica credenziale età
        const credentialAge = Date.now() - credential.created_at.getTime();
        if (credentialAge > WABISABI_CONFIG.CREDENTIAL_EXPIRY) {
            return res.status(400).json({ error: 'Credenziale scaduta' });
        }

        // 4. Verifica ZK proof (già funzionante)
        const zkVerification = await WabiSabiKVACService.verifyZKProof({
            zkProof,
            commitment,
            serialNumber,
            electionId
        });

        if (!zkVerification.valid) {
            return res.status(400).json({ error: 'Zero-knowledge proof non valido' });
        }

        // 5.   trova sessione con camelCase
        let votingSession = await VotingSession.findOne({
            where: {
                election_id: electionId, 
                status: ['input_registration', 'output_registration']
            }
        });

        if (!votingSession) {
            return res.status(500).json({ error: 'Nessuna sessione di voto attiva' });
        }

        // 6. Crea voto con camelCase
        const vote = await Vote.create({
            sessionId: votingSession.id,    
            serialNumber: serialNumber,   
            commitment,
            status: 'pending',
            submittedAt: new Date()   
        });

        // 7. marca credenziale come usata
        await credential.update({
            isUsed: true,          
            usedAt: new Date()   
        });

        // 8. marca utente come votato
        await ElectionWhitelist.update(
            { 
                hasVoted: true,     
                votedAt: new Date()  
            },
            { 
                where: { 
                    userId: credential.user_id,   
                    electionId: electionId      
                } 
            }
        );

        // 9. conteggio voti pending
        const pendingVotes = await Vote.count({
            where: {
                sessionId: votingSession.id,  //  camelCase
                status: 'pending'
            }
        });

        console.log(`[VOTING]  Voti pending in sessione ${votingSession.id}: ${pendingVotes}`);

        if (pendingVotes >= WABISABI_CONFIG.COINJOIN_THRESHOLD) {
            console.log(`[VOTING] Soglia CoinJoin raggiunta, avvio aggregazione...`);
            
            // Trigger CoinJoin in background
            CoinJoinService.triggerCoinJoin(votingSession.id, electionId)
                .catch(error => {
                    console.error(`[VOTING]  Errore CoinJoin per sessione ${votingSession.id}:`, error);
                });
        }

        console.log(`[VOTING]  Voto anonimo registrato: ${vote.id}`);

        res.json({
            success: true,
            voteId: vote.id,
            sessionId: votingSession.id,
            status: 'submitted',
            message: 'Voto ricevuto e in elaborazione',
            pendingVotes,
            coinjoinTriggered: pendingVotes >= WABISABI_CONFIG.COINJOIN_THRESHOLD,
            estimatedConfirmationTime: '5-15 minuti'
        });

    } catch (error) {
        console.error('[VOTING]  Errore invio voto:', error);
        res.status(500).json({ 
            error: 'Errore nell\'invio del voto',
            details: error.message 
        });
    }
});

// GET /api/voting/status/:voteId - Controllo stato voto
router.get('/status/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;

        console.log(`[VOTING] 📋 Controllo stato voto ${voteId}`);

        // CORREZIONE: Usa l'alias corretto e evita accesso diretto a createdAt
        const vote = await Vote.findByPk(voteId, {
            include: [
                {
                    model: VotingSession,
                    as: 'votingSession', 
                    include: [
                        {
                            model: Transaction,
                            as: 'sessionTransactions', 
                            where: { type: 'coinjoin' },
                            required: false,
                            attributes: [
                                'id', 'txId', 'type', 'confirmations', 
                                'blockHeight', 'blockHash', 'metadata'
                                //'createdAt', 'updatedAt'
                            ]
                        }
                    ]
                }
            ]
        });

        if (!vote) {
            return res.status(404).json({ error: 'Voto non trovato' });
        }

        const response = {
            voteId: vote.id,
            status: vote.status || 'pending',
            submittedAt: vote.submittedAt,
            processedAt: vote.processedAt,
            sessionId: vote.sessionId
        };

        // Se il voto è stato processato, includi dettagli transazione
        if (vote.transactionId) {
            const transaction = await Transaction.findOne({
                where: { txId: vote.transactionId },
                //attributes: ['id', 'txId', 'confirmations', 'blockHeight', 'blockHash', 'createdAt']
                attributes: ['id', 'txId', 'confirmations', 'blockHeight', 'blockHash']
            });

            if (transaction) {
                response.transaction = {
                    txId: transaction.txId,
                    confirmations: transaction.confirmations,
                    blockHeight: transaction.blockHeight,
                    blockHash: transaction.blockHash,
                    //broadcastedAt: transaction.createdAt
                };
            }
        }

        res.json(response);

    } catch (error) {
        console.error('[VOTING] ❌ Errore controllo stato:', error);
        res.status(500).json({ 
            error: 'Errore nel controllo dello stato del voto',
            details: error.message 
        });
    }
});

router.get('/receipt/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;

        console.log(`[VOTING] 🧾 Generazione ricevuta per voto ${voteId}`);

        // Carica voto con dati necessari per ricevuta
        const vote = await Vote.findByPk(voteId, {
            attributes: [
                'id', 'sessionId', 'serialNumber', 'commitment', 
                'transactionId', 'status', 'submittedAt', 'processedAt'
            ]
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato',
                message: 'Il voto richiesto non esiste o è stato eliminato'
            });
        }

        // Carica sessione di voto
        const votingSession = await VotingSession.findByPk(vote.sessionId, {
            attributes: ['id', 'electionId', 'startTime', 'endTime', 'status'],
            include: [
                {
                    model: Election,
                    as: 'election',
                    attributes: ['id', 'title', 'description']
                }
            ]
        });

        // *** CORREZIONE: Cerca transazione CoinJoin senza accesso diretto a createdAt ***
        let coinJoinTransaction = null;
        
        if (vote.transactionId) {
            coinJoinTransaction = await Transaction.findOne({
                where: { 
                    txId: vote.transactionId,
                    type: 'coinjoin'
                },
                attributes: [
                    'id', 'txId', 'type', 'confirmations', 
                    'blockHeight', 'blockHash', 'metadata', 'createdAt'
                ]
            });
        }

        // Se non trovata tramite transactionId, cerca per sessione
        if (!coinJoinTransaction && votingSession) {
            coinJoinTransaction = await Transaction.findOne({
                where: {
                    sessionId: votingSession.id,
                    type: 'coinjoin'
                },
                attributes: [
                    'id', 'txId', 'type', 'confirmations', 
                    'blockHeight', 'blockHash', 'metadata', 'createdAt'
                ],
                order: [['createdAt', 'DESC']] // *** CORREZIONE: Usa attributo Sequelize ***
            });
        }

        // Costruisci risposta ricevuta
        const receiptData = {
            // Informazioni voto
            voteId: vote.id,
            submittedAt: vote.submittedAt,
            processedAt: vote.processedAt,
            status: vote.status,
            
            // Informazioni sessione
            sessionId: vote.sessionId,
            session: votingSession ? {
                id: votingSession.id,
                startTime: votingSession.startTime,
                endTime: votingSession.endTime,
                status: votingSession.status
            } : null,
            
            // Informazioni elezione
            election: votingSession?.election ? {
                id: votingSession.election.id,
                title: votingSession.election.title,
                description: votingSession.election.description
            } : null,
            
            // Informazioni blockchain
            blockchain: coinJoinTransaction ? {
                transactionId: coinJoinTransaction.txId,
                confirmations: coinJoinTransaction.confirmations || 0,
                blockHeight: coinJoinTransaction.blockHeight,
                blockHash: coinJoinTransaction.blockHash,
                broadcastedAt: coinJoinTransaction.createdAt,
                
                coinjoinDetails: coinJoinTransaction.metadata ? {
                    participantsCount: coinJoinTransaction.metadata.participants || 'N/A',
                    totalVotes: coinJoinTransaction.metadata.totalVotes || 'N/A',
                    inputCount: coinJoinTransaction.metadata.inputCount || 'N/A',
                    outputCount: coinJoinTransaction.metadata.outputCount || 'N/A'
                } : null
            } : {
                transactionId: null,
                confirmations: 0,
                status: 'pending',
                message: 'Transazione non ancora confermata'
            },
            
            // Timestamp generazione
            generatedAt: new Date(),
            
            // Info sistema
            system: {
                version: '1.0.0',
                protocol: 'WabiSabi',
                blockchain: 'Bitcoin',
                network: process.env.BITCOIN_NETWORK || 'testnet'
            }
        };

        console.log(`[VOTING] ✅ Ricevuta generata per voto ${voteId}`);
        res.json(receiptData);

    } catch (error) {
        console.error('[VOTING] ❌ Errore generazione ricevuta:', error);
        res.status(500).json({ 
            error: 'Errore nella generazione della ricevuta',
            details: error.message 
        });
    }
});

router.get('/verify/:txId', async (req, res) => {
    try {
        const { txId } = req.params;
        
        console.log(`[VOTING] 🔍 Verifica transazione ${txId}`);

        const transaction = await Transaction.findOne({
            where: { txId },
            attributes: [
                'id', 'txId', 'type', 'electionId', 'sessionId',
                'confirmations', 'blockHeight', 'blockHash', 
                'metadata', 'createdAt' // *** Usa attributo Sequelize ***
            ],
            include: [
                {
                    model: VotingSession,
                    as: 'session',
                    attributes: ['id', 'electionId'],
                    include: [
                        {
                            model: Election,
                            as: 'election',
                            attributes: ['id', 'title']
                        }
                    ],
                    required: false
                }
            ]
        });

        if (!transaction) {
            return res.status(404).json({ 
                error: 'Transazione non trovata',
                message: 'La transazione richiesta non è stata trovata nel sistema'
            });
        }

        const verificationResult = {
            transactionId: transaction.txId,
            type: transaction.type,
            status: transaction.confirmations > 0 ? 'confirmed' : 'pending',
            confirmations: transaction.confirmations || 0,
            blockHeight: transaction.blockHeight,
            blockHash: transaction.blockHash,
            broadcastedAt: transaction.createdAt, // *** Usa attributo Sequelize ***
            
            session: transaction.session ? {
                id: transaction.session.id,
                electionTitle: transaction.session.election?.title,
            } : null,
            
            metadata: transaction.metadata
        };

        res.json(verificationResult);

    } catch (error) {
        console.error('[VOTING] Errore verifica transazione:', error);
        res.status(500).json({ 
            error: 'Errore nella verifica della transazione',
            details: error.message 
        });
    }
});

// GET /api/voting/session/:sessionId/stats - Statistiche sessione
router.get('/session/:sessionId/stats', async (req, res) => {
    try {
        const { sessionId } = req.params;

        //  CORREZIONE: Usa gli alias corretti
        const session = await VotingSession.findByPk(sessionId, {
            include: [
                { 
                    model: Vote, 
                    as: 'votes'  //  Verifica che questo alias sia corretto
                },
                { 
                    model: Transaction, 
                    as: 'sessionTransactions'  //  Alias univoco
                }
            ]
        });

        if (!session) {
            return res.status(404).json({ error: 'Sessione non trovata' });
        }

        const stats = {
            sessionId: session.id,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            totalVotes: session.votes ? session.votes.length : 0,
            votesByStatus: {
                pending: session.votes ? session.votes.filter(v => (v.status || 'pending') === 'pending').length : 0,
                processed: session.votes ? session.votes.filter(v => v.status === 'processed').length : 0,
                confirmed: session.votes ? session.votes.filter(v => v.status === 'confirmed').length : 0,
                failed: session.votes ? session.votes.filter(v => v.status === 'failed').length : 0
            },
            transactions: session.sessionTransactions ? session.sessionTransactions.map(tx => ({
                txId: tx.txId,
                type: tx.type,
                confirmations: tx.confirmations,
                blockHeight: tx.blockHeight
            })) : []
        };

        res.json(stats);

    } catch (error) {
        console.error('[VOTING]  Errore statistiche sessione:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero delle statistiche',
            details: error.message 
        });
    }
});

// GET /api/voting/debug - Route di debug
router.get('/debug', async (req, res) => {
    try {
        const activeElections = await Election.count({ where: { status: 'active' } });
        const activeSessions = await VotingSession.count({ 
            where: { status: ['preparing', 'input_registration', 'output_registration'] } 
        });
        const pendingVotes = await Vote.count({ where: { status: 'pending' } });
        const unusedCredentials = await Credential.count({ where: { isUsed: false } });

        res.json({
            service: 'WabiSabi Voting Service',
            timestamp: new Date().toISOString(),
            config: WABISABI_CONFIG,
            stats: {
                activeElections,
                activeSessions,
                pendingVotes,
                unusedCredentials
            },
            routes: [
                'POST /api/voting/address',
                'POST /api/voting/credentials', 
                'POST /api/voting/submit',
                'GET /api/voting/status/:voteId',
                'GET /api/voting/session/:sessionId/stats'
            ],
            status: 'active'
        });
    } catch (error) {
        res.json({
            service: 'WabiSabi Voting Service',
            status: 'error',
            error: error.message
        });
    }
});

module.exports = router;