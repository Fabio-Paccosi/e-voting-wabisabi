// server3/routes/votes.js - Vote Processing Routes
const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');

// Import modelli
const modelsPath = path.join(__dirname, '../../../database/models');
const { Vote, VotingSession, Election, Credential } = require(modelsPath);

// Middleware di autenticazione (da implementare)
const authMiddleware = (req, res, next) => {
    // TODO: Implementa verifica JWT token
    next();
};

// ==========================================
// VOTE PROCESSING ROUTES
// ==========================================

// POST /api/votes/submit - Invia nuovo voto
router.post('/submit', async (req, res) => {
    try {
        const { 
            electionId, 
            serialNumber, 
            commitment, 
            zkProof,
            nonce 
        } = req.body;

        console.log('🗳️ [VOTE] Processamento nuovo voto per elezione:', electionId);

        // Validazioni base
        if (!electionId || !serialNumber || !commitment || !zkProof) {
            return res.status(400).json({ 
                error: 'Dati voto incompleti' 
            });
        }

        // Verifica che l'elezione esista e sia attiva
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ 
                error: 'Elezione non trovata' 
            });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ 
                error: 'L\'elezione non è attiva' 
            });
        }

        // Verifica che il serial number non sia già stato usato
        const existingVote = await Vote.findOne({
            where: { serialNumber }
        });

        if (existingVote) {
            return res.status(400).json({ 
                error: 'Credenziale già utilizzata per votare' 
            });
        }

        // TODO: Verifica zero-knowledge proof
        const isValidProof = await verifyZKProof(zkProof, commitment);
        if (!isValidProof) {
            return res.status(400).json({ 
                error: 'Prova crittografica non valida' 
            });
        }

        // Trova o crea sessione di voto attiva
        let session = await VotingSession.findOne({
            where: {
                electionId,
                status: 'open'
            }
        });

        if (!session) {
            session = await VotingSession.create({
                electionId,
                status: 'open',
                startTime: new Date()
            });
        }

        // Salva il voto
        const vote = await Vote.create({
            sessionId: session.id,
            serialNumber,
            commitment: JSON.stringify(commitment),
            metadata: {
                zkProof,
                nonce,
                timestamp: new Date().toISOString()
            },
            status: 'pending'
        });

        console.log('✅ [VOTE] Voto salvato con ID:', vote.id);

        res.status(201).json({
            success: true,
            message: 'Voto registrato con successo',
            voteId: vote.id,
            status: vote.status
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore processamento voto:', error);
        res.status(500).json({ 
            error: 'Errore nel processamento del voto' 
        });
    }
});

// GET /api/votes/verify/:voteId - Verifica stato voto
router.get('/verify/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;

        const vote = await Vote.findByPk(voteId, {
            include: [{
                model: VotingSession,
                as: 'session',
                include: [{
                    model: Election,
                    as: 'election'
                }]
            }]
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato' 
            });
        }

        res.json({
            voteId: vote.id,
            status: vote.status,
            transactionId: vote.transactionId,
            confirmedAt: vote.confirmedAt,
            election: {
                id: vote.session.election.id,
                title: vote.session.election.title
            }
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore verifica voto:', error);
        res.status(500).json({ 
            error: 'Errore nella verifica del voto' 
        });
    }
});

// GET /api/votes/receipt/:serialNumber - Ottieni ricevuta voto
router.get('/receipt/:serialNumber', async (req, res) => {
    try {
        const { serialNumber } = req.params;

        const vote = await Vote.findOne({
            where: { serialNumber },
            include: [{
                model: VotingSession,
                as: 'session',
                include: [{
                    model: Election,
                    as: 'election'
                }]
            }]
        });

        if (!vote) {
            return res.status(404).json({ 
                error: 'Voto non trovato con questo serial number' 
            });
        }

        // Genera ricevuta anonima
        const receipt = {
            receiptId: crypto.createHash('sha256')
                .update(vote.id + vote.serialNumber)
                .digest('hex')
                .substring(0, 16),
            election: vote.session.election.title,
            submittedAt: vote.createdAt,
            status: vote.status,
            message: 'Il tuo voto è stato registrato correttamente'
        };

        // Non includere informazioni che potrebbero violare l'anonimato
        if (vote.status === 'confirmed' && vote.transactionId) {
            receipt.blockchainTx = vote.transactionId;
            receipt.confirmedAt = vote.confirmedAt;
        }

        res.json(receipt);

    } catch (error) {
        console.error('❌ [VOTE] Errore generazione ricevuta:', error);
        res.status(500).json({ 
            error: 'Errore nella generazione della ricevuta' 
        });
    }
});

// GET /api/votes/session/:sessionId - Ottieni voti di una sessione (admin only)
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await VotingSession.findByPk(sessionId, {
            include: [
                {
                    model: Vote,
                    as: 'votes'
                },
                {
                    model: Election,
                    as: 'election'
                }
            ]
        });

        if (!session) {
            return res.status(404).json({ 
                error: 'Sessione non trovata' 
            });
        }

        res.json({
            sessionId: session.id,
            electionTitle: session.election.title,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            totalVotes: session.votes.length,
            votesByStatus: {
                pending: session.votes.filter(v => v.status === 'pending').length,
                confirmed: session.votes.filter(v => v.status === 'confirmed').length,
                failed: session.votes.filter(v => v.status === 'failed').length
            }
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore recupero sessione:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero della sessione' 
        });
    }
});

// Funzione helper per verificare ZK proof
async function verifyZKProof(proof, commitment) {
    // TODO: Implementa verifica reale della prova zero-knowledge
    // Per ora restituisce sempre true per testing
    console.log('🔐 [VOTE] Verifica ZK-proof...');
    return true;
}

module.exports = router;