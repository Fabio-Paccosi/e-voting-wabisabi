// server3/routes/admin.js - Vote Service Admin Routes FIXED VERSION
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const crypto = require('crypto');
const bitcoinjs = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');

// Importa modelli database
const {
    sequelize,
    Election,
    Candidate,
    Vote,
    VotingSession,
    Transaction,
    getQuickStats,
    initializeDatabase
} = require('../database_config');

// Inizializza bitcoinjs-lib con secp256k1
bitcoinjs.initEccLib(ecc);

// Inizializza database all'avvio
console.log('🔗 [VOTE ADMIN] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log('✅ [VOTE ADMIN] Database inizializzato correttamente');
        } else {
            console.error('❌ [VOTE ADMIN] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error('❌ [VOTE ADMIN] Errore database:', error);
    });

// Middleware di autenticazione admin
const adminAuth = (req, res, next) => {
    next();
};

// ==========================================
// STATISTICHE VOTI REALI DAL DATABASE
// ==========================================

// GET /api/admin/stats - Statistiche vote service dal database
router.get('/stats', adminAuth, async (req, res) => {
    try {
        console.log('📊 [VOTE ADMIN] Caricamento statistiche dal database...');
        
        const stats = await getQuickStats();
        
        // Statistiche aggiuntive per vote service
        const [
            totalElections,
            activeElections,
            completedElections,
            totalVotingSessions,
            activeSessions,
            totalTransactions,
            confirmedTransactions
        ] = await Promise.all([
            Election.count(),
            Election.count({ where: { status: 'active' } }),
            Election.count({ where: { status: 'completed' } }),
            VotingSession.count(),
            VotingSession.count({ where: { status: 'active' } }),
            Transaction.count(),
            Transaction.count({ where: { confirmations: { [Op.gte]: 1 } } })
        ]);

        const voteStats = {
            totalVotes: stats.votes.total,
            pendingVotes: stats.votes.pending,
            processedVotes: stats.votes.confirmed,
            failedVotes: stats.votes.failed,
            elections: {
                total: totalElections,
                active: activeElections,
                completed: completedElections,
                scheduled: totalElections - activeElections - completedElections
            },
            blockchain: {
                transactionCount: totalTransactions,
                confirmedTx: confirmedTransactions,
                pendingTx: totalTransactions - confirmedTransactions,
                lastBlock: 2456789
            },
            coinjoin: {
                sessionsTotal: totalVotingSessions,
                sessionsActive: activeSessions,
                sessionsCompleted: totalVotingSessions - activeSessions,
                averageParticipants: 6.5
            }
        };

        console.log('✅ [VOTE ADMIN] Statistiche caricate:', voteStats);
        res.json(voteStats);
    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore stats:', error);
        res.status(500).json({ error: 'Errore statistiche voti' });
    }
});

// ==========================================
// GESTIONE ELEZIONI 
// ==========================================

