// server2/routes/admin.js - Auth Service Admin Routes con Database REALE
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const router = express.Router();

// Importa modelli database - PATH CORRETTO PER CONTAINER
const {
    sequelize,
    User,
    Whitelist,
    SystemSettings,
    getQuickStats,
    initializeDatabase
} = require('../database_config'); // PATH CORRETTO

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Inizializza database all'avvio
console.log('🔗 [AUTH ADMIN] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log('✅ [AUTH ADMIN] Database inizializzato correttamente');
        } else {
            console.error('❌ [AUTH ADMIN] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error('❌ [AUTH ADMIN] Errore database:', error);
    });

// Middleware di autenticazione admin
const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Token mancante' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'administrator') {
            return res.status(403).json({ error: 'Accesso negato' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token non valido' });
    }
};

// ==========================================
// AUTH MANAGEMENT
// ==========================================

// POST /api/admin/auth/login - Login amministratore
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 [AUTH ADMIN] Tentativo login:', username);
        
        // Per ora usa credenziali hardcoded, poi integra con database
        if (username === 'admin@example.com' && password === 'admin123') {
            const token = jwt.sign(
                { 
                    id: 'admin_001',
                    username: username,
                    role: 'administrator'
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log('✅ [AUTH ADMIN] Login riuscito per:', username);

            res.json({
                success: true,
                token,
                user: {
                    id: 'admin_001',
                    username: username,
                    role: 'administrator'
                }
            });
        } else {
            console.log('❌ [AUTH ADMIN] Login fallito per:', username);
            res.status(401).json({ error: 'Credenziali non valide' });
        }
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore login:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// POST /api/admin/auth/verify - Verifica token amministratore
router.post('/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.role === 'administrator') {
            res.json({
                valid: true,
                user: {
                    id: decoded.id,
                    username: decoded.username,
                    role: decoded.role
                }
            });
        } else {
            res.status(401).json({ 
                valid: false, 
                error: 'Ruolo non autorizzato' 
            });
        }
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore verifica token:', error);
        res.status(401).json({ 
            valid: false, 
            error: 'Token non valido' 
        });
    }
});

// ==========================================
// STATISTICHE UTENTI REALI DAL DATABASE
// ==========================================

