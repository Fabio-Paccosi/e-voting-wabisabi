// ===========================================
// server3/routes/elections.js - Election Routes for Vote Service
// ===========================================
const express = require('express');
const router = express.Router();
const path = require('path');

// Import modelli
const modelsPath = path.join(__dirname, '../../../database/models');
const { Election, Candidate, VotingSession, Vote } = require(modelsPath);

// GET /api/elections/active - Ottieni elezioni attive
router.get('/active', async (req, res) => {
    try {
        const elections = await Election.findAll({
            where: { status: 'active' },
            include: [{
                model: Candidate,
                as: 'candidates',
                attributes: ['id', 'firstName', 'lastName', 'party', 'valueEncoding']
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
                    valueEncoding: c.valueEncoding
                })),
                votingMethod: e.votingMethod,
                coinjoinEnabled: e.coinjoinEnabled
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
                    as: 'candidates'
                },
                {
                    model: VotingSession,
                    as: 'sessions',
                    include: [{
                        model: Vote,
                        as: 'votes'
                    }]
                }
            ]
        });

        if (!election) {
            return res.status(404).json({ 
                error: 'Elezione non trovata' 
            });
        }

        // Calcola statistiche
        const totalVotes = election.sessions.reduce((sum, session) => 
            sum + session.votes.length, 0
        );

        const confirmedVotes = election.sessions.reduce((sum, session) => 
            sum + session.votes.filter(v => v.status === 'confirmed').length, 0
        );

        res.json({
            id: election.id,
            title: election.title,
            description: election.description,
            status: election.status,
            startDate: election.startDate,
            endDate: election.endDate,
            candidates: election.candidates.map(c => ({
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
                party: c.party,
                bitcoinAddress: c.bitcoinAddress
            })),
            statistics: {
                totalVotes,
                confirmedVotes,
                pendingVotes: totalVotes - confirmedVotes,
                sessionsCount: election.sessions.length
            },
            settings: {
                coinjoinEnabled: election.coinjoinEnabled,
                coinjoinTrigger: election.coinjoinTrigger,
                votingMethod: election.votingMethod,
                blockchainNetwork: election.blockchainNetwork
            }
        });
    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero dettagli elezione:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero dei dettagli dell\'elezione' 
        });
    }
});

// GET /api/elections/:id/results - Risultati elezione (solo se completata)
router.get('/:id/results', async (req, res) => {
    try {
        const { id } = req.params;

        const election = await Election.findByPk(id, {
            include: [
                {
                    model: Candidate,
                    as: 'candidates'
                },
                {
                    model: VotingSession,
                    as: 'sessions',
                    include: [{
                        model: Vote,
                        as: 'votes',
                        where: { status: 'confirmed' }
                    }]
                }
            ]
        });

        if (!election) {
            return res.status(404).json({ 
                error: 'Elezione non trovata' 
            });
        }

        if (election.status !== 'completed') {
            return res.status(403).json({ 
                error: 'I risultati non sono ancora disponibili' 
            });
        }

        // Calcola risultati aggregati
        // TODO: Implementa decrittazione e conteggio reale dei voti
        const results = election.candidates.map(candidate => ({
            candidateId: candidate.id,
            candidateName: `${candidate.firstName} ${candidate.lastName}`,
            party: candidate.party,
            votes: 0, // TODO: Conteggio reale dopo decrittazione
            percentage: 0
        }));

        const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
        
        // Calcola percentuali
        results.forEach(r => {
            r.percentage = totalVotes > 0 
                ? Math.round((r.votes / totalVotes) * 1000) / 10 
                : 0;
        });

        // Ordina per numero di voti
        results.sort((a, b) => b.votes - a.votes);

        res.json({
            electionId: election.id,
            electionTitle: election.title,
            status: election.status,
            totalVotes,
            results,
            completedAt: election.endDate
        });
    } catch (error) {
        console.error('❌ [ELECTIONS] Errore recupero risultati:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero dei risultati' 
        });
    }
});

module.exports = router;