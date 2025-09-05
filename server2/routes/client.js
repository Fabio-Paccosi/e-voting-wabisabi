const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Importa modelli database - RIMOSSO Whitelist, aggiunto Election
const {
    sequelize,
    User,
    Election,
    ElectionWhitelist,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('auth');

const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Inizializza database all'avvio
console.log('[AUTH CLIENT] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log(' [AUTH CLIENT] Database inizializzato correttamente');
        } else {
            console.error(' [AUTH CLIENT] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error(' [AUTH CLIENT] Errore database:', error);
    });

// ==========================================
// FUNZIONE HELPER PER ELEZIONE ATTIVA
// ==========================================

/**
 * Trova l'elezione attiva corrente
 * Se non specificata, usa quella con status 'active'
 */
async function getCurrentElection(electionId = null) {
    try {
        if (electionId) {
            return await Election.findByPk(electionId);
        }
        
        // Cerca l'elezione attiva
        const activeElection = await Election.findOne({
            where: {
                status: 'active',
                isActive: true,
                startDate: { [Op.lte]: new Date() },
                endDate: { [Op.gte]: new Date() }
            },
            order: [['startDate', 'DESC']]
        });
        
        if (activeElection) {
            return activeElection;
        }
        
        // Se non c'è elezione attiva, prende la più recente
        return await Election.findOne({
            order: [['createdAt', 'DESC']]
        });
        
    } catch (error) {
        console.error(' Errore ricerca elezione:', error);
        return null;
    }
}

// ==========================================
// AUTENTICAZIONE UTENTI NORMALI
// ==========================================

// POST /api/auth/login - Login utenti normali con email e codice fiscale
/*
router.post('/auth/login', async (req, res) => {
    try {
        const { email, taxCode, electionId } = req.body;
        console.log('🔐 [AUTH CLIENT] Tentativo login utente:', email + " - " + taxCode);

        // Validazione input
        if (!email || !taxCode) {
            return res.status(400).json({ 
                error: 'Email e codice fiscale sono richiesti' 
            });
        }

        // Cerca l'utente nel database
        const user = await User.findOne({
            where: {
                email: email.toLowerCase(),
                taxCode: taxCode.toUpperCase()
            }
        });

        if (!user) {
            console.log(' [AUTH CLIENT] Utente non trovato:', email);
            return res.status(401).json({ 
                error: 'Credenziali non valide' 
            });
        }

        // Trova l'elezione corrente
        const currentElection = await getCurrentElection(electionId);
        if (!currentElection) {
            return res.status(400).json({ 
                error: 'Nessuna elezione disponibile' 
            });
        }

        // Verifica che l'utente sia nella whitelist per questa elezione
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                userId: user.id,
                electionId: currentElection.id
            }
        });

        if (!whitelistEntry) {
            console.log(' [AUTH CLIENT] Utente non autorizzato per elezione:', user.email, currentElection.id);
            return res.status(403).json({ 
                error: 'Utente non autorizzato per questa elezione' 
            });
        }

        // Verifica se può votare
        if (whitelistEntry.hasVoted) {
            console.log('[AUTH CLIENT] Utente ha già votato:', user.email);
            return res.status(403).json({ 
                error: 'Hai già espresso il tuo voto' 
            });
        }

        // Genera token JWT
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                electionId: currentElection.id,
                whitelistId: whitelistEntry.id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(' [AUTH CLIENT] Login riuscito per:', user.email);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                nome: user.firstName,
                cognome: user.lastName,
                codiceFiscale: user.taxCode,
                status: user.status
            },
            election: {
                id: currentElection.id,
                title: currentElection.title,
                status: currentElection.status
            },
            whitelist: {
                id: whitelistEntry.id,
                authorizedAt: whitelistEntry.authorizedAt,
                hasVoted: whitelistEntry.hasVoted,
                canVote: !whitelistEntry.hasVoted
            }
        });

    } catch (error) {
        console.error(' [AUTH CLIENT] Errore login:', error);
        res.status(500).json({ 
            error: 'Errore nell\'autenticazione utente',
            details: {
                error: 'Errore interno del server',
                details: error.message
            },
            service: 'auth'
        });
    }
});
*/

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password, taxCode } = req.body;
        console.log('🔐 [AUTH CLIENT] Tentativo login utente:', email || taxCode);
        
        if (!email && !taxCode) {
            return res.status(400).json({ 
                error: 'Email o codice fiscale richiesti' 
            });
        }
        
        if (!password) {
            return res.status(400).json({ 
                error: 'Password richiesta' 
            });
        }
        
        // Trova l'utente per email o codice fiscale
        const whereClause = {};
        if (email) {
            whereClause.email = email.toLowerCase();
        }
        if (taxCode) {
            whereClause.taxCode = taxCode.toUpperCase();
        }
        
        const user = await User.findOne({
            where: whereClause
        });
        
        if (!user) {
            console.log(' [AUTH CLIENT] Utente non trovato:', email || taxCode);
            return res.status(401).json({ 
                error: 'Credenziali non valide' 
            });
        }
        
        // Verifica password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log(' [AUTH CLIENT] Password non valida per:', user.email);
            return res.status(401).json({ 
                error: 'Credenziali non valide' 
            });
        }
        
        // Verifica che l'utente sia attivo
        if (user.status !== 'active') {
            console.log(' [AUTH CLIENT] Utente non attivo:', user.email);
            return res.status(403).json({ 
                error: 'Account non attivo. Contattare l\'amministratore.' 
            });
        }
        
        // Verifica che l'utente sia autorizzato
        if (!user.isAuthorized) {
            console.log(' [AUTH CLIENT] Utente non autorizzato:', user.email);
            return res.status(403).json({ 
                error: 'Account non autorizzato per il voto. Contattare l\'amministratore.' 
            });
        }
        
        // Genera token JWT
        const token = jwt.sign(
            { 
                userId: user.id,
                id: user.id, // Compatibilità con diversi formati
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'user',
                isAuthorized: user.isAuthorized,
                iat: Math.floor(Date.now() / 1000)
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log(' [AUTH CLIENT] Login riuscito per:', user.email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                taxCode: user.taxCode,
                role: 'user',
                isAuthorized: user.isAuthorized,
                status: user.status
            }
        });
        
    } catch (error) {
        console.error(' [AUTH CLIENT] Errore login:', error);
        res.status(500).json({ 
            error: 'Errore interno del server' 
        });
    }
});

