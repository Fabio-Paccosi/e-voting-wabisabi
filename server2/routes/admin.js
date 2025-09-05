
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const router = express.Router();

// Importa modelli database SOLO per l'Auth Service (non vote models)
const {
    sequelize,
    User,
    Election,
    ElectionWhitelist,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('[AUTH ADMIN ROUTES] Inizializzazione route admin...');

// Inizializza database all'avvio
initializeDatabase()
    .then(success => {
        if (success) {
            console.log('[AUTH ADMIN] Database inizializzato correttamente');
        } else {
            console.error('[AUTH ADMIN] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error('[AUTH ADMIN] Errore database:', error);
    });

// Middleware di autenticazione admin
const adminAuth = (req, res, next) => {
    // Per ora bypass per debugging, ma mantenere struttura per implementazione futura
    next();
};

// ==========================================
// AUTENTICAZIONE ADMIN
// ==========================================

// POST /api/admin/auth/login - Login amministratore
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[AUTH ADMIN] Tentativo login:', { username });
        
        // Prima cerca un utente admin nel database
        let adminUser = await User.findOne({
            where: { 
                username: username,
                role: 'administrator'
            }
        });
        
        // Se non esiste, crea admin di default per primo accesso
        if (!adminUser && username === 'admin') {
            console.log('[AUTH ADMIN] Creando admin di default...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            adminUser = await User.create({
                username: 'admin',
                email: 'admin@evoting.local',
                password: hashedPassword,
                role: 'administrator',
                status: 'active'
            });
            console.log('[AUTH ADMIN] Admin di default creato');
        }
        
        // Verifica credenziali
        if (adminUser) {
            const isValidPassword = await bcrypt.compare(password, adminUser.password);
            if (isValidPassword) {
                const token = jwt.sign(
                    { 
                        id: adminUser.id, 
                        username: adminUser.username, 
                        role: adminUser.role 
                    }, 
                    JWT_SECRET, 
                    { expiresIn: '24h' }
                );
                
                // Aggiorna ultimo login
                await adminUser.update({ lastLoginAt: new Date() });
                
                console.log('[AUTH ADMIN] Login admin riuscito');
                res.json({
                    success: true,
                    token,
                    user: {
                        id: adminUser.id,
                        username: adminUser.username,
                        email: adminUser.email,
                        role: adminUser.role
                    }
                });
                return;
            }
        }
        
        // Fallback per testing (rimuovere in produzione)
        if (username === 'admin' && password === 'admin123') {
            const token = jwt.sign(
                { id: 1, username: 'admin', role: 'administrator' }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );
            
            console.log('[AUTH ADMIN] Login fallback riuscito');
            res.json({
                success: true,
                token,
                user: { id: 1, username: 'admin', role: 'administrator' }
            });
            return;
        }
        
        console.log('[AUTH ADMIN] Credenziali non valide');
        res.status(401).json({ error: 'Credenziali non valide' });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore login:', error);
        res.status(500).json({ error: 'Errore interno durante il login' });
    }
});

// POST /api/admin/auth/verify - Verifica token
router.post('/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token mancante' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.json({
            valid: true,
            user: {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role
            }
        });
    } catch (error) {
        console.error('[AUTH ADMIN] Errore verifica token:', error);
        res.status(401).json({ 
            valid: false, 
            error: 'Token non valido' 
        });
    }
});

// ==========================================
// GESTIONE UTENTI - API REALI DATABASE
// ==========================================

// GET /api/admin/users - Lista utenti dal database
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { 
            limit = 100, 
            offset = 0, 
            search = '', 
            status = '', 
            role = '' 
        } = req.query;
        
        console.log(`[AUTH ADMIN] GET users - limit: ${limit}, offset: ${offset}, search: "${search}"`);
        
        // Costruisci filtri WHERE
        const whereClause = {};
        
        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        if (status) {
            whereClause.status = status;
        }
        
        if (role) {
            whereClause.role = role;
        }
        
        // Query database
        const { count, rows: users } = await User.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            attributes: {
                exclude: ['password'] // Non restituire password
            }
        });
        
        console.log(`[AUTH ADMIN] Trovati ${users.length} utenti su ${count} totali`);
        
        res.json({
            users: users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastLoginAt: user.lastLoginAt
            })),
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore caricamento utenti:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento degli utenti',
            details: error.message
        });
    }
});

// GET /api/admin/users/:id - Dettaglio utente
router.get('/users/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[AUTH ADMIN] GET user ${id}`);
        
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        res.json({ user });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore caricamento utente:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dell\'utente',
            details: error.message
        });
    }
});

