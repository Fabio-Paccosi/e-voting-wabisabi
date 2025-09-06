const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { randomBytes, createHash, createHmac } = require('crypto');
const BitcoinWalletService = require('../shared/services/BitcoinWalletService');
const CoinJoinTriggerService = require('../services/coinjoinTrigger.service');

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

        if (election.status !== 'active') {
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

        // ✅ CORREZIONE: Usa parametri corretti
        const credentialData = await WabiSabiKVACService.generateCredentials({
            userId: userId,           
            electionId,
            nonce,
            userEmail: req.user.email
        });

        // ✅ CORREZIONE: Usa nomi campo corretti
        const credential = await Credential.create({
            userId: userId,                           
            serialNumber: credentialData.serialNumber,  
            nonce,
            signature: credentialData.signature,
            isUsed: false,                           
            issuedAt: new Date()                     
        });

        console.log(`[VOTING] ✅ Credenziali KVAC generate: ${credential.id}`);

        res.json({
            success: true,
            credentialId: credential.id,
            serialNumber: credential.serialNumber,
            signature: credential.signature,
            nonce: credential.nonce,
            issuedAt: credential.issuedAt,
            expiresAt: new Date(Date.now() + WABISABI_CONFIG.CREDENTIAL_EXPIRY)
        });

    } catch (error) {
        console.error('[VOTING] ❌ Errore generazione credenziali:', error);
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
        
        console.log(`[VOTING] 📥 Ricevuto voto anonimo per elezione ${electionId}`);
        
        // 1. Verifica elezione
        const election = await Election.findByPk(electionId);
        if (!election || election.status !== 'active') {
            return res.status(400).json({ error: 'Elezione non attiva' });
        }

        // 2. Trova credenziale
        const credential = await Credential.findOne({
            where: { serialNumber: serialNumber }
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

        // 4. ✅ CORREZIONE: Logica robusta per sessioni di voto
        console.log(`[VOTING] 🔍 Ricerca sessioni attive per elezione ${electionId}`);
        
        // Prima prova a trovare una sessione esistente
        let votingSession = await VotingSession.findOne({
            where: {
                electionId: electionId,
                status: {
                    [require('sequelize').Op.in]: ['preparing', 'input_registration', 'output_registration']
                }
            },
            order: [['created_at', 'DESC']] // Prendi la più recente
        });

        // ✅ Se non trova sessione, creane una nuova
        if (!votingSession) {
            console.log(`[VOTING] 🆕 Nessuna sessione attiva trovata, creazione nuova sessione per elezione ${electionId}`);
            
            try {
                votingSession = await VotingSession.create({
                    electionId: electionId,
                    status: 'input_registration',
                    startTime: new Date(),
                    endTime: null,
                    minParticipants: WABISABI_CONFIG.COINJOIN_THRESHOLD || 2,
                    maxParticipants: 100,
                    currentParticipants: 0,
                    transactionCount: 0,
                    finalTallyTransactionId: null
                });
                
                console.log(`[VOTING] ✅ Nuova sessione creata: ${votingSession.id}`);
            } catch (createError) {
                console.error(`[VOTING] ❌ Errore creazione sessione:`, createError);
                return res.status(500).json({ 
                    error: 'Errore nella creazione della sessione di voto',
                    details: createError.message 
                });
            }
        } else {
            console.log(`[VOTING] ✅ Sessione esistente trovata: ${votingSession.id} (stato: ${votingSession.status})`);
        }

        // 5. Verifica che la sessione sia in uno stato accettabile
        const acceptableStates = ['preparing', 'input_registration', 'output_registration'];
        if (!acceptableStates.includes(votingSession.status)) {
            console.log(`[VOTING] ⚠️ Sessione ${votingSession.id} in stato non accettabile: ${votingSession.status}`);
            
            // Crea una nuova sessione se quella esistente non è utilizzabile
            try {
                votingSession = await VotingSession.create({
                    electionId: electionId,
                    status: 'input_registration',
                    startTime: new Date(),
                    endTime: null,
                    minParticipants: WABISABI_CONFIG.COINJOIN_THRESHOLD || 2,
                    maxParticipants: 100,
                    currentParticipants: 0,
                    transactionCount: 0,
                    finalTallyTransactionId: null
                });
                
                console.log(`[VOTING] ✅ Nuova sessione sostitutiva creata: ${votingSession.id}`);
            } catch (createError) {
                console.error(`[VOTING] ❌ Errore creazione sessione sostitutiva:`, createError);
                return res.status(500).json({ 
                    error: 'Errore nella creazione della sessione di voto sostitutiva',
                    details: createError.message 
                });
            }
        }

        // 6. ✅ A questo punto abbiamo garantito una sessione valida
        console.log(`[VOTING] 🎯 Utilizzo sessione ${votingSession.id} per il voto`);

        // 7. Crea il voto
        const vote = await Vote.create({
            sessionId: votingSession.id,
            serialNumber: serialNumber,
            commitment,
            status: 'pending',
            submittedAt: new Date()
        });

        console.log(`[VOTING] ✅ Voto creato: ${vote.id}`);

        // 8. Marca credenziale come usata
        await credential.update({
            isUsed: true,
            usedAt: new Date()
        });

        // 9. Marca utente come votato nella whitelist
        await ElectionWhitelist.update(
            { 
                hasVoted: true,
                votedAt: new Date()
            },
            { 
                where: { 
                    userId: credential.userId,
                    electionId: electionId
                } 
            }
        );

        // 10. Aggiorna conteggio partecipanti nella sessione
        await votingSession.reload(); // Ricarica per avere dati freschi
        await votingSession.update({
            currentParticipants: votingSession.currentParticipants + 1
        });

        // 11. Conteggio voti pending per trigger CoinJoin
        const pendingVotes = await Vote.count({
            where: {
                sessionId: votingSession.id,
                status: 'pending'
            }
        });

        console.log(`[VOTING] 📊 Voti pending in sessione ${votingSession.id}: ${pendingVotes}/${WABISABI_CONFIG.COINJOIN_THRESHOLD}`);

        // 12. Trigger CoinJoin se soglia raggiunta
        let coinjoinTriggered = false;
        if (pendingVotes >= WABISABI_CONFIG.COINJOIN_THRESHOLD) {
            console.log(`[VOTING] 🚀 Soglia CoinJoin raggiunta (${pendingVotes} >= ${WABISABI_CONFIG.COINJOIN_THRESHOLD}), avvio aggregazione...`);
            
            // Aggiorna stato sessione a output_registration
            await votingSession.update({
                status: 'output_registration'
            });
            
            coinjoinTriggered = true;
            
            // Trigger CoinJoin in background (non bloccare la risposta)
            setImmediate(() => {
                CoinJoinTriggerService.triggerCoinJoinForSession(votingSession.id, electionId)
                    .then(() => {
                        console.log(`[VOTING] ✅ CoinJoin completato per sessione ${votingSession.id}`);
                    })
                    .catch(error => {
                        console.error(`[VOTING] ❌ Errore CoinJoin per sessione ${votingSession.id}:`, error);
                    });
            });
        }

        console.log(`[VOTING] 🎉 Voto anonimo registrato con successo: ${vote.id}`);

        // 13. Risposta di successo
        res.json({
            success: true,
            voteId: vote.id,
            sessionId: votingSession.id,
            status: 'submitted',
            message: 'Voto ricevuto e in elaborazione',
            pendingVotes: pendingVotes,
            coinjoinThreshold: WABISABI_CONFIG.COINJOIN_THRESHOLD,
            coinjoinTriggered: coinjoinTriggered,
            sessionStatus: votingSession.status
        });

    } catch (error) {
        console.error('[VOTING] ❌ Errore invio voto:', error);
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

        // CORREZIONE: Query semplificata con mapping corretto dei campi timestamp
        const vote = await Vote.findByPk(voteId, {
            attributes: [
                'id', 
                'sessionId', 
                'commitment', 
                'serialNumber', 
                'status', 
                'transactionId',
                ['created_at', 'createdAt'],     // Mappa created_at -> createdAt
                ['updated_at', 'updatedAt']      // Mappa updated_at -> updatedAt
            ]
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato',
                message: 'Il voto richiesto non esiste o è stato eliminato'
            });
        }

        console.log(`[VOTING] 📋 Voto trovato: ${vote.id}, status: ${vote.status}`);

        // Costruisci risposta base
        const response = {
            voteId: vote.id,
            serialNumber: vote.serialNumber ? vote.serialNumber.substring(0, 8) + '...' : 'N/A',
            status: vote.status || 'pending',
            submittedAt: vote.createdAt,
            processedAt: vote.updatedAt,
            sessionId: vote.sessionId
        };

        // Se il voto ha un transactionId, cerca i dettagli della transazione separatamente
        if (vote.transactionId) {
            try {
                const transaction = await Transaction.findOne({
                    where: { txid: vote.transactionId },
                });

                if (transaction) {
                    response.transaction = {
                        txId: transaction.txid,
                        voteCount: transaction.voteCount,
                        status: transaction.status,
                        blockHeight: transaction.blockHeight,
                        broadcastedAt: transaction.createdAt
                    };
                }
            } catch (transactionError) {
                console.warn(`[VOTING] ⚠️ Errore caricamento transazione ${vote.transactionId}:`, transactionError.message);
                // Non bloccare la risposta per errori di transazione
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
            });
        }

        // Se non trovata tramite transactionId, cerca per sessione
        if (!coinJoinTransaction && votingSession) {
            coinJoinTransaction = await Transaction.findOne({
                where: {
                    sessionId: votingSession.id,
                    type: 'coinjoin'
                },
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

// POST /api/voting/submit-vote - Invia voto con validazione chiave privata
router.post('/submit-vote', extractUserFromHeaders, async (req, res) => {
    try {
        const { electionId, candidateId, bitcoinAddress, privateKey, voteCommitment, timestamp } = req.body;
        const userId = req.user.id;
        
        console.log(`[VOTING-SUBMIT] 🗳️ Ricevuto voto da utente ${userId} per candidato ${candidateId}`);

        // === VALIDAZIONI PRELIMINARI ===
        
        if (!electionId || !candidateId || !bitcoinAddress || !privateKey || !voteCommitment) {
            return res.status(400).json({ 
                success: false,
                error: 'Tutti i campi sono obbligatori' 
            });
        }

        // Verifica che l'elezione esista e sia attiva
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ 
                success: false,
                error: 'Elezione non trovata' 
            });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ 
                success: false,
                error: 'Elezione non attiva' 
            });
        }

        // Verifica che il candidato esista per questa elezione
        const candidate = await Candidate.findOne({
            where: { id: candidateId, electionId }
        });

        if (!candidate) {
            return res.status(404).json({ 
                success: false,
                error: 'Candidato non trovato per questa elezione' 
            });
        }

        // === VALIDAZIONE UTENTE E BITCOIN WALLET ===
        
        // Trova l'utente nella whitelist con l'indirizzo Bitcoin
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                electionId,
                userId,
                bitcoinAddress: bitcoinAddress.trim()
            }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ 
                success: false,
                error: 'Utente non autorizzato o indirizzo Bitcoin non corrispondente' 
            });
        }

        // Verifica che l'utente non abbia già votato
        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ 
                success: false,
                error: 'Hai già votato per questa elezione' 
            });
        }

        // === VALIDAZIONE CHIAVE PRIVATA ===
        
        const walletService = new BitcoinWalletService();
        
        // Valida il formato della chiave privata
        if (!walletService.isValidPrivateKey(privateKey)) {
            return res.status(400).json({ 
                success: false,
                error: 'Chiave privata non valida' 
            });
        }

        // Verifica che la chiave privata corrisponda all'indirizzo Bitcoin
        try {
            const derivedAddress = walletService.getAddressFromPrivateKey(privateKey);
            if (derivedAddress !== bitcoinAddress) {
                console.log(`[VOTING-SUBMIT] ❌ Mismatch indirizzi: ${derivedAddress} vs ${bitcoinAddress}`);
                return res.status(403).json({ 
                    success: false,
                    error: 'La chiave privata non corrisponde all\'indirizzo Bitcoin autorizzato' 
                });
            }
        } catch (error) {
            return res.status(400).json({ 
                success: false,
                error: 'Impossibile verificare la chiave privata' 
            });
        }

        console.log(`[VOTING-SUBMIT] ✅ Chiave privata validata per indirizzo ${bitcoinAddress}`);

        // === CREAZIONE E VALIDAZIONE VOTO ===
        
        // Genera un serial number univoco per il voto
        const serialNumber = crypto.createHash('sha256')
            .update(`${userId}-${electionId}-${candidateId}-${Date.now()}-${Math.random()}`)
            .digest('hex')
            .substring(0, 32);

        // Crea il record del voto anonimo
        const voteRecord = {
            serialNumber,
            electionId,
            candidateId,
            voteCommitment,
            bitcoinAddress,
            timestamp: new Date(timestamp),
            status: 'pending'
        };

        console.log(`[VOTING-SUBMIT] 📝 Creando record voto con serial: ${serialNumber}`);

        // === TROVA O CREA SESSIONE DI VOTO ===
        
        let votingSession = await VotingSession.findOne({
            where: {
                electionId,
                status: ['preparing', 'input_registration', 'active']
            }
        });

        if (!votingSession) {
            votingSession = await VotingSession.create({
                electionId,
                startTime: new Date(),
                status: 'input_registration',
                transactionCount: 0
            });
            console.log(`[VOTING-SUBMIT] 🆕 Nuova sessione di voto creata: ${votingSession.id}`);
        }

        // === SALVATAGGIO VOTO NEL DATABASE ===
        
        await sequelize.transaction(async (t) => {
            // Crea il record del voto
            const vote = await Vote.create({
                electionId,
                votingSessionId: votingSession.id,
                serialNumber,
                commitment: voteCommitment,
                transactionId: null, // Sarà popolato durante il CoinJoin
                blockHeight: null,
                status: 'pending'
            }, { transaction: t });

            // Aggiorna la whitelist per segnare che l'utente ha votato
            await whitelistEntry.update({
                hasVoted: true,
                votedAt: new Date(),
                utxoStatus: 'reserved' // Riserva l'UTXO per la transazione CoinJoin
            }, { transaction: t });

            // Aggiorna il conteggio della sessione
            await votingSession.update({
                transactionCount: votingSession.transactionCount + 1,
                status: 'active'
            }, { transaction: t });

            console.log(`[VOTING-SUBMIT] ✅ Voto salvato con ID: ${vote.id}`);
        });

        // === TRIGGER COINJOIN SE NECESSARIO ===
        
        const pendingVotes = await Vote.count({
            where: {
                electionId,
                status: 'pending'
            }
        });

        console.log(`[VOTING-SUBMIT] 📊 Voti pendenti: ${pendingVotes}`);

        let transactionId = null;
        let coinjoinTriggered = false;

        // Controlla se è necessario triggerare il CoinJoin
        if (pendingVotes >= (election.coinjoinTrigger || 2)) {
            console.log(`[VOTING-SUBMIT] 🔄 Triggering CoinJoin con ${pendingVotes} voti`);
            
            try {
                const coinjoinResult = await triggerCoinJoinForElection(electionId);
                transactionId = coinjoinResult.transactionId;
                coinjoinTriggered = true;
                
                console.log(`[VOTING-SUBMIT] ✅ CoinJoin completato: ${transactionId}`);
            } catch (coinjoinError) {
                console.error('[VOTING-SUBMIT] ⚠️ Errore CoinJoin:', coinjoinError.message);
                // Il voto è comunque salvato, il CoinJoin può essere ritentato
            }
        }

        // === RISPOSTA FINALE ===
        
        res.json({
            success: true,
            message: 'Voto registrato con successo',
            voteId: serialNumber.substring(0, 8) + '...', // ID pubblico abbreviato
            transactionId: transactionId,
            coinjoinTriggered,
            election: {
                id: election.id,
                title: election.title
            },
            candidate: {
                id: candidate.id,
                name: candidate.name
            },
            blockchain: {
                network: election.blockchainNetwork || 'testnet',
                pendingVotes: pendingVotes
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[VOTING-SUBMIT] ❌ Errore generale invio voto:', error);
        res.status(500).json({ 
            success: false,
            error: 'Errore interno durante l\'invio del voto',
            details: error.message 
        });
    }
});