// GET /api/auth/profile - Profilo utente autenticato
router.get('/auth/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Token di autenticazione richiesto' 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id);

        if (!user) {
            return res.status(404).json({ 
                error: 'Utente non trovato' 
            });
        }

        // Carica anche i dati della whitelist
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                userId: user.id,
                electionId: decoded.electionId
            },
            include: [{
                model: Election,
                as: 'election',
                attributes: ['id', 'title', 'status', 'startDate', 'endDate']
            }]
        });

        console.log('[AUTH CLIENT] Profilo caricato per:', user.email);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nome: user.firstName,
                cognome: user.lastName,
                codiceFiscale: user.taxCode,
                status: user.status,
                //createdAt: user.createdAt
            },
            election: whitelistEntry?.election || null,
            whitelist: whitelistEntry ? {
                id: whitelistEntry.id,
                authorizedAt: whitelistEntry.authorizedAt,
                hasVoted: whitelistEntry.hasVoted,
                canVote: !whitelistEntry.hasVoted
            } : null
        });

    } catch (error) {
        console.error(' [AUTH CLIENT] Errore profilo:', error);
        res.status(401).json({ 
            error: 'Token non valido' 
        });
    }
});

// GET /api/auth/verify - Verifica autenticazione utente
router.post('/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                valid: false,
                error: 'Token richiesto' 
            });
        }
        
        console.log(' [AUTH CLIENT] Verifica token utente normale');
        
        // Verifica il token JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log(' [AUTH CLIENT] Token decodificato:', {
            userId: decoded.userId || decoded.id,
            email: decoded.email,
            role: decoded.role
        });
        
        // Trova l'utente nel database per verificare che esista ancora
        let user = null;
        if (decoded.userId || decoded.id) {
            user = await User.findByPk(decoded.userId || decoded.id);
        } else if (decoded.email) {
            user = await User.findOne({
                where: { email: decoded.email }
            });
        }
        
        if (!user) {
            console.log(' [AUTH CLIENT] Utente non trovato nel database');
            return res.status(401).json({ 
                valid: false,
                error: 'Utente non trovato' 
            });
        }
        
        // Verifica che l'utente sia attivo
        if (user.status !== 'active') {
            console.log(' [AUTH CLIENT] Utente non attivo');
            return res.status(401).json({ 
                valid: false,
                error: 'Utente non attivo' 
            });
        }
        
        // Verifica che l'utente sia autorizzato
        if (!user.isAuthorized) {
            console.log(' [AUTH CLIENT] Utente non autorizzato');
            return res.status(403).json({ 
                valid: false,
                error: 'Utente non autorizzato' 
            });
        }
        
        console.log(' [AUTH CLIENT] Token valido per utente:', user.email);
        
        res.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: decoded.role || 'user',
                isAuthorized: user.isAuthorized,
                status: user.status
            }
        });
        
    } catch (error) {
        console.error(' [AUTH CLIENT] Errore verifica token:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                valid: false,
                error: 'Token non valido' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                valid: false,
                error: 'Token scaduto' 
            });
        }
        
        res.status(500).json({ 
            valid: false,
            error: 'Errore interno del server' 
        });
    }
});

// ==========================================
// WHITELIST MANAGEMENT
// ==========================================