// POST /api/admin/users - Crea nuovo utente
router.post('/users', adminAuth, async (req, res) => {
    try {
        const { 
            username, 
            email, 
            password, 
            firstName = '', 
            lastName = '', 
            role = 'user' 
        } = req.body;
        
        console.log('[AUTH ADMIN] POST nuovo utente:', { username, email, role });
        
        // Validazione
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email e password sono obbligatori' 
            });
        }
        
        // Verifica che username/email non esistano già
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { username },
                    { email }
                ]
            }
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                error: existingUser.username === username ? 
                    'Username già esistente' : 'Email già esistente' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Crea utente
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
            status: 'active'
        });
        
        console.log('[AUTH ADMIN] Utente creato:', newUser.id);
        
        res.status(201).json({
            success: true,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                status: newUser.status,
                createdAt: newUser.createdAt
            }
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore creazione utente:', error);
        res.status(500).json({ 
            error: 'Errore nella creazione dell\'utente',
            details: error.message
        });
    }
});

// PUT /api/admin/users/:id/status - Aggiorna status utente
router.put('/users/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        console.log(`[AUTH ADMIN] PUT status utente ${id}: ${status}`);
        
        if (!['active', 'suspended', 'pending'].includes(status)) {
            return res.status(400).json({ 
                error: 'Status non valido. Valori ammessi: active, suspended, pending' 
            });
        }
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        await user.update({ status });
        
        console.log(`[AUTH ADMIN] Status utente ${id} aggiornato a ${status}`);
        
        res.json({
            success: true,
            message: `Status utente aggiornato a ${status}`,
            user: {
                id: user.id,
                username: user.username,
                status: user.status
            }
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore aggiornamento status:', error);
        res.status(500).json({ 
            error: 'Errore nell\'aggiornamento dello status',
            details: error.message
        });
    }
});