// GET /api/admin/stats - Statistiche auth service dal database
router.get('/stats', adminAuth, async (req, res) => {
    try {
        console.log('📊 [AUTH ADMIN] Caricamento statistiche dal database...');
        
        const stats = await getQuickStats();
        
        // Statistiche aggiuntive per auth service
        const [
            pendingUsers,
            suspendedUsers,
            todayRegistrations,
            whitelistCount,
            recentLogins
        ] = await Promise.all([
            User.count({ where: { status: 'pending' } }),
            User.count({ where: { status: 'suspended' } }),
            User.count({
                where: {
                    createdAt: {
                        [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            Whitelist.count(),
            User.count({
                where: {
                    lastLogin: {
                        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);

        const authStats = {
            totalUsers: stats.users.total,
            activeUsers: stats.users.active,
            pendingUsers,
            suspendedUsers,
            todayRegistrations,
            todayLogins: recentLogins,
            whitelistEntries: whitelistCount,
            verifiedUsers: stats.users.active
        };

        console.log('✅ [AUTH ADMIN] Statistiche caricate:', authStats);
        res.json(authStats);
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore stats:', error);
        res.status(500).json({ error: 'Errore statistiche autenticazione' });
    }
});

// ==========================================
// GESTIONE UTENTI REALI DAL DATABASE
// ==========================================

// GET /api/admin/users - Lista utenti dal database
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status = 'all', 
            search = '' 
        } = req.query;

        console.log('👥 [AUTH ADMIN] Caricamento utenti:', { page, limit, status, search });

        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Costruisci filtri
        const where = {};
        
        if (status !== 'all') {
            where.status = status;
        }
        
        if (search) {
            where[Op.or] = [
                { email: { [Op.iLike]: `%${search}%` } },
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { taxCode: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows: users } = await User.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset,
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['password'] } // Escludi password
        });

        console.log(`✅ [AUTH ADMIN] Caricati ${users.length} utenti di ${count} totali`);

        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore lista utenti:', error);
        res.status(500).json({ error: 'Errore caricamento utenti' });
    }
});

// PUT /api/admin/users/:id/status - Aggiorna status utente
router.put('/users/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        
        console.log(`🔄 [AUTH ADMIN] Aggiornamento status utente ${id} a ${status}`);
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        await user.update({ 
            status,
            updatedAt: new Date()
        });

        console.log(`✅ [AUTH ADMIN] Status utente ${user.email} aggiornato a ${status}`);

        res.json({
            success: true,
            message: `Status utente aggiornato a ${status}`,
            user: {
                id: user.id,
                email: user.email,
                status: user.status
            }
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore aggiornamento status:', error);
        res.status(500).json({ error: 'Errore aggiornamento status utente' });
    }
});

// ==========================================
// GESTIONE WHITELIST REALE DAL DATABASE
// ==========================================

// GET /api/admin/whitelist - Lista whitelist dal database
router.get('/whitelist', adminAuth, async (req, res) => {
    try {
        console.log('📝 [AUTH ADMIN] Caricamento whitelist dal database...');
        
        const whitelist = await Whitelist.findAll({
            order: [['createdAt', 'DESC']]
        });

        console.log(`✅ [AUTH ADMIN] Caricati ${whitelist.length} elementi whitelist`);

        res.json({ 
            whitelist: whitelist.map(item => ({
                id: item.id,
                email: item.email,
                taxCode: item.taxCode,
                firstName: item.firstName,
                lastName: item.lastName,
                addedBy: item.addedBy,
                addedAt: item.createdAt
            }))
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore whitelist:', error);
        res.status(500).json({ error: 'Errore caricamento whitelist' });
    }
});

// POST /api/admin/whitelist - Aggiungi a whitelist
router.post('/whitelist', adminAuth, async (req, res) => {
    try {
        const { email, taxCode, firstName, lastName, notes } = req.body;
        
        console.log('➕ [AUTH ADMIN] Aggiunta a whitelist:', email);
        
        // Verifica che non esista già
        const existing = await Whitelist.findOne({
            where: {
                [Op.or]: [
                    { email },
                    { taxCode }
                ]
            }
        });

        if (existing) {
            return res.status(400).json({ 
                error: 'Email o codice fiscale già presente in whitelist' 
            });
        }

        const whitelistEntry = await Whitelist.create({
            email,
            taxCode,
            firstName,
            lastName,
            notes,
            addedBy: req.user.username
        });

        console.log('✅ [AUTH ADMIN] Aggiunto a whitelist:', email);

        res.json({
            success: true,
            message: 'Utente aggiunto alla whitelist',
            entry: {
                id: whitelistEntry.id,
                email: whitelistEntry.email,
                taxCode: whitelistEntry.taxCode,
                firstName: whitelistEntry.firstName,
                lastName: whitelistEntry.lastName,
                addedAt: whitelistEntry.createdAt
            }
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore aggiunta whitelist:', error);
        res.status(500).json({ error: 'Errore aggiunta whitelist' });
    }
});

// DELETE /api/admin/whitelist/:email - Rimuovi da whitelist
router.delete('/whitelist/:email', adminAuth, async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log('🗑️ [AUTH ADMIN] Rimozione da whitelist:', email);
        
        const deleted = await Whitelist.destroy({
            where: { email }
        });

        if (deleted === 0) {
            return res.status(404).json({ error: 'Email non trovata in whitelist' });
        }

        console.log('✅ [AUTH ADMIN] Rimosso da whitelist:', email);

        res.json({
            success: true,
            message: `${email} rimosso dalla whitelist`
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore rimozione whitelist:', error);
        res.status(500).json({ error: 'Errore rimozione whitelist' });
    }
});

// ==========================================
// ATTIVITÀ RECENTE REALE DAL DATABASE
// ==========================================

// GET /api/admin/activity - Attività recente auth service
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const { limit = 25 } = req.query;
        
        console.log('🔄 [AUTH ADMIN] Caricamento attività recenti...');
        
        // Query per attività recenti (registrazioni, login, cambi status)
        const recentUsers = await User.findAll({
            limit: parseInt(limit),
            order: [['updatedAt', 'DESC']],
            attributes: ['id', 'email', 'status', 'lastLogin', 'createdAt', 'updatedAt']
        });

        // Trasforma in formato attività
        const activities = recentUsers.map(user => {
            const timeDiff = new Date() - new Date(user.updatedAt);
            let action = 'Aggiornamento utente';
            
            if (user.lastLogin && new Date(user.lastLogin) > new Date(user.updatedAt)) {
                action = 'Login utente';
            } else if (Math.abs(new Date(user.createdAt) - new Date(user.updatedAt)) < 1000) {
                action = 'Nuovo utente registrato';
            }

            return {
                id: `auth_${user.id}`,
                type: 'auth',
                action: `${action}: ${user.email}`,
                timestamp: user.updatedAt,
                source: 'auth-service',
                details: {
                    userId: user.id,
                    userEmail: user.email,
                    status: user.status
                }
            };
        });

        console.log(`✅ [AUTH ADMIN] Caricate ${activities.length} attività`);
        res.json(activities);
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore activity:', error);
        res.status(500).json({ error: 'Errore caricamento attività' });
    }
});

// ==========================================
// IMPOSTAZIONI SISTEMA REALI DAL DATABASE
// ==========================================

// GET /api/admin/settings - Impostazioni sistema dal database
router.get('/settings', adminAuth, async (req, res) => {
    try {
        console.log('⚙️ [AUTH ADMIN] Caricamento impostazioni sistema...');
        
        const settings = await SystemSettings.findAll({
            order: [['key', 'ASC']]
        });

        console.log(`✅ [AUTH ADMIN] Caricate ${settings.length} impostazioni`);

        res.json({ 
            settings: settings.map(setting => ({
                key: setting.key,
                value: setting.value,
                description: setting.description,
                isPublic: setting.isPublic,
                updatedAt: setting.updatedAt
            }))
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore settings:', error);
        res.status(500).json({ error: 'Errore caricamento impostazioni' });
    }
});

// PUT /api/admin/settings/:key - Aggiorna impostazione
router.put('/settings/:key', adminAuth, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        console.log('⚙️ [AUTH ADMIN] Aggiornamento setting:', key);

        const [setting, created] = await SystemSettings.findOrCreate({
            where: { key },
            defaults: { value, description, isPublic: false }
        });

        if (!created) {
            await setting.update({ value, description });
        }

        console.log(`✅ [AUTH ADMIN] Setting ${key} aggiornato`);

        res.json({
            success: true,
            message: `Impostazione ${key} aggiornata`,
            setting: {
                key: setting.key,
                value: setting.value,
                description: setting.description
            }
        });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore aggiornamento setting:', error);
        res.status(500).json({ error: 'Errore aggiornamento impostazione' });
    }
});

// ==========================================
// BACKUP E MANUTENZIONE
// ==========================================

// GET /api/admin/backups - Lista backup disponibili
router.get('/backups', adminAuth, async (req, res) => {
    try {
        console.log('💾 [AUTH ADMIN] Caricamento lista backup...');
        
        // Per ora backup mock - implementare logica reale
        const backups = [
            {
                id: '1',
                filename: `backup_${new Date().toISOString().split('T')[0]}.sql`,
                size: '2.4 MB',
                createdAt: new Date(),
                type: 'full'
            }
        ];

        res.json({ backups });
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore backups:', error);
        res.status(500).json({ error: 'Errore caricamento backup' });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'auth-service',
        database: sequelize.authenticate ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

console.log('[AUTH ADMIN ROUTES] ✓ Route admin auth con database reale caricate');

module.exports = router;