// server1/routes/client.js - Route per utenti del sistema di votazione
const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL dei servizi
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://localhost:3003';

console.log('[CLIENT ROUTES] Configurazione servizi:');
console.log(`  Auth Service: ${AUTH_SERVICE_URL}`);
console.log(`  Vote Service: ${VOTE_SERVICE_URL}`);

// Token di autenticazione
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper per chiamate ai servizi con retry
const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
    const baseURL = service === 'auth' ? AUTH_SERVICE_URL : VOTE_SERVICE_URL;
    const url = `${baseURL}${endpoint}`;
    
    console.log(`[CLIENT SERVICE] ${method} ${url}`);
    
    const maxRetries = 2;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const config = {
                method: method.toLowerCase(),
                url,
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            
            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.data = data;
            }
            
            const response = await axios(config);
            console.log(`[CLIENT SERVICE] ✓ ${method} ${url} → ${response.status}`);
            return response.data;
            
        } catch (error) {
            lastError = error;
            console.error(`[CLIENT SERVICE] ✗ Attempt ${attempt}/${maxRetries} ${method} ${url} → ERROR:`, error.message);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    const errorToThrow = new Error(`${service} service unreachable: ${lastError.message}`);
    errorToThrow.status = lastError.response?.status || 503;
    errorToThrow.originalError = lastError.response?.data || lastError.message;
    throw errorToThrow;
};

// Middleware per estrarre utente dal token e aggiungerlo ai header
const addUserToHeaders = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            console.log('[CLIENT GATEWAY] Header Authorization mancante');
            return res.status(401).json({ 
                error: 'Token di autenticazione richiesto',
                message: 'Effettua il login per accedere a questa risorsa'
            });
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            console.log('[CLIENT GATEWAY] Token mancante nell\'header');
            return res.status(401).json({ 
                error: 'Token non valido',
                message: 'Formato del token non corretto'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Aggiungi l'ID utente ai header per i servizi downstream
        req.headers['x-user-id'] = decoded.id;
        req.headers['x-user-email'] = decoded.email;
        
        console.log(`[CLIENT GATEWAY] ✓ Token validato per utente: ${decoded.email}`);
        next();
        
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore validazione token:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Token non valido',
                message: 'Il token fornito non è valido'
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token scaduto',
                message: 'Effettua nuovamente il login'
            });
        } else {
            return res.status(500).json({ 
                error: 'Errore interno',
                message: 'Errore nella validazione del token'
            });
        }
    }
};

// ==========================================
// AUTENTICAZIONE UTENTI
// ==========================================

