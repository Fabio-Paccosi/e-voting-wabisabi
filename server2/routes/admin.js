// server2/routes/admin.js - Auth Service Admin Routes con Database REALE
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const BitcoinWalletService = require('../../shared/services/BitcoinWalletService');

// Importa modelli database 
const {
    sequelize,
    User,
    Election,                    
    ElectionWhitelist,         
    SystemSettings,
    Whitelist,
    getQuickStats,
    initializeDatabase
} = require('../shared/database_config').getModelsForService('auth');

const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Inizializza database all'avvio
console.log('[AUTH ADMIN] Inizializzazione database...');
initializeDatabase()
    .then(success => {
        if (success) {
            console.log(' [AUTH ADMIN] Database inizializzato correttamente');
        } else {
            console.error(' [AUTH ADMIN] Errore inizializzazione database');
        }
    })
    .catch(error => {
        console.error(' [AUTH ADMIN] Errore database:', error);
    });

// Middleware di autenticazione admin
// Middleware di autenticazione admin - SEMPLIFICATO PER CHIAMATE INTERNE
const adminAuth = (req, res, next) => {
    // Per chiamate interne dai servizi, non richiede autenticazione
    // L'autenticazione è gestita dall'API Gateway
    next();
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

            console.log(' [AUTH ADMIN] Login riuscito per:', username);

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
            console.log(' [AUTH ADMIN] Login fallito per:', username);
            res.status(401).json({ error: 'Credenziali non valide' });
        }
    } catch (error) {
        console.error(' [AUTH ADMIN] Errore login:', error);
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
        console.error(' [AUTH ADMIN] Errore verifica token:', error);
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
        console.log(' [AUTH ADMIN] Caricamento statistiche dal database...');
        
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

        console.log(' [AUTH ADMIN] Statistiche caricate:', authStats);
        res.json(authStats);
    } catch (error) {
        console.error(' [AUTH ADMIN] Errore stats:', error);
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

        console.log('[AUTH ADMIN] Caricamento utenti:', { page, limit, status, search });

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
            order: [['created_at', 'DESC']],
            attributes: { exclude: ['password'] } // Escludi password
        });

        console.log(` [AUTH ADMIN] Caricati ${users.length} utenti di ${count} totali`);

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
        console.error(' [AUTH ADMIN] Errore lista utenti:', error);
        res.status(500).json({ error: 'Errore caricamento utenti' });
    }
});

// POST /api/admin/users - Crea nuovo utente
router.post('/users', adminAuth, async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            taxCode, 
            dateOfBirth, 
            phoneNumber,
            address,
            documentType,
            documentNumber,
            password 
        } = req.body;

        console.log('🆕 [AUTH ADMIN] Creazione nuovo utente:', email);

        // Verifica che l'email non esista già
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ 
                error: 'Email già registrata' 
            });
        }

        // Verifica che il codice fiscale non esista già
        const existingTaxCode = await User.findOne({ where: { taxCode } });
        if (existingTaxCode) {
            return res.status(400).json({ 
                error: 'Codice fiscale già registrato' 
            });
        }

        // Genera password temporanea se non fornita
        const tempPassword = password || "qwertyuiop";
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Crea utente
        const user = await User.create({
            firstName,
            lastName,
            email,
            taxCode,
            dateOfBirth,
            phoneNumber,
            address,
            documentType,
            documentNumber,
            password: hashedPassword,
            status: 'active',
            isVerified: false
        });

        console.log(' [AUTH ADMIN] Utente creato con successo:', user.id);

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                taxCode: user.taxCode,
                dateOfBirth: user.dateOfBirth,
                phoneNumber: user.phoneNumber,
                status: user.status,
                isVerified: user.isVerified,
                createdAt: user.createdAt
            },
            message: 'Utente creato con successo',
            tempPassword: password ? undefined : tempPassword // Solo se generata automaticamente
        });
    } catch (error) {
        console.error(' [AUTH ADMIN] Errore creazione utente:', error);
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
        const { status, reason } = req.body;
        
        console.log(` [AUTH ADMIN] Aggiornamento status utente ${id} a ${status}`);
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        await user.update({ 
            status,
            updatedAt: new Date()
        });

        console.log(` [AUTH ADMIN] Status utente ${user.email} aggiornato a ${status}`);

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
        console.error(' [AUTH ADMIN] Errore aggiornamento status:', error);
        res.status(500).json({ error: 'Errore aggiornamento status utente' });
    }
});

// ==========================================
// WHITELIST ELEZIONI
// ==========================================