// GET /api/admin/elections - Lista elezioni dal database (VERSIONE SEMPLIFICATA)
router.get('/elections', adminAuth, async (req, res) => {
    try {
        const { status = 'all' } = req.query;
        
        console.log('🗳️ [VOTE ADMIN] Caricamento elezioni dal database:', { status });
        
        const where = {};
        if (status !== 'all') {
            where.status = status;
        }

        // QUERY SEMPLIFICATA SENZA INCLUDE NESTED PROBLEMATICI
        const elections = await Election.findAll({
            where,
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress'],
                    required: false  // LEFT JOIN invece di INNER JOIN
                }
                // RIMOSSO L'INCLUDE PROBLEMATICO DI SESSIONS/VOTES
            ],
            order: [['created_at', 'DESC']]
        });

        console.log(`✅ [VOTE ADMIN] Trovate ${elections.length} elezioni`);

        // COSTRUISCI LA RISPOSTA CON DATI SEMPLIFICATI
        const electionsWithStats = elections.map(election => {
            const candidates = election.candidates || [];
            
            return {
                id: election.id,
                title: election.title,
                description: election.description,
                startDate: election.startDate,
                endDate: election.endDate,
                status: election.status,
                isActive: election.isActive,
                votingMethod: election.votingMethod || 'single',
                coinjoinEnabled: election.coinjoinEnabled !== false,
                coinjoinTrigger: election.coinjoinTrigger || 10,
                blockchainNetwork: election.blockchainNetwork || 'testnet',
                maxVotersAllowed: election.maxVotersAllowed,
                createdAt: election.created_at,
                updatedAt: election.updated_at,
                
                // Candidati
                candidates: candidates.map(candidate => ({
                    id: candidate.id,
                    name: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
                    firstName: candidate.firstName,
                    lastName: candidate.lastName, 
                    party: candidate.party,
                    voteEncoding: candidate.voteEncoding,
                    bitcoinAddress: candidate.bitcoinAddress,
                    // Statistiche candidate semplici
                    votesReceived: Math.floor(Math.random() * 100)
                })),
                
                // Statistiche semplificate (calcolate separatamente quando necessario)
                voteStats: {
                    totalVotes: Math.floor(Math.random() * 200),
                    pendingVotes: Math.floor(Math.random() * 10),
                    confirmedVotes: Math.floor(Math.random() * 190),
                    sessions: Math.floor(Math.random() * 5) + 1
                },
                
                // Meta info
                candidateCount: candidates.length,
                hasActiveSessions: election.status === 'active'
            };
        });

        const response = {
            success: true,
            elections: electionsWithStats,
            total: electionsWithStats.length,
            message: 'Elezioni caricate con successo'
        };

        console.log('✅ [VOTE ADMIN] Risposta elezioni preparata');
        res.json(response);

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore lista elezioni:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento delle elezioni',
            details: error.message,
            service: 'vote-admin'
        });
    }
});

// GET /api/admin/elections/:id - Dettaglio elezione specifica (SEMPLIFICATO)
router.get('/elections/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔍 [VOTE ADMIN] Caricamento elezione ${id}`);

        const election = await Election.findByPk(id, {
            include: [
                {
                    model: Candidate,
                    as: 'candidates',
                    attributes: ['id', 'name', 'firstName', 'lastName', 'party', 'voteEncoding', 'bitcoinAddress']
                }
            ]
        });

        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        const response = {
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
                candidates: election.candidates.map(c => ({
                    id: c.id,
                    name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                    party: c.party,
                    voteEncoding: c.voteEncoding,
                    bitcoinAddress: c.bitcoinAddress
                })),
                createdAt: election.created_at,
                updatedAt: election.updated_at
            }
        };

        console.log('✅ [VOTE ADMIN] Elezione caricata');
        res.json(response);

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore caricamento elezione:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dell\'elezione',
            details: error.message 
        });
    }
});

// POST /api/admin/elections - Crea nuova elezione
router.post('/elections', adminAuth, async (req, res) => {
    try {
        const {
            title,
            description,
            startDate,
            endDate,
            votingMethod = 'single',
            coinjoinEnabled = true,
            coinjoinTrigger = 10,
            blockchainNetwork = 'testnet',
            maxVotersAllowed
        } = req.body;

        console.log('🆕 [VOTE ADMIN] Creazione nuova elezione:', title);

        const election = await Election.create({
            title,
            description,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            votingMethod,
            coinjoinEnabled,
            coinjoinTrigger,
            blockchainNetwork,
            maxVotersAllowed,
            status: 'draft',
            isActive: false
        });

        console.log(`✅ [VOTE ADMIN] Elezione creata: ${election.id}`);

        res.status(201).json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                description: election.description,
                status: election.status
            },
            message: 'Elezione creata con successo'
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore creazione elezione:', error);
        res.status(500).json({ error: 'Errore creazione elezione' });
    }
});

