// Server 2: Users Authentication & Credentials Management

const express = require('express');
const cors = require('cors'); 
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

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

// ====================
// SIMULAZIONE DATABASE
// ====================
// In produzione, usare un vero database (PostgreSQL, MySQL, etc.)
const db = {
    users: new Map(),
    credentials: new Map(),
    whitelist: new Map() // Whitelist degli elettori autorizzati
};

// ====================
// AUTHENTICATION SERVICE
// ====================
class AuthenticationService {
    constructor() {
        // Inizializza whitelist di esempio
        this.initializeWhitelist();
    }

    // Inizializza la whitelist con alcuni utenti di test
    initializeWhitelist() {
        const testVoters = [
            { email: 'alice@example.com', taxCode: 'RSSMRA85M01H501Z' },
            { email: 'bob@example.com', taxCode: 'VRDGPP90L15H501A' },
            { email: 'charlie@example.com', taxCode: 'BNCLRA88S20H501B' },
            { email: 'test@example.com', taxCode: 'RSSMRA85M01H501Z' },
            { email: 'mario.rossi@example.com', taxCode: 'RSSMRA80A01H501X' },
            { email: 'admin@evoting.local', taxCode: 'ADMINTEST001234' }
        ];
        testVoters.forEach(voter => {
            db.whitelist.set(voter.email, {
                ...voter,
                isAuthorized: true,
                authorizationProof: crypto.randomBytes(32).toString('hex')
            });
        });
    }

    // Verifica se un utente è nella whitelist
    isInWhitelist(email, taxCode) {
        const whitelistEntry = db.whitelist.get(email);
        return whitelistEntry && 
               whitelistEntry.taxCode === taxCode && 
               whitelistEntry.isAuthorized;
    }

    // Registra un nuovo utente
    async registerUser(userData) {
        const { email, password, firstName, lastName, taxCode } = userData;

        // Verifica se l'utente esiste già
        if (db.users.has(email)) {
            throw new Error('Utente già registrato');
        }

        // Verifica se l'utente è nella whitelist
        if (!this.isInWhitelist(email, taxCode)) {
            throw new Error('Non sei autorizzato a registrarti per questa elezione');
        }

        // Hash della password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Crea l'utente
        const userId = uuidv4();
        const user = {
            id: userId,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            taxCode,
            isAuthorized: true,
            authorizationProof: db.whitelist.get(email).authorizationProof,
            hasVoted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        db.users.set(email, user);

        // Ritorna i dati dell'utente (senza password)
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    // Login utente
    async loginUser(email, password) {
        const user = db.users.get(email);
        if (!user) {
            throw new Error('Credenziali non valide');
        }

        // Verifica password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Credenziali non valide');
        }

        // Verifica se l'utente ha già votato
        if (user.hasVoted) {
            throw new Error('Hai già votato in questa elezione');
        }

        // Genera JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                isAuthorized: user.isAuthorized
            },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        const { password: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }

    // Verifica token JWT
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Token non valido');
        }
    }

    // Aggiorna lo stato hasVoted dell'utente
    markUserAsVoted(userId) {
        for (const [email, user] of db.users) {
            if (user.id === userId) {
                user.hasVoted = true;
                user.updatedAt = new Date();
                return true;
            }
        }
        return false;
    }
}

// ====================
// CREDENTIAL MANAGER (KVAC)
// ====================
class CredentialManager {
    constructor() {
        // Chiavi per il sistema KVAC (Keyed-Verification Anonymous Credentials)
        this.systemKeys = this.generateSystemKeys();
    }

    // Genera le chiavi del sistema per KVAC
    generateSystemKeys() {
        return {
            privateKey: crypto.randomBytes(32),
            publicKey: crypto.randomBytes(32), // In produzione, derivare dalla chiave privata
            generator: crypto.randomBytes(32)
        };
    }

