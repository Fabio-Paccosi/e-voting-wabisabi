// server1/routes/voting.js - Route API Gateway per WabiSabi con autenticazione JWT reale
const express = require('express');
const router = express.Router();

// Import del middleware di autenticazione JWT
const { authenticateUser, verifyTokenWithAuthService } = require('../middleware/auth');

// Funzione per chiamare il Vote Service
const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
    const axios = require('axios');
    const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://vote-service:3003';
    const url = `${VOTE_SERVICE_URL}${endpoint}`;
    
    console.log(`[CALL SERVICE] ${method} ${url}`);
    
    try {
        const config = {
            method: method.toLowerCase(),
            url,
            timeout: 15000, // Aumentato timeout per operazioni WabiSabi
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.data = data;
        }
        
        const response = await axios(config);
        console.log(`[CALL SERVICE] ✅ ${method} ${url} → ${response.status}`);
        return response.data;
        
    } catch (error) {
        console.error(`[CALL SERVICE] ❌ ${method} ${url} →`, error.message);
        
        // Log più dettagliato per errori di servizio
        if (error.response) {
            console.error(`[CALL SERVICE] Response status: ${error.response.status}`);
            console.error(`[CALL SERVICE] Response data:`, error.response.data);
        }
        
        const errorToThrow = new Error(`Vote service error: ${error.message}`);
        errorToThrow.status = error.response?.status || 503;
        errorToThrow.originalError = error.response?.data || error.message;
        throw errorToThrow;
    }
};

// POST /api/voting/address - Proxy per generazione indirizzo Bitcoin
router.post('/address', authenticateUser, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🪙 Richiesta generazione indirizzo Bitcoin per utente ${req.user.id}`);
        console.log(`[API GATEWAY] Dati richiesta:`, {
            userId: req.body.userId,
            electionId: req.body.electionId,
            userFromToken: req.user.id
        });
        
        // Verifica che l'utente nel body corrisponda all'utente autenticato
        if (req.body.userId && req.body.userId !== req.user.id) {
            console.error(`[API GATEWAY] ❌ Tentativo di generare indirizzo per altro utente: ${req.body.userId} vs ${req.user.id}`);
            return res.status(403).json({
                error: 'Non autorizzato',
                details: 'Non puoi generare indirizzi per altri utenti'
            });
        }
        
        // Assicurati che userId nel body sia quello dell'utente autenticato
        const requestData = {
            ...req.body,
            userId: req.user.id
        };
        
        const response = await callService('vote', '/api/voting/address', 'POST', requestData, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
            'x-user-firstname': req.user.firstName,
            'x-user-lastname': req.user.lastName,
            'authorization': req.headers.authorization
        });
        
        console.log(`[API GATEWAY] ✅ Indirizzo Bitcoin generato per utente ${req.user.id}`);
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore generazione indirizzo:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nella generazione dell\'indirizzo Bitcoin',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/voting/credentials - Proxy per richiesta credenziali KVAC
router.post('/credentials', authenticateUser, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🔐 Richiesta credenziali KVAC per utente ${req.user.id}`);
        
        // Verifica che l'utente nel body corrisponda all'utente autenticato
        if (req.body.userId && req.body.userId !== req.user.id) {
            console.error(`[API GATEWAY] ❌ Tentativo di richiedere credenziali per altro utente`);
            return res.status(403).json({
                error: 'Non autorizzato',
                details: 'Non puoi richiedere credenziali per altri utenti'
            });
        }
        
        const requestData = {
            ...req.body,
            userId: req.user.id
        };
        
        const response = await callService('vote', '/api/voting/credentials', 'POST', requestData, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
            'x-user-firstname': req.user.firstName,
            'x-user-lastname': req.user.lastName,
            'authorization': req.headers.authorization
        });
        
        console.log(`[API GATEWAY] ✅ Credenziali KVAC generate per utente ${req.user.id}`);
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore credenziali KVAC:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nella richiesta credenziali KVAC',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/voting/submit - Proxy per invio voto anonimo
router.post('/submit', authenticateUser, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 📬 Invio voto anonimo per utente ${req.user.id}`);
        
        // Per il voto anonimo, non includiamo l'ID utente nel body per privacy
        // Ma lo passiamo negli headers per la verifica lato server
        const response = await callService('vote', '/api/voting/submit', 'POST', req.body, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
            'authorization': req.headers.authorization
        });
        
        console.log(`[API GATEWAY] ✅ Voto anonimo inviato per utente ${req.user.id}`);
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore invio voto:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nell\'invio del voto anonimo',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/voting/status/:voteId - Proxy per controllo stato voto
router.get('/status/:voteId', authenticateUser, async (req, res) => {
    try {
        const { voteId } = req.params;
        console.log(`[API GATEWAY] 📊 Controllo stato voto ${voteId} per utente ${req.user.id}`);
        
        const response = await callService('vote', `/api/voting/status/${voteId}`, 'GET', null, {
            'x-user-id': req.user.id,
            'authorization': req.headers.authorization
        });
        
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore controllo stato:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nel controllo dello stato del voto',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/voting/session/:sessionId/stats - Proxy per statistiche sessione
router.get('/session/:sessionId/stats', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log(`[API GATEWAY] 📈 Statistiche sessione ${sessionId} per utente ${req.user.id}`);
        
        const response = await callService('vote', `/api/voting/session/${sessionId}/stats`, 'GET', null, {
            'x-user-id': req.user.id,
            'authorization': req.headers.authorization
        });
        
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore statistiche sessione:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nel recupero delle statistiche',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/voting/debug - Endpoint di debug (solo sviluppo)
router.get('/debug', authenticateUser, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🔧 Debug WabiSabi per utente ${req.user.id}`);
        
        // Solo per utenti admin o in modalità development
        if (req.user.role !== 'administrator' && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Endpoint di debug non disponibile in produzione'
            });
        }
        
        const response = await callService('vote', '/api/voting/debug', 'GET', null, {
            'x-user-id': req.user.id,
            'authorization': req.headers.authorization
        });
        
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore debug:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nel debug',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

console.log('[VOTING ROUTES] ✅ Route WabiSabi con autenticazione JWT reale caricate');
module.exports = router;