// POST /api/auth/login - Login utenti normali
router.post('/auth/login', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta login utente normale');
        console.log('[CLIENT GATEWAY] Body ricevuto:', req.body);
        
        const response = await callService('auth', '/api/auth/login', 'POST', req.body);
        console.log('[CLIENT GATEWAY] ✓ Login utente completato');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore login utente:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nell\'autenticazione utente',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/auth/verify - Verifica token utente
router.post('/auth/verify', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta verifica token utente');
        const response = await callService('auth', '/api/auth/verify', 'POST', req.body);
        console.log('[CLIENT GATEWAY] ✓ Token utente verificato');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore verifica token:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella verifica autenticazione',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// GET /api/auth/profile - Profilo utente
router.get('/auth/profile', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta profilo utente');
        const response = await callService('auth', '/api/auth/profile', 'GET', null, {
            'Authorization': req.headers.authorization
        });
        console.log('[CLIENT GATEWAY] ✓ Profilo utente caricato');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore caricamento profilo:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento del profilo',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// ELEZIONI E VOTAZIONI
// ==========================================

// GET /api/elections - Lista elezioni disponibili per l'utente
router.get('/elections', addUserToHeaders, async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta elezioni disponibili');
        const queryString = new URLSearchParams(req.query).toString();
        const endpoint = `/api/elections${queryString ? '?' + queryString : ''}`;
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', endpoint, 'GET', null, req.headers);
        console.log('[CLIENT GATEWAY] ✓ Elezioni caricate');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore caricamento elezioni:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento delle elezioni',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/elections/available - Lista elezioni disponibili per l'utente (alias semantico)
router.get('/elections/available', addUserToHeaders, async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta elezioni disponibili (available endpoint)');
        const queryString = new URLSearchParams(req.query).toString();
        const endpoint = `/api/elections${queryString ? '?' + queryString : ''}`;
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', endpoint, 'GET', null, req.headers);
        console.log('[CLIENT GATEWAY] ✓ Elezioni disponibili caricate');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore caricamento elezioni disponibili:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento delle elezioni',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

router.get('/elections/:id/details', addUserToHeaders, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CLIENT GATEWAY] Richiesta dettagli elezione ${id} (route /details)`);
        
        // Usa la stessa logica della route principale
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', `/api/elections/${id}`, 'GET', null, req.headers);
        console.log(`[CLIENT GATEWAY] ✓ Dettagli elezione ${id} caricati (route /details)`);
        res.json(response);
    } catch (error) {
        console.error(`[CLIENT GATEWAY] ✗ Errore caricamento elezione ${req.params.id} (route /details):`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento dei dettagli dell\'elezione',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});


// GET /api/elections/:id - Dettagli elezione specifica
router.get('/elections/:id', addUserToHeaders, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CLIENT GATEWAY] Richiesta dettagli elezione ${id}`);
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', `/api/elections/${id}`, 'GET', null, req.headers);
        console.log(`[CLIENT GATEWAY] ✓ Dettagli elezione ${id} caricati`);
        res.json(response);
    } catch (error) {
        console.error(`[CLIENT GATEWAY] ✗ Errore caricamento elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento dei dettagli dell\'elezione',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

router.post('/elections/:id/verify-wallet', addUserToHeaders, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CLIENT GATEWAY] Verifica wallet per elezione ${id}`);
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', `/api/elections/${id}/verify-wallet`, 'POST', req.body, req.headers);
        console.log(`[CLIENT GATEWAY] ✓ Wallet verificato per elezione ${id}`);
        res.json(response);
    } catch (error) {
        console.error(`[CLIENT GATEWAY] ✗ Errore verifica wallet elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella verifica del wallet',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/elections/:id/vote - Invio voto
router.post('/elections/:id/vote', addUserToHeaders, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CLIENT GATEWAY] Invio voto per elezione ${id}`);
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', `/api/elections/${id}/vote`, 'POST', req.body, req.headers);
        console.log(`[CLIENT GATEWAY] ✓ Voto inviato per elezione ${id}`);
        res.json(response);
    } catch (error) {
        console.error(`[CLIENT GATEWAY] ✗ Errore invio voto elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nell\'invio del voto',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/elections/voted - Lista elezioni a cui l'utente ha partecipato
router.get('/elections/voted', addUserToHeaders, async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta elezioni votate');
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', '/api/elections/voted', 'GET', null, req.headers);
        console.log('[CLIENT GATEWAY] ✓ Elezioni votate caricate');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore caricamento elezioni votate:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento delle elezioni votate',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/elections/:id/results - Risultati di un'elezione specifica
router.get('/elections/:id/results', addUserToHeaders, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[CLIENT GATEWAY] Richiesta risultati elezione ${id}`);
        
        // Passa tutti i header inclusi quelli con informazioni utente
        const response = await callService('vote', `/api/elections/${id}/results`, 'GET', null, req.headers);
        console.log(`[CLIENT GATEWAY] ✓ Risultati elezione ${id} caricati`);
        res.json(response);
    } catch (error) {
        console.error(`[CLIENT GATEWAY] ✗ Errore caricamento risultati elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel caricamento dei risultati',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// ==========================================
// WHITELIST
// ==========================================

// GET /api/whitelist/check - Verifica se l'utente è in whitelist
router.get('/whitelist/check', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Verifica whitelist utente');
        const queryString = new URLSearchParams(req.query).toString();
        const endpoint = `/api/whitelist/check${queryString ? '?' + queryString : ''}`;
        
        const response = await callService('auth', endpoint, 'GET', null, {
            'Authorization': req.headers.authorization
        });
        console.log('[CLIENT GATEWAY] ✓ Stato whitelist verificato');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore verifica whitelist:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella verifica della whitelist',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/whitelist/register - Registrazione in whitelist
router.post('/whitelist/register', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta registrazione whitelist');
        const response = await callService('auth', '/api/whitelist/register', 'POST', req.body);
        console.log('[CLIENT GATEWAY] ✓ Registrazione whitelist completata');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore registrazione whitelist:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella registrazione alla whitelist',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

// GET /api/health - Health check per il client
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'client-gateway',
        timestamp: new Date().toISOString()
    });
});

console.log('[CLIENT ROUTES] ✓ Route client caricate');

module.exports = router;
// GET /api/auth/me - Compatibilità frontend (redirect a profile) 
router.get('/auth/me', async (req, res) => {
    try {
        console.log('[CLIENT GATEWAY] Richiesta auth/me (redirect a profile)');
        const response = await callService('auth', '/api/auth/profile', 'GET', null, {
            'Authorization': req.headers.authorization
        });
        console.log('[CLIENT GATEWAY] ✓ Auth/me completato');
        res.json(response);
    } catch (error) {
        console.error('[CLIENT GATEWAY] ✗ Errore auth/me:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nel recupero profilo utente',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});
