const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Importa modelli database 
const {
    sequelize,
    User,
    Whitelist,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('auth');

const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Inizializza database all'avvio
console.log('🔗 [AUTH CLIENT] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log('✅ [AUTH CLIENT] Database inizializzato correttamente');
        } else {
            console.error('❌ [AUTH CLIENT] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error('❌ [AUTH CLIENT] Errore database:', error);
    });

// ==========================================
// AUTENTICAZIONE UTENTI NORMALI
// ==========================================

// POST /api/auth/login - Login utenti normali con email e codice fiscale
router.post('/auth/login', async (req, res) => {
    try {
        const { email, taxCode } = req.body;
        console.log('🔐 [AUTH CLIENT] Tentativo login utente:'+ email +" - "+ taxCode);

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
            console.log('❌ [AUTH CLIENT] Utente non trovato:', email);
            return res.status(401).json({ 
                error: 'Credenziali non valide o utente non autorizzato' 
            });
        }

        // Verifica che l'utente sia in whitelist
        const whitelistEntry = await Whitelist.findOne({
            where: { 
                codiceFiscale: taxCode.toUpperCase(),
                isActive: true 
            }
        });

        if (!whitelistEntry) {
            console.log('❌ [AUTH CLIENT] Utente non in whitelist:', email);
            return res.status(403).json({ 
                error: 'Utente non autorizzato a votare' 
            });
        }

        // Verifica che l'utente sia attivo
        if (user.status !== 'active') {
            console.log('❌ [AUTH CLIENT] Utente non attivo:', email);
            return res.status(403).json({ 
                error: 'Account non attivo' 
            });
        }

        // Genera token JWT
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                codiceFiscale: user.codiceFiscale,
                role: 'voter'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('✅ [AUTH CLIENT] Login riuscito per:', email);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                role: 'voter'
            }
        });

    } catch (error) {
        console.error('❌ [AUTH CLIENT] Errore login:', error);
        res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
});

// POST /api/auth/verify - Verifica token utente
router.post('/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        console.log('🔍 [AUTH CLIENT] Verifica token utente');

        if (!token) {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token mancante' 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Verifica che sia un token utente normale
        if (decoded.role !== 'voter') {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token non valido per utenti' 
            });
        }

        // Verifica che l'utente esista ancora nel database
        const user = await User.findByPk(decoded.id);
        if (!user || user.status !== 'active') {
            return res.status(401).json({ 
                valid: false, 
                error: 'Utente non più valido' 
            });
        }

        console.log('✅ [AUTH CLIENT] Token verificato per utente:', decoded.email);

        res.json({
            valid: true,
            user: {
                id: decoded.id,
                email: decoded.email,
                codiceFiscale: decoded.codiceFiscale,
                role: decoded.role
            }
        });

    } catch (error) {
        console.error('❌ [AUTH CLIENT] Errore verifica token:', error);
        res.status(401).json({ 
            valid: false, 
            error: 'Token non valido' 
        });
    }
});

// GET /api/auth/profile - Profilo utente
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

        console.log('👤 [AUTH CLIENT] Profilo caricato per:', user.email);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                codiceFiscale: user.codiceFiscale,
                status: user.status,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('❌ [AUTH CLIENT] Errore profilo:', error);
        res.status(401).json({ 
            error: 'Token non valido' 
        });
    }
});

// ==========================================
// WHITELIST MANAGEMENT
// ==========================================

// GET /api/whitelist/check - Verifica status whitelist
router.get('/whitelist/check', async (req, res) => {
    try {
        const { codice_fiscale, email } = req.query;
        console.log('📋 [AUTH CLIENT] Verifica whitelist per:', codice_fiscale || email);

        if (!codice_fiscale && !email) {
            return res.status(400).json({ 
                error: 'Codice fiscale o email richiesti' 
            });
        }

        const whereClause = {};
        if (codice_fiscale) {
            whereClause.codiceFiscale = codice_fiscale.toUpperCase();
        }
        if (email) {
            whereClause.email = email.toLowerCase();
        }

        const whitelistEntry = await Whitelist.findOne({
            where: whereClause
        });

        const response = {
            inWhitelist: !!whitelistEntry,
            isActive: whitelistEntry?.isActive || false,
            canVote: whitelistEntry?.isActive && !whitelistEntry?.hasVoted
        };

        if (whitelistEntry) {
            response.details = {
                addedAt: whitelistEntry.createdAt,
                hasVoted: whitelistEntry.hasVoted
            };
        }

        console.log('✅ [AUTH CLIENT] Status whitelist verificato');
        res.json(response);

    } catch (error) {
        console.error('❌ [AUTH CLIENT] Errore verifica whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nella verifica whitelist' 
        });
    }
});

// POST /api/whitelist/register - Registrazione in whitelist (se abilitata)
router.post('/whitelist/register', async (req, res) => {
    try {
        const { email, codice_fiscale, nome, cognome } = req.body;
        console.log('📝 [AUTH CLIENT] Richiesta registrazione whitelist:', email);

        // Validazione input
        if (!email || !codice_fiscale || !nome || !cognome) {
            return res.status(400).json({ 
                error: 'Tutti i campi sono richiesti' 
            });
        }

        // Verifica se già esiste
        const existingEntry = await Whitelist.findOne({
            where: {
                [Op.or]: [
                    { email: email.toLowerCase() },
                    { codiceFiscale: codice_fiscale.toUpperCase() }
                ]
            }
        });

        if (existingEntry) {
            return res.status(409).json({ 
                error: 'Email o codice fiscale già registrati' 
            });
        }

        // Crea nuova entry in whitelist
        const whitelistEntry = await Whitelist.create({
            email: email.toLowerCase(),
            codiceFiscale: codice_fiscale.toUpperCase(),
            nome: nome.trim(),
            cognome: cognome.trim(),
            isActive: false, // Deve essere attivata dall'admin
            hasVoted: false
        });

        // Crea anche l'utente se non esiste
        const [user, created] = await User.findOrCreate({
            where: { 
                email: email.toLowerCase(),
                codiceFiscale: codice_fiscale.toUpperCase()
            },
            defaults: {
                email: email.toLowerCase(),
                codiceFiscale: codice_fiscale.toUpperCase(),
                nome: nome.trim(),
                cognome: cognome.trim(),
                status: 'pending' // In attesa di attivazione
            }
        });

        console.log('✅ [AUTH CLIENT] Registrazione whitelist completata per:', email);

        res.status(201).json({
            success: true,
            message: 'Registrazione completata. In attesa di approvazione da parte degli amministratori.',
            whitelistId: whitelistEntry.id,
            userId: user.id
        });

    } catch (error) {
        console.error('❌ [AUTH CLIENT] Errore registrazione whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nella registrazione',
            details: error.message 
        });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

// GET /api/health - Health check
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'auth-client',
        timestamp: new Date().toISOString(),
        database: sequelize.authenticate ? 'connected' : 'disconnected'
    });
});

console.log('[AUTH CLIENT ROUTES] ✓ Route client auth caricate');

module.exports = router;