// Server 2: Users Authentication & Credentials Management

const express = require('express');
const cors = require('cors'); 
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

const { initializeDatabase } = require('./shared/database_config').getModelsForService('auth');

// Middleware
app.use(express.json());

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configurazione
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// ==========================================
// CARICAMENTO ROUTE
// ==========================================

// Route Admin (percorso /api/admin/*)
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log(' [AUTH SERVICE] Route admin caricate');
} catch (error) {
    console.error(' [AUTH SERVICE] Errore caricamento route admin:', error.message);
}

// Route Client (percorso /api/*)
try {
    const clientRoutes = require('./routes/client');
    app.use('/api', clientRoutes);
    console.log(' [AUTH SERVICE] Route client caricate');
} catch (error) {
    console.error(' [AUTH SERVICE] Errore caricamento route client:', error.message);
    
    // Route client di fallback
    app.post('/api/auth/login', (req, res) => {
        res.status(500).json({ 
            error: 'Route client non disponibili',
            reason: 'File client.js mancante',
            path: req.path
        });
    });
}

// ==========================================
// HEALTH CHECK E TEST
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'auth-credentials',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        routes: {
            admin: '/api/admin/*',
            client: '/api/*'
        }
    });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        const { sequelize } = require('./shared/database_config').getModelsForService('auth');
        await sequelize.authenticate();
        res.json({ 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            database: 'error',
            error: error.message 
        });
    }
});

// ==========================================
// SIMULAZIONE DATABASE (Legacy)
// ==========================================
// Manteniamo il database simulato per compatibilità
// In produzione, usare un vero database (PostgreSQL, MySQL, etc.)

const db = {
    users: new Map(),
    credentials: new Map()
};

// ==========================================
// CLASSI DI SERVIZIO (Legacy)
// ==========================================

class AuthenticationService {
    constructor() {
        console.log('[AUTH] Servizio di autenticazione inizializzato');
    }

    // Registra un nuovo utente
    async registerUser(userData) {
        const { email, codiceFiscale, nome, cognome } = userData;
        
        // Validazione dati
        if (!email || !codiceFiscale || !nome || !cognome) {
            throw new Error('Tutti i campi sono obbligatori');
        }

        // Verifica se l'utente esiste già
        const existingUser = Array.from(db.users.values()).find(
            user => user.email === email || user.codiceFiscale === codiceFiscale
        );

        if (existingUser) {
            throw new Error('Utente già registrato con questa email o codice fiscale');
        }

        // Crea nuovo utente
        const userId = uuidv4();
        const user = {
            id: userId,
            email,
            codiceFiscale: codiceFiscale.toUpperCase(),
            nome,
            cognome,
            status: 'registered',
            hasVoted: false,
            registeredAt: new Date(),
            updatedAt: new Date()
        };

        db.users.set(userId, user);
        console.log(` [AUTH] Utente registrato: ${email}`);
        
        return { 
            id: userId, 
            email, 
            nome, 
            cognome,
            status: 'registered'
        };
    }

    // Login utente
    async loginUser(email, codiceFiscale) {
        const user = Array.from(db.users.values()).find(
            u => u.email === email && u.codiceFiscale === codiceFiscale.toUpperCase()
        );

        if (!user) {
            throw new Error('Credenziali non valide');
        }

        if (user.status !== 'registered') {
            throw new Error('Account non attivo');
        }

        // Genera token di sessione
        const sessionToken = this.generateSessionToken(user);
        
        console.log(` [AUTH] Login effettuato: ${email}`);
        
        return {
            token: sessionToken,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                cognome: user.cognome,
                hasVoted: user.hasVoted
            }
        };
    }

    // Genera token di sessione
    generateSessionToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            timestamp: Date.now()
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    }

    // Verifica token
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Token non valido');
        }
    }

    // Marca utente come votante
    markUserAsVoted(userId) {
        const user = db.users.get(userId);
        if (user) {
            user.hasVoted = true;
            user.updatedAt = new Date();
            return true;
        }
        return false;
    }

    // Ottieni utente per ID
    getUserById(userId) {
        return db.users.get(userId);
    }

    // Ottieni tutti gli utenti (per admin)
    getAllUsers() {
        return Array.from(db.users.values());
    }
}

