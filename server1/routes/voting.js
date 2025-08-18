// server1/routes/voting.js
// Route API Gateway per il sistema WabiSabi

const express = require('express');
const router = express.Router();
const { callService } = require('../utils/serviceUtils');

// Middleware per autenticazione e forward headers
const authMiddleware = require('../middleware/auth');

// POST /api/voting/address - Proxy per generazione indirizzo Bitcoin
router.post('/address', authMiddleware, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🪙 Richiesta generazione indirizzo Bitcoin`);
        
        const response = await callService('vote', '/api/voting/address', 'POST', req.body, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
            'authorization': req.headers.authorization
        });
        
        console.log(`[API GATEWAY] ✅ Indirizzo Bitcoin generato`);
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
router.post('/credentials', authMiddleware, async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🔐 Richiesta credenziali KVAC`);
        
        const response = await callService('vote', '/api/voting/credentials', 'POST', req.body, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
            'authorization': req.headers.authorization
        });
        
        console.log(`[API GATEWAY] ✅ Credenziali KVAC generate`);
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore credenziali KVAC:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nella generazione delle credenziali',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/voting/submit - Proxy per invio voto anonimo
router.post('/submit', async (req, res) => {
    try {
        console.log(`[API GATEWAY] 🗳️ Invio voto anonimo`);
        
        // Il voto anonimo non richiede autenticazione perché usa credenziali KVAC
        const response = await callService('vote', '/api/voting/submit', 'POST', req.body);
        
        console.log(`[API GATEWAY] ✅ Voto anonimo inviato: ${response.voteId}`);
        res.json(response);
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore invio voto:`, error.message);
        res.status(error.status || 500).json({
            error: 'Errore nell\'invio del voto',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/voting/status/:voteId - Proxy per controllo stato voto
router.get('/status/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;
        console.log(`[API GATEWAY] 📊 Controllo stato voto ${voteId}`);
        
        const response = await callService('vote', `/api/voting/status/${voteId}`, 'GET');
        
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
router.get('/session/:sessionId/stats', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log(`[API GATEWAY] 📊 Statistiche sessione ${sessionId}`);
        
        // Solo admin possono vedere statistiche complete
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accesso negato - richiesti privilegi admin' });
        }
        
        const response = await callService('vote', `/api/voting/session/${sessionId}/stats`, 'GET', null, {
            'x-user-id': req.user.id,
            'x-user-email': req.user.email,
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

// GET /api/voting/debug - Debug info (solo development)
router.get('/debug', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Endpoint non disponibile in produzione' });
        }
        
        console.log(`[API GATEWAY] 🧪 Debug info WabiSabi`);
        
        const response = await callService('vote', '/api/voting/debug', 'GET');
        
        res.json({
            apiGateway: {
                service: 'API Gateway WabiSabi',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                routes: [
                    'POST /api/voting/address',
                    'POST /api/voting/credentials',
                    'POST /api/voting/submit',
                    'GET /api/voting/status/:voteId',
                    'GET /api/voting/session/:sessionId/stats'
                ]
            },
            voteService: response
        });
        
    } catch (error) {
        console.error(`[API GATEWAY] ❌ Errore debug:`, error.message);
        res.json({
            apiGateway: {
                service: 'API Gateway WabiSabi',
                status: 'active',
                error: 'Vote service non raggiungibile'
            },
            voteService: {
                status: 'error',
                error: error.message
            }
        });
    }
});

module.exports = router;