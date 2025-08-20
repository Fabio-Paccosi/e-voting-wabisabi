// Middleware di autenticazione JWT per sistema WabiSabi
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware di autenticazione JWT per utenti normali (non admin)
 * Verifica token JWT e estrae informazioni utente
 */
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // Controlla presenza del token
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('[AUTH] Token mancante o formato non valido');
            return res.status(401).json({ 
                error: 'Token di autenticazione richiesto',
                details: 'Fornire un token Bearer nell\'header Authorization'
            });
        }
        
        // Estrai il token
        const token = authHeader.substring(7); // Rimuovi "Bearer "
        
        // Verifica il token JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log(`[AUTH]  Token verificato per utente: ${decoded.userId || decoded.id}`);
        
        // Controlla che il token non sia scaduto
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            console.error('[AUTH] Token scaduto');
            return res.status(401).json({ 
                error: 'Token scaduto',
                details: 'Effettuare nuovamente il login'
            });
        }
        
        // Estrai informazioni utente dal token
        // Il formato può variare, adattiamo ai diversi formati possibili
        req.user = {
            id: decoded.userId || decoded.id,
            email: decoded.email,
            firstName: decoded.firstName || decoded.nome,
            lastName: decoded.lastName || decoded.cognome,
            role: decoded.role || 'user'
        };
        
        // Verifica che l'utente sia autorizzato per il voto
        if (decoded.role === 'administrator') {
            // Admin può fare tutto per test
            console.log(`[AUTH] Accesso amministratore per testing`);
        } else if (decoded.role !== 'user' && !decoded.userId) {
            console.error('[AUTH] Ruolo utente non valido per voting');
            return res.status(403).json({ 
                error: 'Ruolo non autorizzato per il voto',
                details: 'Solo utenti registrati possono votare'
            });
        }
        
        console.log(`[AUTH]  Utente autenticato: ${req.user.id} (${req.user.email})`);
        next();
        
    } catch (error) {
        console.error('[AUTH] Errore verifica token:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Token non valido',
                details: 'Il token fornito non è valido'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token scaduto',
                details: 'Effettuare nuovamente il login'
            });
        }
        
        return res.status(500).json({ 
            error: 'Errore interno di autenticazione',
            details: 'Contattare il supporto tecnico'
        });
    }
};

/**
 * Middleware di autenticazione semplificato per testing
 * DA RIMUOVERE IN PRODUZIONE
 */
const authenticateUserSimple = (req, res, next) => {
    console.log('[AUTH] MODALITÀ TESTING - autenticazione semplificata');
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token di autenticazione richiesto' });
    }
    
    // Per testing, accetta qualsiasi token e usa valori mock
    req.user = {
        id: 'user_001',
        email: 'testuser@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user'
    };
    
    console.log(`[AUTH]  Utente test autenticato: ${req.user.id}`);
    next();
};

/**
 * Verifica token verso Auth Service
 * Per una verifica più robusta, chiama il servizio di autenticazione
 */
const verifyTokenWithAuthService = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Token di autenticazione richiesto'
            });
        }
        
        const token = authHeader.substring(7);
        
        // Chiama il servizio di autenticazione per verificare il token
        const axios = require('axios');
        const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3002';
        
        console.log(`[AUTH]  Verifica token con Auth Service...`);
        
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, {
            token: token
        }, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.valid) {
            req.user = response.data.user;
            console.log(`[AUTH]  Token verificato via Auth Service: ${req.user.id}`);
            next();
        } else {
            console.error('[AUTH] Token non valido secondo Auth Service');
            return res.status(401).json({ 
                error: 'Token non valido',
                details: response.data.error || 'Verificare le credenziali'
            });
        }
        
    } catch (error) {
        console.error('[AUTH] Errore verifica con Auth Service:', error.message);
        
        // Fallback alla verifica locale in caso di errore di rete
        console.log('[AUTH]  Fallback a verifica locale...');
        return authenticateUser(req, res, next);
    }
};

module.exports = {
    authenticateUser,
    authenticateUserSimple,
    verifyTokenWithAuthService
};