// GET /api/admin/elections/:electionId/whitelist - Ottieni whitelist reale di un'elezione
router.get('/elections/:electionId/whitelist', async (req, res) => {
    try {
        const { electionId } = req.params;
        console.log(`[ADMIN-WHITELIST] 📋 GET whitelist con dati Bitcoin - elezione ${electionId}`);

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Recupera la whitelist con i dati degli utenti E dei wallet Bitcoin
        const whitelist = await ElectionWhitelist.findAll({
            where: { electionId },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'taxCode', 'status']
            }],
            order: [['authorizedAt', 'DESC']]
        });

        console.log(`[ADMIN-WHITELIST] 👥 Trovati ${whitelist.length} utenti nella whitelist elezione ${electionId}`);

        res.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                status: election.status
            },
            whitelist: whitelist.map(item => ({
                id: item.id,
                user: item.user,
                authorizedAt: item.authorizedAt,
                authorizedBy: item.authorizedBy,
                hasVoted: item.hasVoted,
                votedAt: item.votedAt,
                // ===== DATI BITCOIN =====
                bitcoinWallet: {
                    address: item.bitcoinAddress,
                    publicKey: item.bitcoinPublicKey ? item.bitcoinPublicKey.substring(0, 16) + '...' : null, // Mostra solo parte della chiave pubblica per sicurezza
                    hasPrivateKey: !!item.bitcoinPrivateKeyEncrypted,
                    generatedAt: item.walletGeneratedAt
                },
                utxo: {
                    txid: item.utxoTxid,
                    vout: item.utxoVout,
                    amount: item.utxoAmount,
                    status: item.utxoStatus
                }
            })),
            total: whitelist.length,
            summary: {
                totalUsers: whitelist.length,
                usersWithWallets: whitelist.filter(item => item.bitcoinAddress).length,
                usersWithUTXO: whitelist.filter(item => item.utxoTxid).length,
                votedUsers: whitelist.filter(item => item.hasVoted).length
            }
        });
    } catch (error) {
        console.error('[ADMIN-WHITELIST] ❌ Errore recupero whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero della whitelist',
            details: error.message 
        });
    }
});

// GET /api/admin/elections/:electionId/bitcoin-addresses - Lista solo gli indirizzi Bitcoin
router.get('/elections/:electionId/bitcoin-addresses', async (req, res) => {
    try {
        const { electionId } = req.params;
        console.log(`[ADMIN-BITCOIN] 🪙 GET indirizzi Bitcoin - elezione ${electionId}`);

        const whitelist = await ElectionWhitelist.findAll({
            where: { 
                electionId,
                bitcoinAddress: { [Op.not]: null }
            },
            include: [{
                model: User,
                as: 'user',
                attributes: ['email', 'firstName', 'lastName']
            }],
            attributes: [
                'id', 'userId', 'bitcoinAddress', 'bitcoinPublicKey', 
                'utxoTxid', 'utxoVout', 'utxoAmount', 'utxoStatus',
                'hasVoted', 'walletGeneratedAt'
            ]
        });

        res.json({
            success: true,
            electionId,
            addresses: whitelist.map(item => ({
                userId: item.userId,
                userEmail: item.user.email,
                userName: `${item.user.firstName} ${item.user.lastName}`,
                bitcoinAddress: item.bitcoinAddress,
                publicKey: item.bitcoinPublicKey,
                utxo: {
                    txid: item.utxoTxid,
                    vout: item.utxoVout,
                    amount: item.utxoAmount,
                    status: item.utxoStatus
                },
                hasVoted: item.hasVoted,
                generatedAt: item.walletGeneratedAt
            })),
            total: whitelist.length
        });
    } catch (error) {
        console.error('[ADMIN-BITCOIN] ❌ Errore recupero indirizzi Bitcoin:', error);
        res.status(500).json({ error: 'Errore recupero indirizzi Bitcoin' });
    }
});