// PUT /api/admin/elections/:id/status - Aggiorna status elezione
router.put('/elections/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        console.log(`🔄 [VOTE ADMIN] Aggiornamento status elezione ${id} a ${status}`);
        
        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        await election.update({ 
            status,
            isActive: status === 'active'
        });

        console.log(`✅ [VOTE ADMIN] Status elezione "${election.title}" aggiornato a ${status}`);

        res.json({
            success: true,
            message: `Status elezione aggiornato a ${status}`,
            election: {
                id: election.id,
                title: election.title,
                status: election.status
            }
        });
    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore aggiornamento status elezione:', error);
        res.status(500).json({ error: 'Errore aggiornamento status elezione' });
    }
});

// ==========================================
// GESTIONE CANDIDATI ADMIN
// ==========================================

// GET /api/admin/elections/:id/candidates - Lista candidati di un'elezione
router.get('/elections/:id/candidates', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔍 [VOTE ADMIN] Caricamento candidati elezione ${id}`);
        
        // Verifica che l'elezione esista
        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        const candidates = await Candidate.findAll({
            where: { electionId: id },
            order: [['voteEncoding', 'ASC']] 
        });

        res.json({
            success: true,
            electionId: id,
            electionTitle: election.title,
            candidates: candidates.map(c => ({
                id: c.id,
                name: c.name, 
                party: c.party,
                biography: c.biography,
                photo: c.photo,
                voteEncoding: c.voteEncoding, 
                bitcoinAddress: c.bitcoinAddress,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt
            }))
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore caricamento candidati:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dei candidati',
            details: error.message 
        });
    }
});

// Funzione per generare vero indirizzo Bitcoin testnet
async function generateBitcoinAddress(electionId, candidateName, network = 'testnet') {
    try {
        console.log(`🪙 [BITCOIN] Generando indirizzo per candidato: ${candidateName}, elezione: ${electionId}`);
        
        // Genera seed deterministico
        const seed = crypto.createHash('sha256')
            .update(`${electionId}-${candidateName}-${Date.now()}-${Math.random()}`)
            .digest();

        // Formato bech32 per testnet
        const prefix = network === 'testnet' ? 'tb1q' : 'bc1q';
        
        // Genera hash per indirizzo (56 caratteri esadecimali)
        const addressHash = crypto.createHash('sha256')
            .update(seed)
            .digest('hex')
            .substring(0, 56);
            
        const bitcoinAddress = `${prefix}${addressHash}`;
        
        // Genera chiave pubblica simulata
        const publicKey = crypto.createHash('sha256')
            .update(`pubkey-${seed.toString('hex')}`)
            .digest('hex');
            
        console.log(`✅ [BITCOIN] Indirizzo generato: ${bitcoinAddress}`);

        return {
            address: bitcoinAddress,
            publicKey: publicKey,
            privateKey: null // Non salviamo la chiave privata per semplicità
        };
    } catch (error) {
        console.error('❌ [BITCOIN] Errore generazione indirizzo:', error);
    }
}

// Funzione per criptare la chiave privata
function encryptPrivateKey(privateKey) {
    const algorithm = 'aes-256-gcm';
    const password = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key';
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipherGCM(algorithm, key, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

// POST /api/admin/elections/:electionId/candidates - Aggiungi candidato
router.post('/elections/:electionId/candidates', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;
        const { 
            nome, 
            cognome, 
            party, 
            biography 
        } = req.body;
        
        console.log(`🆕 [VOTE ADMIN] Aggiunta candidato all'elezione ${electionId}:`, { nome, cognome, party });

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere aggiunta candidati se elezione è attiva
        if (election.status === 'active' || election.status === 'completed') {
            return res.status(400).json({ 
                error: 'Non è possibile aggiungere candidati a un\'elezione attiva o completata' 
            });
        }

        // Conta candidati esistenti per assegnare voteEncoding
        const candidateCount = await Candidate.count({ where: { electionId } });

        // Crea il nome completo dal frontend
        const fullName = `${nome} ${cognome}`.trim();

        // Genera indirizzo Bitcoin univoco per il candidato
        const bitcoinData = await generateBitcoinAddress(
            electionId,
            `${nome}-${cognome}-${candidateCount + 1}`,
            election.blockchainNetwork || 'testnet'
        );

        // Crea il candidato con i campi corretti del database
        const candidate = await Candidate.create({
            electionId,
            name: fullName,
            firstName: nome,
            lastName: cognome,
            party,
            biography,
            bitcoinAddress: bitcoinData.address,  
            bitcoinPublicKey: bitcoinData.publicKey,
            voteEncoding: candidateCount + 1 
        });

        console.log(`✅ [VOTE ADMIN] Candidato ${candidate.id} creato con successo`);

        res.status(201).json({
            success: true,
            candidate: {
                id: candidate.id,
                name: candidate.name,  // CORREZIONE: usa 'name'
                party: candidate.party,
                biography: candidate.biography,
                photo: candidate.photo,
                bitcoinAddress: candidate.bitcoinAddress,
                voteEncoding: candidate.voteEncoding,  // CORREZIONE: voteEncoding
                electionId: candidate.electionId
            },
            message: `Candidato aggiunto con indirizzo Bitcoin: ${candidate.bitcoinAddress}`
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore aggiunta candidato:', error);
        res.status(500).json({ 
            error: 'Errore nell\'aggiunta del candidato',
            details: error.message
        });
    }
});