/**
 * GET /api/voting/receipt/:voteId/detailed
 * Genera una ricevuta dettagliata con tutti i dati del voto, whitelist, UTXO e transazione
 * CORRETTA per usare l'alias 'session' (come definito in database/database_config.js)
 */
router.get('/receipt/:voteId/detailed', extractUserFromHeaders, async (req, res) => {
    try {
        const { voteId } = req.params;
        const userId = req.user.id;

        console.log(`[DETAILED-RECEIPT] 🧾 Generazione ricevuta dettagliata per voto ${voteId}`);

        // === STEP 1: Carica il voto con tutte le relazioni (ALIAS CORRETTI) ===
        const vote = await Vote.findByPk(voteId, {
            include: [
                {
                    model: VotingSession,
                    as: 'votingSession',
                    include: [
                        {
                            model: Election,
                            as: 'election',
                            attributes: ['id', 'title', 'description']
                        }
                    ]
                }
            ]
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato',
                message: 'Il voto richiesto non esiste o è stato eliminato'
            });
        }

        // === STEP 2: Verifica che l'utente abbia accesso a questo voto ===
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                userId: userId,
                electionId: vote.votingSession.election.id,
                hasVoted: true
            }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ 
                error: 'Accesso negato',
                message: 'Non hai i permessi per visualizzare questa ricevuta'
            });
        }

        // === STEP 3: Carica i dettagli della transazione CoinJoin ===
        let transactionDetails = null;
        if (vote.transactionId) {
            try {
                const transaction = await Transaction.findOne({
                    where: { txid: vote.transactionId },
                });

                if (transaction) {
                    // Parse dei metadati JSON se presenti
                    let metadata = {};
                    try {
                        metadata = transaction.metadata ? 
                            (typeof transaction.metadata === 'string' ? 
                                JSON.parse(transaction.metadata) : 
                                transaction.metadata) : {};
                    } catch (e) {
                        console.warn('[DETAILED-RECEIPT] ⚠️ Errore parsing metadata:', e.message);
                    }

                    transactionDetails = {
                        txid: transaction.txid,
                        type: transaction.type,
                        status: transaction.status,
                        confirmations: transaction.confirmations || 0,
                        blockHeight: transaction.blockHeight,
                        blockHash: transaction.blockHash,
                        voteCount: transaction.voteCount,
                        inputCount: metadata.inputCount || metadata.participants || 'N/A',
                        outputCount: metadata.outputCount || 'N/A',
                        voterCount: metadata.participants || transaction.voteCount || 'N/A',
                        totalAmount: metadata.totalAmount || 'N/A',
                        //broadcastedAt: transaction.createdAt,
                        confirmedAt: transaction.blockHeight ? transaction.updatedAt : null
                    };
                }
            } catch (transactionError) {
                console.warn(`[DETAILED-RECEIPT] ⚠️ Errore caricamento transazione: ${transactionError.message}`);
            }
        }

        // === STEP 4: Prepara i dati della whitelist (con sicurezza) ===
        const whitelistData = {
            bitcoinAddress: whitelistEntry.bitcoinAddress,
            bitcoinPublicKey: whitelistEntry.bitcoinPublicKey ? 
                whitelistEntry.bitcoinPublicKey.substring(0, 32) + '...' : 'N/A',
            utxo_txid: whitelistEntry.utxo_txid || 'N/A',
            utxo_vout: whitelistEntry.utxo_vout !== null ? whitelistEntry.utxo_vout : 'N/A',
            utxo_amount: whitelistEntry.utxo_amount || 0,
            votedAt: whitelistEntry.votedAt,
            hasVoted: whitelistEntry.hasVoted
        };

        // === STEP 5: Carica i dettagli della sessione ===
        const sessionStats = await VotingSession.findByPk(vote.sessionId, {
            attributes: [
                'id', 'status', 'transactionCount', 'finalTallyTransactionId',
                'startTime'
            ]
        });

        // Conta i partecipanti totali in questa sessione
        const totalParticipants = await Vote.count({
            where: { sessionId: vote.sessionId }
        });

        // === STEP 6: Assembla la risposta completa ===
        const detailedReceipt = {
            // Dati del voto
            voteData: {
                voteId: vote.id,
                serialNumber: vote.serialNumber ? 
                    vote.serialNumber.substring(0, 16) + '...' : 'N/A',
                commitment: vote.commitment || 'N/A',
                status: vote.status,
                //submittedAt: vote.createdAt,
                //processedAt: vote.updatedAt
            },

            // Dati Election Whitelist (informazioni sensibili nascoste)
            whitelistData: whitelistData,

            // Dati transazione CoinJoin
            transaction: transactionDetails,

            // Dati elezione
            election: {
                id: vote.votingSession.election.id, 
                title: vote.votingSession.election.title,
                description: vote.votingSession.election.description,
                //network: vote.votingSession.election.blockchainNetwork || 'testnet'
            },

            // Dati sessione
            session: {
                id: vote.sessionId,
                status: sessionStats ? sessionStats.status : 'unknown',
                totalParticipants: totalParticipants,
                transactionCount: sessionStats ? sessionStats.transactionCount : 0,
                startTime: sessionStats ? sessionStats.startTime : null,
                endTime: sessionStats ? sessionStats.endTime : null,
                protocolVersion: process.env.WABISABI_VERSION || ''
            },

            // Metadati per verifica
            metadata: {
                receiptGeneratedAt: new Date(),
                receiptVersion: '2.0',
                systemVersion: process.env.SYSTEM_VERSION || '1.0.0',
                userId: userId, // Per debug/audit (rimosso in produzione)
                verificationHash: require('crypto')
                    .createHash('sha256')
                    .update(`${vote.id}-${whitelistEntry.bitcoinAddress}-${vote.transactionId || 'pending'}`)
                    .digest('hex')
                    .substring(0, 16)
            }
        };

        console.log(`[DETAILED-RECEIPT] ✅ Ricevuta generata con successo per voto ${voteId}`);

        res.json({
            success: true,
            receipt: detailedReceipt
        });

    } catch (error) {
        console.error('[DETAILED-RECEIPT] ❌ Errore generazione ricevuta dettagliata:', error);
        res.status(500).json({ 
            error: 'Errore nella generazione della ricevuta dettagliata',
            details: error.message 
        });
    }
});