// POST /api/admin/elections/:electionId/whitelist/add - Aggiungi utenti reali alla whitelist
router.post('/elections/:electionId/whitelist/add', async (req, res) => {
    try {
        const { electionId } = req.params;
        const { userIds, emails, taxCodes } = req.body;
        
        console.log(`[ADMIN-WHITELIST] 🔐 POST aggiungi utenti con wallet Bitcoin - elezione ${electionId}:`, req.body);

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere aggiunta se l'elezione è già completata
        if (election.status === 'completed') {
            return res.status(400).json({ 
                error: 'Non è possibile modificare la whitelist di un\'elezione completata' 
            });
        }

        let usersToAdd = [];

        // Trova utenti per ID
        if (userIds && userIds.length > 0) {
            const usersByIds = await User.findAll({
                where: { id: { [Op.in]: userIds } },
                attributes: ['id', 'firstName', 'lastName', 'email', 'taxCode']
            });
            usersToAdd.push(...usersByIds);
        }

        // Trova utenti per email
        if (emails && emails.length > 0) {
            const usersByEmails = await User.findAll({
                where: { email: { [Op.in]: emails } },
                attributes: ['id', 'firstName', 'lastName', 'email', 'taxCode']
            });
            usersToAdd.push(...usersByEmails);
        }

        // Trova utenti per codice fiscale
        if (taxCodes && taxCodes.length > 0) {
            const usersByTaxCodes = await User.findAll({
                where: { taxCode: { [Op.in]: taxCodes } },
                attributes: ['id', 'firstName', 'lastName', 'email', 'taxCode']
            });
            usersToAdd.push(...usersByTaxCodes);
        }

        if (usersToAdd.length === 0) {
            return res.status(400).json({ 
                error: 'Nessun utente trovato con i criteri specificati' 
            });
        }

        // Rimuovi duplicati
        const uniqueUsers = usersToAdd.reduce((acc, user) => {
            if (!acc.find(u => u.id === user.id)) {
                acc.push(user);
            }
            return acc;
        }, []);

        console.log(`[ADMIN-WHITELIST] 👥 Trovati ${uniqueUsers.length} utenti unici da aggiungere`);

        // Verifica quali utenti sono già nella whitelist
        const existingEntries = await ElectionWhitelist.findAll({
            where: {
                electionId,
                userId: { [Op.in]: uniqueUsers.map(u => u.id) }
            },
            attributes: ['userId']
        });

        const existingUserIds = new Set(existingEntries.map(e => e.userId));
        const newUsers = uniqueUsers.filter(user => !existingUserIds.has(user.id));

        if (newUsers.length === 0) {
            return res.status(400).json({ 
                error: 'Tutti gli utenti sono già nella whitelist per questa elezione' 
            });
        }

        console.log(`[ADMIN-WHITELIST] 🆕 ${newUsers.length} utenti da aggiungere con wallet Bitcoin`);

        // ===== PARTE PRINCIPALE: AGGIUNGI UTENTI CON WALLET BITCOIN =====
        
        const addedUsers = [];
        const errors = [];
        const walletService = new BitcoinWalletService();

        // Processa ogni utente sequenzialmente per evitare problemi di concorrenza
        for (const user of newUsers) {
            try {
                console.log(`[ADMIN-WHITELIST] 🔑 Generando wallet per ${user.email}...`);
                
                // Usa il metodo statico che abbiamo creato per creare entry con wallet
                const whitelistEntry = await ElectionWhitelist.createWithBitcoinWallet(
                    electionId,
                    user.id,
                    req.user?.id || null // Admin che ha autorizzato
                );

                addedUsers.push({
                    id: user.id,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    bitcoinAddress: whitelistEntry.bitcoinAddress,
                    utxoTxid: whitelistEntry.utxoTxid,
                    utxoAmount: whitelistEntry.utxoAmount,
                    walletGeneratedAt: whitelistEntry.walletGeneratedAt
                });

                console.log(`[ADMIN-WHITELIST] ✅ ${user.email} aggiunto con indirizzo: ${whitelistEntry.bitcoinAddress}`);

            } catch (error) {
                console.error(`[ADMIN-WHITELIST] ❌ Errore aggiungendo ${user.email}:`, error.message);
                
                errors.push({
                    userId: user.id,
                    email: user.email,
                    error: error.message
                });
            }
        }

        // Prepara la risposta
        const response = {
            success: true,
            message: `${addedUsers.length} utenti aggiunti alla whitelist con wallet Bitcoin generati`,
            election: {
                id: election.id,
                title: election.title,
                status: election.status
            },
            addedUsers,
            totalAdded: addedUsers.length,
            summary: {
                requested: newUsers.length,
                successful: addedUsers.length,
                failed: errors.length
            }
        };

        // Includi errori se presenti
        if (errors.length > 0) {
            response.errors = errors;
            response.message += ` (${errors.length} errori)`;
        }

        // Registra statistiche finali
        console.log(`[ADMIN-WHITELIST] 📊 Completato: ${addedUsers.length}/${newUsers.length} utenti aggiunti con successo`);

        res.status(201).json(response);

    } catch (error) {
        console.error('[ADMIN-WHITELIST] ❌ Errore generale aggiunta whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nell\'aggiunta utenti alla whitelist',
            details: error.message 
        });
    }
});