    // Genera credenziali anonime KVAC per un utente autorizzato
    async generateCredentials(userId) {
        // Verifica che l'utente esista e sia autorizzato
        let userFound = null;
        for (const [email, user] of db.users) {
            if (user.id === userId && user.isAuthorized && !user.hasVoted) {
                userFound = user;
                break;
            }
        }

        if (!userFound) {
            throw new Error('Utente non autorizzato o ha già votato');
        }

        // Genera parametri della credenziale
        const serialNumber = this.generateSerialNumber();
        const nonce = crypto.randomBytes(16).toString('hex');
        
        // Crea la struttura della credenziale KVAC
        const credentialData = {
            userId,
            serialNumber,
            nonce,
            timestamp: Date.now()
        };

        // Firma la credenziale con la chiave privata del sistema
        const signature = this.signCredential(credentialData);

        // Salva la credenziale nel database
        const credentialId = uuidv4();
        const credential = {
            id: credentialId,
            userId,
            serialNumber,
            nonce,
            signature,
            isUsed: false,
            issuedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        db.credentials.set(serialNumber, credential);

        // Ritorna la credenziale anonima (senza userId)
        return {
            credentialId,
            serialNumber,
            nonce,
            signature,
            publicKey: this.systemKeys.publicKey.toString('hex')
        };
    }

    // Genera un serial number univoco per la credenziale
    generateSerialNumber() {
        // Genera un serial number crittograficamente sicuro
        const buffer = crypto.randomBytes(16);
        return 'SN-' + buffer.toString('hex');
    }

    // Firma una credenziale usando HMAC
    signCredential(credentialData) {
        const message = JSON.stringify(credentialData);
        const hmac = crypto.createHmac('sha256', this.systemKeys.privateKey);
        hmac.update(message);
        return hmac.digest('hex');
    }

    // Verifica una credenziale KVAC
    async verifyCredential(serialNumber, signature) {
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

// Istanzia i servizi
const authService = new AuthenticationService();
const credentialManager = new CredentialManager();

// ====================
// API ROUTES
// ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'auth-credentials',
        timestamp: new Date().toISOString()
    });
});

// Registrazione utente
app.post('/api/register', async (req, res) => {
    try {
        const user = await authService.registerUser(req.body);
        res.status(201).json({
            success: true,
            user,
            message: 'Registrazione completata con successo'
        });
    } catch (error) {
        console.error('Errore registrazione:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Login utente
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.loginUser(email, password);
        res.json({
            success: true,
            ...result,
            message: 'Login effettuato con successo'
        });
    } catch (error) {
        console.error('Errore login:', error);
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

// Richiesta credenziali anonime KVAC
app.post('/api/credentials/request', async (req, res) => {
    try {
        // Verifica il token JWT
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token mancante' });
        }

        const token = authHeader.substring(7);
        const decoded = authService.verifyToken(token);

        // Genera le credenziali KVAC
        const credentials = await credentialManager.generateCredentials(decoded.userId);
        
        res.json({
            success: true,
            credentials,
            message: 'Credenziali generate con successo'
        });
    } catch (error) {
        console.error('Errore generazione credenziali:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Verifica credenziali KVAC
app.post('/api/credentials/verify', async (req, res) => {
    try {
        const { credential, serialNumber } = req.body;
        const signature = credential.signature || credential;

        const result = await credentialManager.verifyCredential(serialNumber, signature);
        
        res.json({
            success: true,
            valid: result.valid,
            userId: result.userId
        });
    } catch (error) {
        console.error('Errore verifica credenziali:', error);
        res.status(400).json({
            success: false,
            valid: false,
            error: error.message
        });
    }
});

// Segna credenziale come utilizzata
app.post('/api/credentials/use', async (req, res) => {
    try {
        const { serialNumber } = req.body;
        const success = credentialManager.markCredentialAsUsed(serialNumber);
        
        res.json({
            success,
            message: success ? 'Credenziale utilizzata con successo' : 'Credenziale non trovata'
        });
    } catch (error) {
        console.error('Errore utilizzo credenziale:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Verifica se un utente può votare
app.get('/api/user/:userId/canVote', async (req, res) => {
    try {
        let userFound = null;
        for (const [email, user] of db.users) {
            if (user.id === req.params.userId) {
                userFound = user;
                break;
            }
        }

        if (!userFound) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        res.json({
            canVote: userFound.isAuthorized && !userFound.hasVoted,
            hasVoted: userFound.hasVoted,
            isAuthorized: userFound.isAuthorized
        });
    } catch (error) {
        console.error('Errore verifica stato voto:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Gestione errori globale
app.use((err, req, res, next) => {
    console.error('Errore non gestito:', err);
    res.status(500).json({
        error: 'Si è verificato un errore interno del server',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Avvio del server
app.listen(PORT, () => {
    console.log(`Server 2 (Auth & Credentials) in ascolto sulla porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, authService, credentialManager };