// DELETE /api/admin/users/:id - Elimina utente
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[AUTH ADMIN] DELETE utente ${id}`);
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        // Non permettere eliminazione di admin
        if (user.role === 'administrator') {
            return res.status(400).json({ 
                error: 'Non è possibile eliminare un amministratore' 
            });
        }
        
        await user.destroy();
        
        console.log(`[AUTH ADMIN] Utente ${id} eliminato`);
        
        res.json({
            success: true,
            message: 'Utente eliminato con successo'
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore eliminazione utente:', error);
        res.status(500).json({ 
            error: 'Errore nell\'eliminazione dell\'utente',
            details: error.message
        });
    }
});

// ==========================================
// GESTIONE WHITELIST ELEZIONI - API REALI
// ==========================================

// GET /api/admin/elections/:electionId/whitelist - Whitelist dal database
router.get('/elections/:electionId/whitelist', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;
        console.log(`[AUTH ADMIN] GET whitelist elezione ${electionId}`);
        
        // Cerca la whitelist per questa elezione
        const whitelist = await ElectionWhitelist.findAll({
            where: { electionId },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'email', 'firstName', 'lastName']
            }],
            order: [['createdAt', 'DESC']]
        });
        
        console.log(`[AUTH ADMIN] Trovati ${whitelist.length} utenti in whitelist`);
        
        res.json({
            electionId,
            whitelist: whitelist.map(entry => ({
                id: entry.id,
                userId: entry.userId,
                username: entry.user?.username,
                email: entry.user?.email,
                firstName: entry.user?.firstName,
                lastName: entry.user?.lastName,
                status: entry.status,
                addedAt: entry.createdAt,
                addedBy: entry.addedBy
            })),
            total: whitelist.length
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore caricamento whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento della whitelist',
            details: error.message
        });
    }
});

// POST /api/admin/elections/:electionId/whitelist/add - Aggiungi a whitelist
router.post('/elections/:electionId/whitelist/add', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;
        const { userIds, emails } = req.body;
        
        console.log(`[AUTH ADMIN] POST aggiungi a whitelist elezione ${electionId}:`, { userIds, emails });
        
        let addedCount = 0;
        const errors = [];
        
        // Aggiungi per userIds
        if (userIds && Array.isArray(userIds)) {
            for (const userId of userIds) {
                try {
                    // Verifica che l'utente esista
                    const user = await User.findByPk(userId);
                    if (!user) {
                        errors.push(`Utente ID ${userId} non trovato`);
                        continue;
                    }
                    
                    // Verifica se già in whitelist
                    const existing = await ElectionWhitelist.findOne({
                        where: { electionId, userId }
                    });
                    
                    if (existing) {
                        errors.push(`Utente ${user.username} già in whitelist`);
                        continue;
                    }
                    
                    // Aggiungi alla whitelist
                    await ElectionWhitelist.create({
                        electionId,
                        userId,
                        status: 'approved',
                        addedBy: 1 // TODO: usare ID admin corrente
                    });
                    
                    addedCount++;
                } catch (error) {
                    errors.push(`Errore aggiunta utente ID ${userId}: ${error.message}`);
                }
            }
        }
        
        // Aggiungi per emails
        if (emails && Array.isArray(emails)) {
            for (const email of emails) {
                try {
                    // Trova utente per email
                    const user = await User.findOne({ where: { email } });
                    if (!user) {
                        errors.push(`Utente con email ${email} non trovato`);
                        continue;
                    }
                    
                    // Verifica se già in whitelist
                    const existing = await ElectionWhitelist.findOne({
                        where: { electionId, userId: user.id }
                    });
                    
                    if (existing) {
                        errors.push(`Utente ${email} già in whitelist`);
                        continue;
                    }
                    
                    // Aggiungi alla whitelist
                    await ElectionWhitelist.create({
                        electionId,
                        userId: user.id,
                        status: 'approved',
                        addedBy: 1 // TODO: usare ID admin corrente
                    });
                    
                    addedCount++;
                } catch (error) {
                    errors.push(`Errore aggiunta email ${email}: ${error.message}`);
                }
            }
        }
        
        res.json({
            success: true,
            message: `${addedCount} utenti aggiunti alla whitelist`,
            added: addedCount,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore aggiunta whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nell\'aggiunta alla whitelist',
            details: error.message
        });
    }
});

// DELETE /api/admin/elections/:electionId/whitelist/:userId - Rimuovi da whitelist
router.delete('/elections/:electionId/whitelist/:userId', adminAuth, async (req, res) => {
    try {
        const { electionId, userId } = req.params;
        console.log(`[AUTH ADMIN] DELETE utente ${userId} da whitelist elezione ${electionId}`);
        
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { electionId, userId }
        });
        
        if (!whitelistEntry) {
            return res.status(404).json({ 
                error: 'Utente non trovato nella whitelist di questa elezione' 
            });
        }
        
        await whitelistEntry.destroy();
        
        console.log(`[AUTH ADMIN] Utente ${userId} rimosso da whitelist elezione ${electionId}`);
        
        res.json({
            success: true,
            message: 'Utente rimosso dalla whitelist con successo'
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore rimozione whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nella rimozione dalla whitelist',
            details: error.message
        });
    }
});

// ==========================================
// STATISTICHE - API REALI DATABASE
// ==========================================

// GET /api/admin/stats - Statistiche reali dal database
router.get('/stats', adminAuth, async (req, res) => {
    try {
        console.log('[AUTH ADMIN] GET stats dal database');
        
        // Usa getQuickStats se disponibile, altrimenti query manuali
        let stats;
        try {
            stats = await getQuickStats();
        } catch (error) {
            console.log('[AUTH ADMIN] getQuickStats non disponibile, usando query manuali');
            
            // Query manuali come fallback
            const [
                totalUsers,
                activeUsers,
                pendingUsers,
                suspendedUsers,
                totalWhitelist
            ] = await Promise.all([
                User.count(),
                User.count({ where: { status: 'active' } }),
                User.count({ where: { status: 'pending' } }),
                User.count({ where: { status: 'suspended' } }),
                ElectionWhitelist.count()
            ]);
            
            stats = {
                users: {
                    totalUsers,
                    activeUsers,
                    pendingUsers,
                    suspendedUsers
                },
                whitelist: {
                    whitelistEntries: totalWhitelist,
                    verifiedUsers: activeUsers
                }
            };
        }
        
        console.log('[AUTH ADMIN] Stats generate:', stats);
        
        res.json({
            ...stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore stats:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento delle statistiche',
            details: error.message
        });
    }
});

// ==========================================
// ATTIVITÀ - API REALI DATABASE
// ==========================================

// GET /api/admin/activity - Log attività reali
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        console.log(`[AUTH ADMIN] GET activity - limit: ${limit}`);
        
        // Query degli ultimi utenti registrati come attività
        const recentUsers = await User.findAll({
            limit: Math.min(parseInt(limit), 50),
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'username', 'email', 'createdAt', 'lastLoginAt', 'status']
        });
        
        const activities = recentUsers.map(user => ({
            id: `auth_user_${user.id}`,
            type: 'auth',
            action: user.lastLoginAt ? 'Login utente' : 'Nuovo utente registrato',
            timestamp: user.lastLoginAt || user.createdAt,
            source: 'auth-service',
            details: {
                userId: user.id,
                username: user.username,
                email: user.email,
                status: user.status
            }
        }));
        
        res.json(activities);
        
    } catch (error) {
        console.error('[AUTH ADMIN] Errore activity:', error);
        res.status(500).json({ 
            error: 'Errore caricamento attività',
            details: error.message
        });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

// GET /api/admin/health - Health check admin
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'auth-admin',
        timestamp: new Date().toISOString(),
        database: sequelize ? 'connected' : 'disconnected'
    });
});

console.log('[AUTH ADMIN ROUTES] Route admin auth caricate correttamente');
module.exports = router;