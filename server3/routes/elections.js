// server3/routes/elections.js - Vote Service per utenti normali (SENZA JWT)
const express = require('express');
const router = express.Router();

// Importa modelli database condivisi
const {
    sequelize,
    User,
    Election,
    Candidate,
    ElectionWhitelist,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('vote');

const { Op } = require('sequelize');

// Inizializza database all'avvio
console.log('🔗 [VOTE SERVICE] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log(' [VOTE SERVICE] Database inizializzato correttamente');
        } else {
            console.error(' [VOTE SERVICE] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error(' [VOTE SERVICE] Errore database:', error);
    });

// Middleware per estrarre informazioni utente dai header (passati dall'API Gateway)
const extractUserFromHeaders = async (req, res, next) => {
    try {
        // L'API Gateway passa l'ID utente negli header dopo aver validato il JWT
        const userId = req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ 
                error: 'Informazioni utente mancanti (x-user-id header richiesto)' 
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ 
                error: 'Utente non trovato' 
            });
        }

        if (!user.isAuthorized) {
            return res.status(403).json({ 
                error: 'Utente non autorizzato al voto' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[VOTE SERVICE] ✗ Errore estrazione utente:', error);
        return res.status(500).json({ 
            error: 'Errore interno nella validazione utente',
            details: error.message 
        });
    }
};

// GET /api/elections - Lista elezioni disponibili per l'utente autenticato
router.get('/', extractUserFromHeaders, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[VOTE SERVICE] 📋 Richiesta elezioni disponibili per utente ${userId}`);
        
        // 1. Trova tutte le elezioni attive nel periodo corrente
        const now = new Date();
        const activeElections = await Election.findAll({
            where: {
                status: 'active',
                isActive: true,
                startDate: { [Op.lte]: now },
                endDate: { [Op.gte]: now }
            },
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress']
                }
            ],
            order: [['startDate', 'ASC']]
        });

        console.log(`[VOTE SERVICE]  Trovate ${activeElections.length} elezioni attive`);

        if (activeElections.length === 0) {
            return res.json({
                success: true,
                elections: [],
                total: 0,
                message: 'Nessuna elezione attiva al momento'
            });
        }

        // 2. Filtra solo le elezioni per cui l'utente è in whitelist
        const availableElections = [];
        
        for (const election of activeElections) {
            // Verifica se l'utente è nella whitelist di questa elezione
            const whitelistEntry = await ElectionWhitelist.findOne({
                where: {
                    electionId: election.id,
                    userId: userId
                }
            });

            if (whitelistEntry) {
                // 3. Verifica se l'utente ha già votato per questa elezione
                if (!whitelistEntry.hasVoted) {
                    // L'utente può votare per questa elezione
                    availableElections.push({
                        id: election.id,
                        title: election.title,
                        description: election.description,
                        startDate: election.startDate,
                        endDate: election.endDate,
                        status: election.status,
                        isActive: election.isActive,
                        votingMethod: election.votingMethod,
                        coinjoinEnabled: election.coinjoinEnabled,
                        coinjoinTrigger: election.coinjoinTrigger,
                        blockchainNetwork: election.blockchainNetwork,
                        candidates: election.candidates.map(candidate => ({
                            id: candidate.id,
                            name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
                            firstName: candidate.firstName,
                            lastName: candidate.lastName,
                            party: candidate.party,
                            voteEncoding: candidate.voteEncoding,
                            bitcoinAddress: candidate.bitcoinAddress
                        })),
                        userWhitelist: {
                            authorizedAt: whitelistEntry.authorizedAt,
                            hasVoted: whitelistEntry.hasVoted,
                            votedAt: whitelistEntry.votedAt
                        }
                    });
                } else {
                    console.log(`[VOTE SERVICE] ✓ Utente ${userId} ha già votato per elezione ${election.id}`);
                }
            } else {
                console.log(`[VOTE SERVICE] ✗ Utente ${userId} non in whitelist per elezione ${election.id}`);
            }
        }

        console.log(`[VOTE SERVICE]  Restituite ${availableElections.length} elezioni disponibili per utente ${userId}`);

        res.json({
            success: true,
            elections: availableElections,
            total: availableElections.length,
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName
            }
        });

    } catch (error) {
        console.error('[VOTE SERVICE]  Errore caricamento elezioni:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento delle elezioni',
            details: error.message 
        });
    }
});

// GET /api/elections/voted - Lista elezioni a cui l'utente ha partecipato
router.get('/voted', extractUserFromHeaders, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log(`[VOTE SERVICE]  Richiesta elezioni votate per utente ${userId}`);

        // Trova tutte le elezioni per cui l'utente ha votato (hasVoted = true)
        const votedElections = await ElectionWhitelist.findAll({
            where: {
                userId: userId,
                hasVoted: true  // Solo elezioni per cui ha effettivamente votato
            },
            include: [
                {
                    model: Election,
                    as: 'election',
                    include: [
                        {
                            model: Candidate,
                            as: 'candidates',
                            attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress', 'totalVotesReceived']
                        }
                    ]
                }
            ]
        });

        console.log(`[VOTE SERVICE]  Trovate ${votedElections.length} elezioni votate`);

        const elections = votedElections.map(entry => ({
            id: entry.election.id,
            title: entry.election.title,
            description: entry.election.description,
            startDate: entry.election.startDate,
            endDate: entry.election.endDate,
            status: entry.election.status,
            isActive: entry.election.isActive,
            votingMethod: entry.election.votingMethod,
            coinjoinEnabled: entry.election.coinjoinEnabled,
            blockchainNetwork: entry.election.blockchainNetwork,
            votedAt: entry.votedAt,
            candidates: entry.election.candidates.map(candidate => ({
                id: candidate.id,
                name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                party: candidate.party,
                voteEncoding: candidate.voteEncoding,
                bitcoinAddress: candidate.bitcoinAddress,
                votes: candidate.totalVotesReceived || 0
            }))
        }));

        res.json({
            success: true,
            elections: elections,
            total: elections.length,
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName
            }
        });

    } catch (error) {
        console.error('[VOTE SERVICE]  Errore caricamento elezioni votate:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento delle elezioni votate',
            details: error.message 
        });
    }
});

// GET /api/elections/:id/results - Risultati di un'elezione specifica
router.get('/:id/results', extractUserFromHeaders, async (req, res) => {
    try {
        const { id: electionId } = req.params;
        const userId = req.user.id;
        
        console.log(`[VOTE SERVICE]  Richiesta risultati elezione ${electionId} per utente ${userId}`);

        // 1. Trova l'elezione con candidati
        const election = await Election.findByPk(electionId, {
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress', 'totalVotesReceived']
                }
            ]
        });

        if (!election) {
            return res.status(404).json({ 
                error: 'Elezione non trovata' 
            });
        }

        // 2. Verifica che l'utente abbia votato per questa elezione
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                electionId: electionId,
                userId: userId,
                hasVoted: true  // L'utente deve aver votato
            }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ 
                error: 'Non hai partecipato a questa elezione o non hai ancora votato' 
            });
        }

        // 3. CONTROLLO PRINCIPALE: I risultati sono visibili solo se l'elezione è completata
        if (election.status !== 'completed') {
            return res.status(400).json({ 
                error: 'I risultati saranno disponibili al termine dell\'elezione',
                electionStatus: election.status,
                message: 'L\'elezione deve essere conclusa per visualizzare i risultati'
            });
        }

        console.log(`[VOTE SERVICE]  Elezione completata, mostrando risultati`);

        // 4. Costruisci i risultati con i voti ricevuti da ogni candidato
        const results = election.candidates.map(candidate => ({
            id: candidate.id,
            name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            party: candidate.party,
            voteEncoding: candidate.voteEncoding,
            bitcoinAddress: candidate.bitcoinAddress,
            votes: candidate.totalVotesReceived || 0
        }));

        console.log("RISULTATI");
        console.log(results);

        // 5. Calcola statistiche aggiuntive
        const totalVotes = results.reduce((sum, candidate) => sum + candidate.totalVotesReceived, 0);
        const winner = results.reduce((max, candidate) => 
            candidate.totalVotesReceived > (max?.totalVotesReceived || 0) ? candidate : max, null);

        // 6. Ordina per numero di voti (decrescente)
        results.sort((a, b) => b.totalVotesReceived - a.totalVotesReceived);

        console.log(`[VOTE SERVICE]  Risultati calcolati: ${totalVotes} voti totali`);

        res.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                description: election.description,
                startDate: election.startDate,
                endDate: election.endDate,
                status: election.status,
                isActive: election.isActive,
                completedAt: election.updatedAt  // Quando è stata aggiornata l'ultima volta
            },
            results: results,
            statistics: {
                totalVotes: totalVotes,
                totalCandidates: results.length,
                winner: winner,
                participantCount: totalVotes,  // Nel sistema WabiSabi ogni persona vota una volta
                completedAt: election.updatedAt
            },
            userInfo: {
                hasVoted: true,
                votedAt: whitelistEntry.votedAt
            }
        });

    } catch (error) {
        console.error('[VOTE SERVICE]  Errore caricamento risultati:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dei risultati',
            details: error.message 
        });
    }
});

// GET /api/elections/:id - Dettagli elezione specifica
router.get('/:id', extractUserFromHeaders, async (req, res) => {
    try {
        const { id: electionId } = req.params;
        const userId = req.user.id;
        
        console.log(`[VOTE SERVICE] 📋 Richiesta dettagli elezione ${electionId} per utente ${userId}`);

        // 1. Trova l'elezione con candidati
        const election = await Election.findByPk(electionId, {
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress']
                }
            ]
        });

        if (!election) {
            return res.status(404).json({ 
                error: 'Elezione non trovata' 
            });
        }

        // 2. Verifica che l'elezione sia attiva
        const now = new Date();
        if (election.status !== 'active' || !election.isActive || 
            now < new Date(election.startDate) || now > new Date(election.endDate)) {
            return res.status(400).json({ 
                error: 'Elezione non attiva o non nel periodo di voto' 
            });
        }

        // 3. Verifica che l'utente sia in whitelist
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                electionId: electionId,
                userId: userId
            }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ 
                error: 'Utente non autorizzato per questa elezione' 
            });
        }

        // 4. Verifica che l'utente non abbia già votato
        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ 
                error: 'Utente ha già espresso il voto per questa elezione',
                votedAt: whitelistEntry.votedAt
            });
        }

        console.log(`[VOTE SERVICE]  Dettagli elezione ${electionId} autorizzati per utente ${userId}`);

        res.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                description: election.description,
                startDate: election.startDate,
                endDate: election.endDate,
                status: election.status,
                isActive: election.isActive,
                votingMethod: election.votingMethod,
                coinjoinEnabled: election.coinjoinEnabled,
                coinjoinTrigger: election.coinjoinTrigger,
                blockchainNetwork: election.blockchainNetwork,
                candidates: election.candidates.map(candidate => ({
                    id: candidate.id,
                    name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
                    firstName: candidate.firstName,
                    lastName: candidate.lastName,
                    party: candidate.party,
                    voteEncoding: candidate.voteEncoding,
                    bitcoinAddress: candidate.bitcoinAddress
                }))
            },
            userWhitelist: {
                authorizedAt: whitelistEntry.authorizedAt,
                hasVoted: whitelistEntry.hasVoted,
                votedAt: whitelistEntry.votedAt
            }
        });

    } catch (error) {
        console.error(`[VOTE SERVICE]  Errore caricamento elezione ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dei dettagli dell\'elezione',
            details: error.message 
        });
    }
});

