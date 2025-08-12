// server3/routes/votes.js - Vote Processing Routes - FIXED VERSION
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// CORREZIONE: Usa database_config locale invece del percorso assoluto
const { Vote, VotingSession, Election, Credential } = require('../database_config');

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
        // const isValidProof = await verifyZKProof(zkProof, commitment, serialNumber);
        // if (!isValidProof) {
        //     return res.status(400).json({ 
        //         error: 'Proof zero-knowledge non valido' 
        //     });
        // }

        // Trova o crea sessione di voto attiva per questa elezione
        let votingSession = await VotingSession.findOne({
            where: {
                electionId: electionId,
                status: 'active'
            }
        });

        if (!votingSession) {
            // Crea nuova sessione di voto
            votingSession = await VotingSession.create({
                electionId: electionId,
                status: 'active',
                startTime: new Date()
            });
            console.log(`📊 [VOTE] Creata nuova sessione di voto: ${votingSession.id}`);
        }

        // Crea il voto nel database
        const vote = await Vote.create({
            sessionId: votingSession.id,
            serialNumber: serialNumber,
            commitment: commitment,
            zkProof: zkProof,
            nonce: nonce,
            status: 'pending',
            submittedAt: new Date()
        });

        console.log(`✅ [VOTE] Voto registrato con ID: ${vote.id}`);

        // Aggiorna contatore sessione
        await votingSession.increment('voteCount');

        res.status(201).json({
            success: true,
            voteId: vote.id,
            sessionId: votingSession.id,
            message: 'Voto registrato con successo',
            status: 'pending'
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore processamento voto:', error);
        res.status(500).json({ 
            error: 'Errore interno durante il processamento del voto' 
        });
    }
});

// GET /api/votes/status/:voteId - Verifica stato di un voto
router.get('/status/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;

        const vote = await Vote.findByPk(voteId, {
            include: [{
                model: VotingSession,
                as: 'session',
                include: [{
                    model: Election,
                    as: 'election',
                    attributes: ['id', 'title', 'status']
                }]
            }]
        });

        if (!vote) {
            return res.status(404).json({
                error: 'Voto non trovato'
            });
        }

        res.json({
            success: true,
            vote: {
                id: vote.id,
                status: vote.status,
                submittedAt: vote.submittedAt,
                confirmedAt: vote.confirmedAt,
                transactionId: vote.transactionId,
                election: {
                    id: vote.session.election.id,
                    title: vote.session.election.title,
                    status: vote.session.election.status
                }
            }
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore verifica stato voto:', error);
        res.status(500).json({ 
            error: 'Errore durante la verifica dello stato del voto' 
        });
    }
});

// GET /api/votes/session/:sessionId - Statistiche sessione di voto
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await VotingSession.findByPk(sessionId, {
            include: [
                {
                    model: Election,
                    as: 'election',
                    attributes: ['id', 'title', 'status', 'coinjoinTrigger']
                },
                {
                    model: Vote,
                    as: 'votes',
                    attributes: ['id', 'status', 'submittedAt']
                }
            ]
        });

        if (!session) {
            return res.status(404).json({
                error: 'Sessione di voto non trovata'
            });
        }

        const stats = {
            sessionId: session.id,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            election: session.election,
            votes: {
                total: session.votes.length,
                pending: session.votes.filter(v => v.status === 'pending').length,
                confirmed: session.votes.filter(v => v.status === 'confirmed').length,
                failed: session.votes.filter(v => v.status === 'failed').length
            },
            coinjoinProgress: {
                current: session.votes.filter(v => v.status === 'pending').length,
                trigger: session.election.coinjoinTrigger,
                percentage: Math.round((session.votes.filter(v => v.status === 'pending').length / session.election.coinjoinTrigger) * 100)
            }
        };

        res.json({
            success: true,
            session: stats
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore recupero sessione:', error);
        res.status(500).json({ 
            error: 'Errore durante il recupero della sessione di voto' 
        });
    }
});

// DELETE /api/votes/:voteId - Cancella voto (solo se pending)
router.delete('/:voteId', authMiddleware, async (req, res) => {
    try {
        const { voteId } = req.params;

        const vote = await Vote.findByPk(voteId);
        
        if (!vote) {
            return res.status(404).json({
                error: 'Voto non trovato'
            });
        }

        if (vote.status !== 'pending') {
            return res.status(400).json({
                error: 'Impossibile cancellare un voto già processato'
            });
        }

        await vote.destroy();

        console.log(`🗑️ [VOTE] Voto ${voteId} cancellato`);

        res.json({
            success: true,
            message: 'Voto cancellato con successo'
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore cancellazione voto:', error);
        res.status(500).json({ 
            error: 'Errore durante la cancellazione del voto' 
        });
    }
});

// GET /api/votes/stats - Statistiche generali sui voti
router.get('/stats', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        
        const [
            totalVotes,
            pendingVotes,
            confirmedVotes,
            failedVotes,
            activeSessions,
            activeElections
        ] = await Promise.all([
            Vote.count(),
            Vote.count({ where: { status: 'pending' } }),
            Vote.count({ where: { status: 'confirmed' } }),
            Vote.count({ where: { status: 'failed' } }),
            VotingSession.count({ where: { status: 'active' } }),
            Election.count({ where: { status: 'active' } })
        ]);

        const stats = {
            votes: {
                total: totalVotes,
                pending: pendingVotes,
                confirmed: confirmedVotes,
                failed: failedVotes,
                processing_rate: totalVotes > 0 ? Math.round((confirmedVotes / totalVotes) * 100) : 0
            },
            sessions: {
                active: activeSessions
            },
            elections: {
                active: activeElections
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ [VOTE] Errore recupero statistiche:', error);
        res.status(500).json({ 
            error: 'Errore durante il recupero delle statistiche' 
        });
    }
});

module.exports = router;