// ==========================================
// GESTIONE CREDENZIALI (Legacy)
// ==========================================

class CredentialManager {
    constructor() {
        this.cryptoKey = process.env.CREDENTIAL_SECRET || 'default-credential-secret';
        console.log('[CREDENTIALS] Manager credenziali inizializzato');
    }

    // Genera credenziale per un utente
    generateCredential(userId) {
        const user = db.users.get(userId);
        if (!user) {
            throw new Error('Utente non trovato');
        }

        if (user.hasVoted) {
            throw new Error('L\'utente ha già votato');
        }

        const serialNumber = uuidv4();
        const nonce = crypto.randomBytes(32).toString('hex');
        const timestamp = Date.now();

        const credentialData = {
            userId,
            serialNumber,
            nonce,
            timestamp
        };

        const signature = this.signCredential(credentialData);

        const credential = {
            id: serialNumber,
            userId,
            serialNumber,
            nonce,
            signature,
            issuedAt: new Date(timestamp),
            isUsed: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        db.credentials.set(serialNumber, credential);
        
        console.log(` [CREDENTIALS] Credenziale generata per utente ${userId}`);
        
        return {
            serialNumber,
            signature,
            nonce,
            timestamp
        };
    }

    // Firma una credenziale
    signCredential(credentialData) {
        const dataToSign = `${credentialData.userId}:${credentialData.serialNumber}:${credentialData.nonce}:${credentialData.timestamp}`;
        return crypto.createHmac('sha256', this.cryptoKey).update(dataToSign).digest('hex');
    }

    // Verifica credenziale
    verifyCredential(serialNumber, signature) {
        const credential = db.credentials.get(serialNumber);
        
        if (!credential) {
            throw new Error('Credenziale non trovata');
        }

        if (credential.isUsed) {
            throw new Error('Credenziale già utilizzata');
        }

        // Ricostruisci i dati della credenziale per verificare la firma
        const credentialData = {
            userId: credential.userId,
            serialNumber: credential.serialNumber,
            nonce: credential.nonce,
            timestamp: new Date(credential.issuedAt).getTime()
        };

        // Verifica la firma
        const expectedSignature = this.signCredential(credentialData);
        if (signature !== expectedSignature) {
            throw new Error('Firma della credenziale non valida');
        }

        return {
            valid: true,
            userId: credential.userId,
            credentialId: credential.id
        };
    }

    // Segna una credenziale come utilizzata
    markCredentialAsUsed(serialNumber) {
        const credential = db.credentials.get(serialNumber);
        if (credential) {
            credential.isUsed = true;
            credential.updatedAt = new Date();
            
            // Aggiorna anche lo stato dell'utente
            authService.markUserAsVoted(credential.userId);
            
            return true;
        }
        return false;
    }

    // Verifica se una credenziale può essere utilizzata
    canUseCredential(serialNumber) {
        const credential = db.credentials.get(serialNumber);
        return credential && !credential.isUsed;
    }
}

// Istanzia i servizi (legacy)
const authService = new AuthenticationService();
const credentialManager = new CredentialManager();

// ==========================================
// ERROR HANDLER
// ==========================================

// 404 handler
app.use('*', (req, res) => {
    console.log(` [AUTH SERVICE] Route non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Route non trovata',
        path: req.originalUrl,
        method: req.method,
        service: 'auth-service',
        availableRoutes: [
            'GET /api/health',
            'GET /api/test-db',
            'POST /api/admin/auth/login',
            'POST /api/auth/login',
            'POST /api/auth/verify',
            'GET /api/auth/profile',
            'GET /api/whitelist/check',
            'POST /api/whitelist/register'
        ]
    });
});

// Error handler globale
app.use((err, req, res, next) => {
    console.error('[AUTH SERVICE] Errore non gestito:', err);
    res.status(500).json({ 
        error: 'Errore interno del server',
        message: err.message,
        service: 'auth-service'
    });
});

// ==========================================
// AVVIO SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`[AUTH SERVICE] Server avviato su porta ${PORT}`);
    console.log(`Route disponibili:`);
    console.log(`   Admin: http://localhost:${PORT}/api/admin/*`);
    console.log(`   Client: http://localhost:${PORT}/api/*`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;