/**
 * GET /api/voting/receipt/:electionId/user/:userId/detailed
 * Endpoint alternativo per ottenere la ricevuta usando electionId e userId
 * CORRETTA per usare l'alias 'session'
 */
router.get('/receipt/:electionId/user/:userId/detailed', extractUserFromHeaders, async (req, res) => {
    try {
        const { electionId, userId } = req.params;
        const requestingUserId = req.user.id;

        // Verifica che l'utente possa accedere a questi dati
        if (requestingUserId !== userId) {
            return res.status(403).json({ 
                error: 'Accesso negato',
                message: 'Puoi visualizzare solo le tue ricevute'
            });
        }

        console.log(`[DETAILED-RECEIPT-ALT] 🔍 Ricerca voto per utente ${userId} in elezione ${electionId}`);

        // Trova il voto dell'utente per questa elezione
        const vote = await Vote.findOne({
            include: [
                {
                    model: VotingSession,
                    as: 'votingSession',
                    where: { electionId: electionId },
                    include: [
                        {
                            model: Election,
                            as: 'election'
                        }
                    ]
                }
            ],
            //order: [['createdAt', 'DESC']] // Il voto più recente
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato',
                message: 'Nessun voto trovato per questo utente in questa elezione'
            });
        }

        // Verifica tramite whitelist che l'utente abbia effettivamente votato
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                userId: userId,
                electionId: electionId,
                hasVoted: true
            }
        });

        if (!whitelistEntry) {
            return res.status(404).json({ 
                error: 'Voto non confermato',
                message: 'Nessun voto confermato trovato per questo utente'
            });
        }

        // Usa la ricevuta dettagliata standard con il voteId trovato
        req.params.voteId = vote.id;
        
        // Chiama ricorsivamente l'endpoint della ricevuta dettagliata
        router.get('/receipt/:voteId/detailed', extractUserFromHeaders)(req, res);

    } catch (error) {
        console.error('[DETAILED-RECEIPT-ALT] ❌ Errore ricerca voto:', error);
        res.status(500).json({ 
            error: 'Errore nella ricerca del voto',
            details: error.message 
        });
    }
});

