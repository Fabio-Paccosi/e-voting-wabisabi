// ===========================================
// server3/routes/elections.js - Election Routes for Vote Service - FIXED VERSION
// ===========================================
const express = require('express');
const router = express.Router();

// CORREZIONE: Usa database_config locale invece del percorso assoluto
const { Election, Candidate, VotingSession, Vote } = require('../database_config');

// GET /api/elections/active - Ottieni elezioni attive
router.get('/active', async (req, res) => {
    try {
        const elections = await Election.findAll({
            where: { status: 'active' },
            include: [{
                model: Candidate,
                as: 'candidates',
                attributes: ['id', 'firstName', 'lastName', 'party', 'valueEncoding', 'bitcoinAddress']
            }],
            order: [['startDate', 'ASC']]
        });

        res.json({
            success: true,
            elections: elections.map(e => ({
                id: e.id,
                title: e.title,
                description: e.description,
                startDate: e.startDate,
                endDate: e.endDate,
                candidates: e.candidates.map(c => ({
                    id: c.id,
                    name: `${c.firstName} ${c.lastName}`,
                    party: c.party,
                    valueEncoding: c.valueEncoding,
                    bitcoinAddress: c.bitcoinAddress
                })),
                votingMethod: e.votingMethod,
                coinjoinEnabled: e.coinjoinEnabled,
                coinjoinTrigger: e.coinjoinTrigger,
                blockchainNetwork: e.blockchainNetwork
            }))
        });
    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero elezioni attive:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero delle elezioni attive' 
        });
    }
});

// GET /api/elections/:id - Dettagli elezione specifica
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const election = await Election.findByPk(id, {
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'firstName', 'lastName', 'party', 'description', 'valueEncoding', 'bitcoinAddress']
                },
                {
                    model: VotingSession,
                    as: 'sessions',
                    attributes: ['id', 'status', 'startTime', 'endTime', 'voteCount']
                }
            ]
        });

        if (!election) {
            return res.status(404).json({
                error: 'Elezione non trovata'
            });
        }

        // Calcola statistiche voti per questa elezione
        const voteStats = await Vote.findAll({
            attributes: [
                'status',
                [Vote.sequelize.fn('COUNT', '*'), 'count']
            ],
            include: [{
                model: VotingSession,
                as: 'session',
                where: { electionId: id },
                attributes: []
            }],
            group: ['status'],
            raw: true
        });

        const statsMap = {};
        voteStats.forEach(stat => {
            statsMap[stat.status] = parseInt(stat.count);
        });

        const response = {
            id: election.id,
            title: election.title,
            description: election.description,
            startDate: election.startDate,
            endDate: election.endDate,
            status: election.status,
            votingMethod: election.votingMethod,
            coinjoinEnabled: election.coinjoinEnabled,
            coinjoinTrigger: election.coinjoinTrigger,
            blockchainNetwork: election.blockchainNetwork,
            candidates: election.candidates.map(c => ({
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
                party: c.party,
                description: c.description,
                valueEncoding: c.valueEncoding,
                bitcoinAddress: c.bitcoinAddress
            })),
            sessions: election.sessions,
            voteStats: {
                total: Object.values(statsMap).reduce((sum, count) => sum + count, 0),
                pending: statsMap.pending || 0,
                confirmed: statsMap.confirmed || 0,
                failed: statsMap.failed || 0
            }
        };

        res.json({
            success: true,
            election: response
        });

    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero elezione:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero dell\'elezione' 
        });
    }
});