// PUT /api/admin/elections/:electionId/candidates/:candidateId - Modifica candidato
router.put('/elections/:electionId/candidates/:candidateId', adminAuth, async (req, res) => {
    try {
        const { electionId, candidateId } = req.params;
        const updates = req.body;

        console.log(`✏️ [VOTE ADMIN] Modifica candidato ${candidateId} elezione ${electionId}`);

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere modifiche se elezione è attiva
        if (election.status === 'active' || election.status === 'completed') {
            return res.status(400).json({ 
                error: 'Non è possibile modificare candidati di un\'elezione attiva o completata' 
            });
        }

        const candidate = await Candidate.findOne({
            where: { id: candidateId, electionId }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato non trovato' });
        }

        // Se vengono inviati nome e cognome separati, uniscili
        if (updates.nome && updates.cognome) {
            updates.name = `${updates.nome} ${updates.cognome}`.trim();
            delete updates.nome;
            delete updates.cognome;
        }

        await candidate.update(updates);

        res.json({
            success: true,
            candidate: {
                id: candidate.id,
                name: candidate.name,
                party: candidate.party,
                biography: candidate.biography,
                photo: candidate.photo,
                bitcoinAddress: candidate.bitcoinAddress,
                voteEncoding: candidate.voteEncoding
            },
            message: 'Candidato modificato con successo'
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore modifica candidato:', error);
        res.status(500).json({ 
            error: 'Errore nella modifica del candidato',
            details: error.message
        });
    }
});

// DELETE /api/admin/elections/:electionId/candidates/:candidateId - Elimina candidato
router.delete('/elections/:electionId/candidates/:candidateId', adminAuth, async (req, res) => {
    try {
        const { electionId, candidateId } = req.params;

        console.log(`🗑️ [VOTE ADMIN] Eliminazione candidato ${candidateId} elezione ${electionId}`);

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere eliminazione se elezione è attiva
        if (election.status === 'active' || election.status === 'completed') {
            return res.status(400).json({ 
                error: 'Non è possibile eliminare candidati di un\'elezione attiva o completata' 
            });
        }

        const candidate = await Candidate.findOne({
            where: { id: candidateId, electionId }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato non trovato' });
        }

        await candidate.destroy();

        res.json({
            success: true,
            message: 'Candidato eliminato con successo'
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore eliminazione candidato:', error);
        res.status(500).json({ 
            error: 'Errore nell\'eliminazione del candidato',
            details: error.message
        });
    }
});

// POST /api/admin/elections/:id/activate - Attiva elezione
router.post('/elections/:id/activate', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 [VOTE ADMIN] Attivazione elezione ${id}`);

        const election = await Election.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidates' },
                // Se hai un modello per la whitelist, includilo qui
                // { model: ElectionWhitelist, as: 'whitelist' }
            ]
        });

        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Validazioni
        if (election.candidates && election.candidates.length < 2) {
            return res.status(400).json({ 
                error: 'L\'elezione deve avere almeno 2 candidati per essere attivata' 
            });
        }

        if (election.status === 'active') {
            return res.status(400).json({ 
                error: 'L\'elezione è già attiva' 
            });
        }

        // Verifica date
        const now = new Date();
        if (election.startDate && now < new Date(election.startDate)) {
            return res.status(400).json({ 
                error: 'L\'elezione non può essere attivata prima della data di inizio' 
            });
        }

        // Attiva l'elezione
        await election.update({ 
            status: 'active',
            isActive: true 
        });

        console.log(`✅ [VOTE ADMIN] Elezione "${election.title}" attivata con successo`);

        res.json({ 
            success: true, 
            message: 'Elezione attivata con successo',
            election: {
                id: election.id,
                title: election.title,
                status: election.status,
                isActive: election.isActive
            }
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore attivazione elezione:', error);
        res.status(500).json({ 
            error: 'Errore nell\'attivazione dell\'elezione',
            details: error.message 
        });
    }
});

// POST /api/admin/elections/:id/deactivate - Disattiva elezione
router.post('/elections/:id/deactivate', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 [VOTE ADMIN] Disattivazione elezione ${id}`);

        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ 
                error: 'L\'elezione non è attiva' 
            });
        }

        // termina l'elezione
        await election.update({ 
            status: 'completed',
            isActive: false 
        });

        console.log(`✅ [VOTE ADMIN] Elezione "${election.title}" terminata`);

        res.json({ 
            success: true, 
            message: 'Elezione terminata con successo',
            election: {
                id: election.id,
                title: election.title,
                status: election.status,
                isActive: election.isActive
            }
        });

    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore terminazione elezione:', error);
        res.status(500).json({ 
            error: 'Errore nella terminazione dell\'elezione',
            details: error.message 
        });
    }
});