/**
 * GET /api/voting/receipt/:voteId/verification
 * Endpoint per verificare l'autenticità di una ricevuta
 */
router.get('/receipt/:voteId/verification', async (req, res) => {
    try {
        const { voteId } = req.params;
        const { verificationHash } = req.query;

        console.log(`[RECEIPT-VERIFICATION] 🔍 Verifica ricevuta per voto ${voteId}`);

        // Carica solo i dati necessari per la verifica
        const vote = await Vote.findByPk(voteId, {
            attributes: ['id', 'transactionId', 'status'],
            include: [
                {
                    model: VotingSession,
                    as: 'votingSession',
                    attributes: ['electionId']
                }
            ]
        });

        if (!vote) {
            return res.status(404).json({ 
                verified: false,
                message: 'Voto non trovato'
            });
        }

        // Verifica l'hash se fornito
        let hashVerified = true;
        if (verificationHash) {
            // In produzione, dovresti usare un hash che non espone dati sensibili
            const expectedHash = require('crypto')
                .createHash('sha256')
                .update(`${vote.id}-[PROTECTED]-${vote.transactionId || 'pending'}`)
                .digest('hex')
                .substring(0, 16);
            
            hashVerified = (verificationHash === expectedHash);
        }

        // Verifica se il voto è stato effettivamente confermato
        const isConfirmed = vote.status === 'confirmed' && vote.transactionId;

        res.json({
            verified: hashVerified && isConfirmed,
            voteId: vote.id,
            status: vote.status,
            hasTransaction: !!vote.transactionId,
            //submittedAt: vote.createdAt,
            hashVerified: hashVerified,
            message: hashVerified && isConfirmed ? 
                'Ricevuta verificata con successo' : 
                'Ricevuta non valida o voto non confermato'
        });

    } catch (error) {
        console.error('[RECEIPT-VERIFICATION] ❌ Errore verifica ricevuta:', error);
        res.status(500).json({ 
            verified: false,
            error: 'Errore nella verifica della ricevuta',
            details: error.message 
        });
    }
});

module.exports = router;