// GET /api/elections/:id/candidates - Candidati di un'elezione
router.get('/:id/candidates', async (req, res) => {
    try {
        const { id } = req.params;

        // Verifica che l'elezione esista
        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({
                error: 'Elezione non trovata'
            });
        }

        const candidates = await Candidate.findAll({
            where: { electionId: id },
            attributes: ['id', 'firstName', 'lastName', 'party', 'description', 'valueEncoding', 'bitcoinAddress', 'photo'],
            order: [['valueEncoding', 'ASC']]
        });

        res.json({
            success: true,
            electionId: id,
            electionTitle: election.title,
            candidates: candidates.map(c => ({
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
                party: c.party,
                description: c.description,
                valueEncoding: c.valueEncoding,
                bitcoinAddress: c.bitcoinAddress,
                photo: c.photo
            }))
        });

    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero candidati:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero dei candidati' 
        });
    }
});

// GET /api/elections/:id/sessions - Sessioni di voto di un'elezione
router.get('/:id/sessions', async (req, res) => {
    try {
        const { id } = req.params;

        const sessions = await VotingSession.findAll({
            where: { electionId: id },
            include: [{
                model: Vote,
                as: 'votes',
                attributes: ['id', 'status', 'submittedAt']
            }],
            order: [['startTime', 'DESC']]
        });

        const response = sessions.map(session => ({
            id: session.id,
            status: session.status,
            startTime: session.startTime,
            endTime: session.endTime,
            voteCount: session.voteCount,
            votes: {
                total: session.votes.length,
                pending: session.votes.filter(v => v.status === 'pending').length,
                confirmed: session.votes.filter(v => v.status === 'confirmed').length,
                failed: session.votes.filter(v => v.status === 'failed').length
            }
        }));

        res.json({
            success: true,
            electionId: id,
            sessions: response
        });

    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero sessioni:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero delle sessioni di voto' 
        });
    }
});

// POST /api/elections/:id/sessions - Crea nuova sessione di voto
router.post('/:id/sessions', async (req, res) => {
    try {
        const { id } = req.params;

        // Verifica che l'elezione esista e sia attiva
        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({
                error: 'Elezione non trovata'
            });
        }

        if (election.status !== 'active') {
            return res.status(400).json({
                error: 'Non è possibile creare sessioni per elezioni non attive'
            });
        }

        // Verifica che non ci sia già una sessione attiva
        const existingSession = await VotingSession.findOne({
            where: {
                electionId: id,
                status: 'active'
            }
        });

        if (existingSession) {
            return res.status(400).json({
                error: 'Esiste già una sessione di voto attiva per questa elezione'
            });
        }

        // Crea nuova sessione
        const session = await VotingSession.create({
            electionId: id,
            status: 'active',
            startTime: new Date()
        });

        console.log(`📊 [ELECTIONS] Creata nuova sessione di voto: ${session.id} per elezione: ${election.title}`);

        res.status(201).json({
            success: true,
            session: {
                id: session.id,
                electionId: id,
                status: session.status,
                startTime: session.startTime
            },
            message: 'Sessione di voto creata con successo'
        });

    } catch (error) {
        console.error('❌ [ELECTIONS] Errore creazione sessione:', error);
        res.status(500).json({ 
            error: 'Errore nella creazione della sessione di voto' 
        });
    }
});

// GET /api/elections/stats - Statistiche generali elezioni
router.get('/', async (req, res) => {
    try {
        const { Op } = require('sequelize');

        const [
            totalElections,
            activeElections,
            completedElections,
            draftElections,
            totalCandidates,
            totalVotingSessions,
            activeSessions
        ] = await Promise.all([
            Election.count(),
            Election.count({ where: { status: 'active' } }),
            Election.count({ where: { status: 'completed' } }),
            Election.count({ where: { status: 'draft' } }),
            Candidate.count(),
            VotingSession.count(),
            VotingSession.count({ where: { status: 'active' } })
        ]);

        const stats = {
            elections: {
                total: totalElections,
                active: activeElections,
                completed: completedElections,
                draft: draftElections
            },
            candidates: {
                total: totalCandidates
            },
            sessions: {
                total: totalVotingSessions,
                active: activeSessions
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero statistiche:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero delle statistiche' 
        });
    }
});

module.exports = router;