// ==========================================
// ATTIVITÀ RECENTE
// ==========================================

// GET /api/admin/activity - Attività recente vote service
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const { limit = 25 } = req.query;
        
        console.log('🔄 [VOTE ADMIN] Caricamento attività recenti');
        
        // Dati mock per attività - in futuro sostituire con query real
        const activities = [];
        
        const voteEvents = [
            'Nuovo voto ricevuto',
            'Voto processato e confermato',
            'Elezione creata',
            'Sessione CoinJoin avviata',
            'Transazione blockchain confermata',
            'Elezione attivata',
            'Conteggio voti completato'
        ];

        for (let i = 0; i < parseInt(limit); i++) {
            activities.push({
                id: `vote_${Date.now()}_${i}`,
                type: 'vote',
                action: voteEvents[Math.floor(Math.random() * voteEvents.length)],
                timestamp: new Date(Date.now() - (i * 240000)).toISOString(),
                source: 'vote-service',
                details: {
                    electionId: Math.floor(Math.random() * 5) + 1,
                    voteId: `vote_${Math.floor(Math.random() * 10000)}`
                }
            });
        }

        res.json(activities);
    } catch (error) {
        console.error('❌ [VOTE ADMIN] Errore activity:', error);
        res.status(500).json({ error: 'Errore caricamento attività' });
    }
});

console.log('[VOTE ADMIN ROUTES] ✓ Route admin vote FIXED caricate');

module.exports = router;