// POST /api/elections/:id/vote - Invio voto per elezione specifica
router.post('/:id/vote', extractUserFromHeaders, async (req, res) => {
    try {
        const { id: electionId } = req.params;
        const userId = req.user.id;
        const { credential, commitment, zkProof, candidateId } = req.body;
        
        console.log(`[VOTE SERVICE] 🗳️ Ricevuto voto per elezione ${electionId} da utente ${userId}`);

        // TODO: Implementare logica di processamento voto
        // 1. Validare credenziale KVAC
        // 2. Verificare zero-knowledge proof
        // 3. Validare commitment
        // 4. Marcare utente come votato
        // 5. Salvare voto anonimo
        // 6. Trigger CoinJoin se necessario

        // Per ora risposta mock
        res.json({
            success: true,
            message: 'Voto ricevuto e in elaborazione',
            voteId: `vote_${Date.now()}`,
            status: 'pending',
            electionId: electionId
        });

    } catch (error) {
        console.error(`[VOTE SERVICE]  Errore invio voto elezione ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Errore nell\'invio del voto',
            details: error.message 
        });
    }
});

// GET /api/elections/debug - Route di debug per verificare header
router.get('/debug', async (req, res) => {
    console.log('[VOTE SERVICE DEBUG] Headers ricevuti:');
    console.log('  Authorization:', req.headers.authorization ? 'PRESENTE' : 'MANCANTE');
    console.log('  x-user-id:', req.headers['x-user-id'] || 'MANCANTE');
    console.log('  x-user-email:', req.headers['x-user-email'] || 'MANCANTE');
    console.log('  User-Agent:', req.headers['user-agent'] || 'N/A');
    
    res.json({
        debug: true,
        timestamp: new Date().toISOString(),
        headers: {
            authorization: !!req.headers.authorization,
            'x-user-id': req.headers['x-user-id'],
            'x-user-email': req.headers['x-user-email'],
            'content-type': req.headers['content-type']
        },
        message: 'Headers ricevuti dal vote-service'
    });
});

module.exports = router;
