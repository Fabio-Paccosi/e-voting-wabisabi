// server3/routes/voting.js
// Route per il processo di voto WabiSabi

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { randomBytes, createHash } = require('crypto');

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

// POST /api/voting/address - Genera indirizzo Bitcoin per sessione di voto
router.post('/address', extractUserFromHeaders, async (req, res) => {
    try {
        const { userId, electionId, bitcoinAddress, publicKey } = req.body;
        const requestUserId = req.user.id;

        console.log(`[VOTING] 🪙 Richiesta indirizzo Bitcoin per utente ${requestUserId}, elezione ${electionId}`);

        // Verifica che l'utente richiesto corrisponda all'utente autenticato
        if (userId !== requestUserId) {
            return res.status(403).json({ error: 'Utente non autorizzato' });
        }

        // Genera un session ID unico per questa sessione di voto
        const sessionId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        // TODO: Salvare l'associazione nel database
        // await VotingSession.create({
        //     sessionId,
        //     userId,
        //     electionId, 
        //     bitcoinAddress,
        //     publicKey,
        //     status: 'address_generated',
        //     createdAt: timestamp
        // });

        console.log(`[VOTING] ✅ Indirizzo Bitcoin generato per sessione ${sessionId}`);

        res.json({
            success: true,
            sessionId,
            bitcoinAddress,
            publicKey,
            status: 'address_generated',
            timestamp
        });

    } catch (error) {
        console.error('[VOTING] ❌ Errore generazione indirizzo:', error);
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

        // TODO: Verificare che l'utente sia in whitelist per l'elezione
        // TODO: Verificare che non abbia già votato

        // Genera credenziali KVAC mock (sostituire con logica reale)
        const serialNumber = `ser_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const credentialId = crypto.randomUUID();
        
        // Genera firma mock delle credenziali
        const dataToSign = `${serialNumber}:${nonce}:${userId}:${electionId}`;
        const signature = createHash('sha256').update(dataToSign).digest('hex');

        // TODO: Salvare nel database
        // await Credential.create({
        //     credentialId,
        //     userId,
        //     electionId,
        //     serialNumber,
        //     signature,
        //     nonce,
        //     isUsed: false
        // });

        console.log(`[VOTING] ✅ Credenziali KVAC generate: ${credentialId}`);

        res.json({
            success: true,
            credentialId,
            serialNumber,
            signature,
            nonce,
            issuedAt: new Date().toISOString(),
            expiresIn: 3600 // 1 ora
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
        const { 
            electionId, 
            commitment, 
            zkProof, 
            serialNumber, 
            bitcoinAddress,
            timestamp 
        } = req.body;

        console.log(`[VOTING] 🗳️ Ricevuto voto anonimo per elezione ${electionId}`);

        // TODO: Validare credenziale KVAC
        // TODO: Verificare zero-knowledge proof  
        // TODO: Controllare che il serial number non sia già stato usato
        // TODO: Validare il commitment

        // Genera ID del voto
        const voteId = `vote_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const sessionId = crypto.randomUUID();

        // TODO: Salvare il voto nel database
        // await Vote.create({
        //     voteId,
        //     electionId,
        //     commitment,
        //     serialNumber,
        //     bitcoinAddress,
        //     sessionId,
        //     status: 'pending',
        //     zkProof,
        //     receivedAt: new Date()
        // });

        // TODO: Marcare la credenziale come usata
        // await Credential.update(
        //     { isUsed: true, usedAt: new Date() },
        //     { where: { serialNumber } }
        // );

        // TODO: Trigger CoinJoin se soglia raggiunta
        // const pendingVotes = await Vote.count({ 
        //     where: { electionId, status: 'pending' } 
        // });
        // if (pendingVotes >= COINJOIN_THRESHOLD) {
        //     await triggerCoinJoin(electionId);
        // }

        console.log(`[VOTING] ✅ Voto anonimo ricevuto: ${voteId}`);

        res.json({
            success: true,
            voteId,
            sessionId,
            status: 'submitted',
            message: 'Voto ricevuto e in elaborazione per aggregazione CoinJoin',
            estimatedConfirmationTime: '5-10 minuti'
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

        console.log(`[VOTING] 📊 Controllo stato voto ${voteId}`);

        // TODO: Recuperare stato dal database
        // const vote = await Vote.findOne({ 
        //     where: { voteId },
        //     include: [{ model: Transaction, as: 'transaction' }]
        // });

        // Mock response per ora
        const mockStatuses = ['pending', 'confirmed', 'failed'];
        const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
        
        const response = {
            voteId,
            status: randomStatus,
            timestamp: new Date().toISOString()
        };

        if (randomStatus === 'confirmed') {
            response.transactionId = `tx_${crypto.randomBytes(16).toString('hex')}`;
            response.confirmations = Math.floor(Math.random() * 6) + 1;
            response.blockHeight = 850000 + Math.floor(Math.random() * 1000);
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

// GET /api/voting/debug - Route di debug
router.get('/debug', (req, res) => {
    res.json({
        service: 'WabiSabi Voting Service',
        timestamp: new Date().toISOString(),
        routes: [
            'POST /api/voting/address',
            'POST /api/voting/credentials', 
            'POST /api/voting/submit',
            'GET /api/voting/status/:voteId'
        ],
        status: 'active'
    });
});

module.exports = router;