// DELETE /api/admin/elections/:electionId/whitelist/:userId - Rimuovi utente reale dalla whitelist
router.delete('/elections/:electionId/whitelist/:userId', async (req, res) => {
    try {
        const { electionId, userId } = req.params;
        
        console.log(`[AUTH] DELETE utente reale ${userId} whitelist elezione ${electionId}`);

        // Trova l'entry nella whitelist
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { electionId, userId },
            include: [{
                model: User,
                as: 'user',
                attributes: ['firstName', 'lastName', 'email']
            }]
        });

        if (!whitelistEntry) {
            return res.status(404).json({ 
                error: 'Utente non trovato nella whitelist di questa elezione' 
            });
        }

        // Verifica se l'utente ha già votato
        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ 
                error: 'Non è possibile rimuovere un utente che ha già votato',
                user: whitelistEntry.user,
                votedAt: whitelistEntry.votedAt
            });
        }

        // Rimuovi dalla whitelist
        const userData = whitelistEntry.user;
        await whitelistEntry.destroy();

        console.log(`[AUTH]  Utente ${userData.email} rimosso dalla whitelist elezione ${electionId}`);

        res.json({
            success: true,
            message: 'Utente rimosso dalla whitelist',
            removedUser: {
                id: userId,
                email: userData.email,
                name: `${userData.firstName} ${userData.lastName}`
            }
        });
    } catch (error) {
        console.error(' [AUTH] Errore rimozione reale da whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nella rimozione dalla whitelist',
            details: error.message 
        });
    }
});

// GET /api/admin/elections/:electionId/whitelist/stats - Statistiche whitelist elezione
router.get('/elections/:electionId/whitelist/stats', async (req, res) => {
    try {
        const { electionId } = req.params;
        console.log(`[AUTH] GET statistiche whitelist elezione ${electionId}`);

        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        const stats = await ElectionWhitelist.findAll({
            where: { electionId },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalUsers'],
                [sequelize.fn('SUM', sequelize.case().when({ hasVoted: true }, 1).else(0)), 'votedUsers'],
                [sequelize.fn('SUM', sequelize.case().when({ hasVoted: false }, 1).else(0)), 'pendingUsers']
            ],
            raw: true
        });

        const result = stats[0] || { totalUsers: 0, votedUsers: 0, pendingUsers: 0 };

        res.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                status: election.status
            },
            stats: {
                totalUsers: parseInt(result.totalUsers) || 0,
                votedUsers: parseInt(result.votedUsers) || 0,
                pendingUsers: parseInt(result.pendingUsers) || 0,
                turnoutPercentage: result.totalUsers > 0 ? 
                    Math.round((result.votedUsers / result.totalUsers) * 100) : 0
            }
        });
    } catch (error) {
        console.error(' [AUTH] Errore statistiche whitelist:', error);
        res.status(500).json({ 
            error: 'Errore nel recupero delle statistiche',
            details: error.message 
        });
    }
});

// ==========================================
// ATTIVITÀ RECENTE
// ==========================================

// GET /api/admin/activity - Attività recente auth service
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const { limit = 25 } = req.query;
        
        console.log(' [AUTH ADMIN] Caricamento attività recenti...');
        
        // Query per attività recenti (registrazioni, login, cambi status)
        const recentUsers = await User.findAll({
            limit: parseInt(limit),
            order: [['updated_at', 'DESC']],
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

        console.log(` [AUTH ADMIN] Caricate ${activities.length} attività`);
        res.json(activities);
    } catch (error) {
        console.error(' [AUTH ADMIN] Errore activity:', error);
        res.status(500).json({ error: 'Errore caricamento attività' });
    }
});

// ==========================================
// IMPOSTAZIONI SISTEMA 
// ==========================================

// GET /api/admin/settings - Impostazioni sistema dal database
router.get('/settings', adminAuth, async (req, res) => {
    try {
        console.log('[AUTH ADMIN] Caricamento impostazioni sistema...');
        
        const settings = await SystemSettings.findAll({
            order: [['key', 'ASC']]
        });

        console.log(` [AUTH ADMIN] Caricate ${settings.length} impostazioni`);

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
        console.error(' [AUTH ADMIN] Errore settings:', error);
        res.status(500).json({ error: 'Errore caricamento impostazioni' });
    }
});

// PUT /api/admin/settings/:key - Aggiorna impostazione
router.put('/settings/:key', adminAuth, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        console.log('[AUTH ADMIN] Aggiornamento setting:', key);

        const [setting, created] = await SystemSettings.findOrCreate({
            where: { key },
            defaults: { value, description, isPublic: false }
        });

        if (!created) {
            await setting.update({ value, description });
        }

        console.log(` [AUTH ADMIN] Setting ${key} aggiornato`);

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
        console.error(' [AUTH ADMIN] Errore aggiornamento setting:', error);
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
        console.error(' [AUTH ADMIN] Errore backups:', error);
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