// GET /api/whitelist/check - Verifica status whitelist per elezione
router.get('/whitelist/check', async (req, res) => {
    try {
        const { codice_fiscale, email, electionId } = req.query;
        console.log('[AUTH CLIENT] Verifica whitelist per:', codice_fiscale || email);

        if (!codice_fiscale && !email) {
            return res.status(400).json({ 
                error: 'Codice fiscale o email richiesti' 
            });
        }

        // Trova l'elezione
        const currentElection = await getCurrentElection(electionId);
        if (!currentElection) {
            return res.status(400).json({ 
                error: 'Elezione non trovata' 
            });
        }

        // Trova l'utente
        const whereClause = {};
        if (codice_fiscale) {
            whereClause.taxCode = codice_fiscale.toUpperCase();
        }
        if (email) {
            whereClause.email = email.toLowerCase();
        }

        const user = await User.findOne({
            where: whereClause
        });

        if (!user) {
            return res.json({
                inWhitelist: false,
                isActive: false,
                canVote: false,
                message: 'Utente non registrato nel sistema'
            });
        }

        // Verifica whitelist per l'elezione
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                userId: user.id,
                electionId: currentElection.id
            }
        });

        const response = {
            inWhitelist: !!whitelistEntry,
            isActive: !!whitelistEntry,
            canVote: whitelistEntry && !whitelistEntry.hasVoted,
            election: {
                id: currentElection.id,
                title: currentElection.title,
                status: currentElection.status
            }
        };

        if (whitelistEntry) {
            response.details = {
                addedAt: whitelistEntry.authorizedAt,
                hasVoted: whitelistEntry.hasVoted,
                votedAt: whitelistEntry.votedAt
            };
        }

        console.log(' [AUTH CLIENT] Status whitelist verificato');
        res.json(response);

    } catch (error) {
        console.error(' [AUTH CLIENT] Errore verifica whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nella verifica whitelist' 
        });
    }
});

// POST /api/whitelist/register - Registrazione richiesta per whitelist
router.post('/whitelist/register', async (req, res) => {
    try {
        const { email, codice_fiscale, nome, cognome, electionId } = req.body;
        console.log('📝 [AUTH CLIENT] Richiesta registrazione whitelist:', email);

        // Validazione input
        if (!email || !codice_fiscale || !nome || !cognome) {
            return res.status(400).json({ 
                error: 'Tutti i campi sono richiesti' 
            });
        }

        // Trova o crea l'elezione
        const currentElection = await getCurrentElection(electionId);
        if (!currentElection) {
            return res.status(400).json({ 
                error: 'Elezione non trovata' 
            });
        }

        // Verifica se l'utente esiste già
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { email: email.toLowerCase() },
                    { taxCode: codice_fiscale.toUpperCase() }
                ]
            }
        });

        let user;
        if (existingUser) {
            user = existingUser;
        } else {
            // Crea nuovo utente
            user = await User.create({
                email: email.toLowerCase(),
                taxCode: codice_fiscale.toUpperCase(),
                firstName: nome.trim(),
                lastName: cognome.trim(),
                status: 'pending' // In attesa di approvazione
            });
        }

        // Verifica se già nella whitelist per questa elezione
        const existingWhitelist = await ElectionWhitelist.findOne({
            where: {
                userId: user.id,
                electionId: currentElection.id
            }
        });

        if (existingWhitelist) {
            return res.status(409).json({ 
                error: 'Già registrato per questa elezione' 
            });
        }

        // NOTA: La registrazione crea solo la richiesta, 
        // l'admin deve poi approvare aggiungendo alla whitelist
        console.log(' [AUTH CLIENT] Registrazione richiesta per:', email);

        res.status(201).json({
            success: true,
            message: 'Richiesta di registrazione ricevuta. L\'approvazione è richiesta dagli amministratori.',
            user: {
                id: user.id,
                email: user.email,
                nome: user.firstName,
                cognome: user.lastName
            },
            election: {
                id: currentElection.id,
                title: currentElection.title
            }
        });

    } catch (error) {
        console.error(' [AUTH CLIENT] Errore registrazione:', error);
        res.status(500).json({ 
            error: 'Errore nella registrazione',
            details: error.message
        });
    }
});

// GET /api/elections/current - Ottieni elezione corrente
router.get('/elections/current', async (req, res) => {
    try {
        const currentElection = await getCurrentElection();
        
        if (!currentElection) {
            return res.status(404).json({ 
                error: 'Nessuna elezione disponibile' 
            });
        }

        res.json({
            success: true,
            election: {
                id: currentElection.id,
                title: currentElection.title,
                description: currentElection.description,
                status: currentElection.status,
                startDate: currentElection.startDate,
                endDate: currentElection.endDate,
                votingMethod: currentElection.votingMethod
            }
        });

    } catch (error) {
        console.error(' [AUTH CLIENT] Errore elezione corrente:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero dell\'elezione corrente' 
        });
    }
});

// ==========================================
// STATISTICHE E SALUTE
// ==========================================

// GET /api/health - Health check
router.get('/health', async (req, res) => {
    try {
        const stats = await getQuickStats();
        
        res.json({
            status: 'ok',
            service: 'auth-client',
            timestamp: new Date().toISOString(),
            database: 'connected',
            stats
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            service: 'auth-client',
            error: error.message
        });
    }
});

module.exports = router;