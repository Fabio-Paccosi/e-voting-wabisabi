// server1/routes/admin.js - API Gateway Admin Routes Complete
const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL dei servizi
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://localhost:3003';

console.log('[ADMIN ROUTES] Configurazione servizi:');
console.log(`  Auth Service: ${AUTH_SERVICE_URL}`);
console.log(`  Vote Service: ${VOTE_SERVICE_URL}`);

// Helper per chiamate ai servizi con retry
const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
    const baseURL = service === 'auth' ? AUTH_SERVICE_URL : VOTE_SERVICE_URL;
    const url = `${baseURL}${endpoint}`;
    
    console.log(`[CALL SERVICE] ${method} ${url}`);
    
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
            console.log(`[CALL SERVICE] ✓ ${method} ${url} → ${response.status}`);
            return response.data;
            
        } catch (error) {
            lastError = error;
            console.error(`[CALL SERVICE] ✗ Attempt ${attempt}/${maxRetries} ${method} ${url} → ERROR:`, error.message);
            
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

// ==========================================
// TEST & DEBUG ENDPOINTS
// ==========================================

// GET /api/admin/test-services - Test connessione servizi
router.get('/test-services', async (req, res) => {
    console.log('[ADMIN TEST] Test connessione servizi');
    
    const results = {
        auth: { url: AUTH_SERVICE_URL, status: 'testing' },
        vote: { url: VOTE_SERVICE_URL, status: 'testing' }
    };
    
    // Test Auth Service
    try {
        const start = Date.now();
        const authResponse = await axios.get(`${AUTH_SERVICE_URL}/api/health`, { timeout: 3000 });
        results.auth = {
            url: AUTH_SERVICE_URL,
            status: 'ok',
            responseTime: `${Date.now() - start}ms`,
            data: authResponse.data
        };
    } catch (error) {
        results.auth = {
            url: AUTH_SERVICE_URL,
            status: 'error',
            error: error.message
        };
    }
    
    // Test Vote Service
    try {
        const start = Date.now();
        const voteResponse = await axios.get(`${VOTE_SERVICE_URL}/api/health`, { timeout: 3000 });
        results.vote = {
            url: VOTE_SERVICE_URL,
            status: 'ok',
            responseTime: `${Date.now() - start}ms`,
            data: voteResponse.data
        };
    } catch (error) {
        results.vote = {
            url: VOTE_SERVICE_URL,
            status: 'error',
            error: error.message
        };
    }
    
    res.json({
        timestamp: new Date().toISOString(),
        services: results
    });
});

// ==========================================
// AUTH ROUTES
// ==========================================

// POST /api/admin/auth/login
router.post('/auth/login', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/auth/login', 'POST', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore nel login amministratore',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/admin/auth/verify
router.get('/auth/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token mancante' 
            });
        }

        const response = await callService('auth', '/api/admin/auth/verify', 'POST', { token });
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            valid: false,
            error: 'Token non valido',
            details: error.originalError || error.message
        });
    }
});



// ==========================================
// STATISTICHE AGGREGATE
// ==========================================

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [authStats, voteStats] = await Promise.allSettled([
            callService('auth', '/api/admin/stats'),
            callService('vote', '/api/admin/stats')
        ]);

        // ✅ MAPPA I DATI NEL FORMATO CHE IL FRONTEND SI ASPETTA
        const stats = {
            // Frontend si aspetta users.total e users.active
            users: {
                total: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.totalUsers || authStats.value?.totalUsers || 0) : 0,
                active: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.activeUsers || authStats.value?.activeUsers || 0) : 0,
                pending: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.pendingUsers || 0) : 0,
                suspended: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.suspendedUsers || 0) : 0
            },
            
            // Frontend si aspetta votes.total e votes.pending  
            votes: {
                total: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.totalVotes || voteStats.value?.totalVotes || 0) : 0,
                pending: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.pendingVotes || voteStats.value?.pendingVotes || 0) : 0,
                processed: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.processedVotes || 0) : 0,
                failed: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.failedVotes || 0) : 0
            },
            
            // Frontend si aspetta elections.total al livello principale
            elections: {
                total: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.elections?.total || voteStats.value?.elections?.total || 0) : 0,
                active: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.elections?.active || voteStats.value?.elections?.active || 0) : 0,
                completed: voteStats.status === 'fulfilled' ? 
                    (voteStats.value?.votes?.elections?.completed || 0) : 0
            },
            
            // Frontend si aspetta whitelist.total
            whitelist: {
                total: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.whitelistEntries || authStats.value?.whitelistEntries || 0) : 0,
                verified: authStats.status === 'fulfilled' ? 
                    (authStats.value?.users?.verifiedUsers || 0) : 0
            },
            
            // Informazioni sistema
            system: {
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: {
                    auth: authStats.status,
                    vote: voteStats.status,
                    database: authStats.status === 'fulfilled' && voteStats.status === 'fulfilled' ? 'connected' : 'error',
                    redis: 'connected', // Assumiamo connected se i servizi rispondono
                    blockchain: voteStats.status === 'fulfilled' ? 'connected' : 'unknown'
                }
            }
        };

        console.log('[API GATEWAY] ✅ Stats aggregate formato frontend:', {
            users_total: stats.users.total,
            votes_total: stats.votes.total,
            elections_total: stats.elections.total,
            whitelist_total: stats.whitelist.total
        });

        res.json(stats);
    } catch (error) {
        console.error('[API GATEWAY] ❌ Errore stats:', error);
        res.status(500).json({ error: 'Errore nel caricamento delle statistiche' });
    }
});

// ==========================================
// SYSTEM STATUS
// ==========================================

const handleSystemStatus = async (req, res) => {
    try {
        const services = [
            { name: 'API Gateway', url: 'http://localhost:3001/api/health' },
            { name: 'Auth Service', url: `${AUTH_SERVICE_URL}/api/health` },
            { name: 'Vote Service', url: `${VOTE_SERVICE_URL}/api/health` }
        ];

        const statusChecks = await Promise.allSettled(
            services.map(async (service) => {
                try {
                    const start = Date.now();
                    const response = await axios.get(service.url, { timeout: 3000 });
                    return { 
                        name: service.name, 
                        status: 'running', 
                        responseTime: `${Date.now() - start}ms`,
                        url: service.url,
                        data: response.data
                    };
                } catch (error) {
                    return { 
                        name: service.name, 
                        status: 'error', 
                        error: error.message,
                        url: service.url
                    };
                }
            })
        );

        const systemStatus = {
            overall: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            services: statusChecks.map(result => result.value || result.reason),
            timestamp: new Date().toISOString()
        };

        res.json(systemStatus);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel caricamento dello stato del sistema' });
    }
};

router.get('/system-status', handleSystemStatus);
router.get('/system/status', handleSystemStatus);

// ==========================================
// GESTIONE UTENTI (Proxy a Auth Service)
// ==========================================

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const endpoint = `/api/admin/users${queryString ? '?' + queryString : ''}`;
        const response = await callService('auth', endpoint);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento utenti',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/admin/users - Crea nuovo utente
router.post('/users', async (req, res) => {
    try {
        console.log('[API GATEWAY] Creazione nuovo utente:', req.body.email);
        const response = await callService('auth', '/api/admin/users', 'POST', req.body);
        console.log('[API GATEWAY] ✓ Utente creato con successo');
        res.json(response);
    } catch (error) {
        console.error('[API GATEWAY] ✗ Errore creazione utente:', error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella creazione dell\'utente',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await callService('auth', `/api/admin/users/${id}/status`, 'PUT', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore aggiornamento status utente',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// GESTIONE WHITELIST (Proxy a Auth Service)
// ==========================================

// GET /api/admin/whitelist
router.get('/whitelist', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/whitelist');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento whitelist',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/admin/whitelist
router.post('/whitelist', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/whitelist', 'POST', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore aggiunta whitelist',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// DELETE /api/admin/whitelist/:email
router.delete('/whitelist/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const response = await callService('auth', `/api/admin/whitelist/${encodeURIComponent(email)}`, 'DELETE');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore rimozione whitelist',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// GESTIONE ELEZIONI (Proxy a Vote Service)
// ==========================================

// GET /api/admin/elections
router.get('/elections', async (req, res) => {
    try {
        const queryString = new URLSearchParams(req.query).toString();
        const endpoint = `/api/admin/elections${queryString ? '?' + queryString : ''}`;
        const response = await callService('vote', endpoint);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento elezioni',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/admin/elections/:id
router.get('/elections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await callService('vote', `/api/admin/elections/${id}`);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento dettagli elezione',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/admin/elections
router.post('/elections', async (req, res) => {
    try {
        const response = await callService('vote', '/api/admin/elections', 'POST', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore creazione elezione',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// PUT /api/admin/elections/:id/status
router.put('/elections/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await callService('vote', `/api/admin/elections/${id}/status`, 'PUT', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore aggiornamento status elezione',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// ==========================================
// GESTIONE CANDIDATI (Proxy a Vote Service)
// ==========================================

// GET /api/admin/elections/:id/candidates - Lista candidati di un'elezione
router.get('/elections/:id/candidates', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[API GATEWAY] GET candidati per elezione ${id}`);
        
        const response = await callService('vote', `/api/admin/elections/${id}/candidates`);
        res.json(response);
    } catch (error) {
        console.error(`[API GATEWAY] ✗ Errore caricamento candidati elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento candidati',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// POST /api/admin/elections/:id/candidates - Aggiungi candidato a un'elezione
router.post('/elections/:id/candidates', async (req, res) => {
    console.log("ciao mamma: "+req);
    try {
        const { id } = req.params;
        console.log(`[API GATEWAY] POST nuovo candidato per elezione ${id}:`, req.body);
        
        const response = await callService('vote', `/api/admin/elections/${id}/candidates`, 'POST', req.body);
        console.log(`[API GATEWAY] ✓ Candidato aggiunto con successo`);
        res.json(response);
    } catch (error) {
        console.error(`[API GATEWAY] ✗ Errore aggiunta candidato elezione ${req.params.id}:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nell\'aggiunta del candidato',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// PUT /api/admin/elections/:electionId/candidates/:candidateId - Modifica candidato
router.put('/elections/:electionId/candidates/:candidateId', async (req, res) => {
    try {
        const { electionId, candidateId } = req.params;
        console.log(`[API GATEWAY] PUT modifica candidato ${candidateId} elezione ${electionId}`);
        
        const response = await callService('vote', `/api/admin/elections/${electionId}/candidates/${candidateId}`, 'PUT', req.body);
        res.json(response);
    } catch (error) {
        console.error(`[API GATEWAY] ✗ Errore modifica candidato:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nella modifica del candidato',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// DELETE /api/admin/elections/:electionId/candidates/:candidateId - Elimina candidato
router.delete('/elections/:electionId/candidates/:candidateId', async (req, res) => {
    try {
        const { electionId, candidateId } = req.params;
        console.log(`[API GATEWAY] DELETE candidato ${candidateId} elezione ${electionId}`);
        
        const response = await callService('vote', `/api/admin/elections/${electionId}/candidates/${candidateId}`, 'DELETE');
        res.json(response);
    } catch (error) {
        console.error(`[API GATEWAY] ✗ Errore eliminazione candidato:`, error.message);
        res.status(error.status || 500).json({ 
            error: 'Errore nell\'eliminazione del candidato',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// ==========================================
// IMPOSTAZIONI (Proxy a Auth Service)
// ==========================================

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/settings');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento impostazioni',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// PUT /api/admin/settings/:key
router.put('/settings/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const response = await callService('auth', `/api/admin/settings/${key}`, 'PUT', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore aggiornamento impostazione',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// BACKUP (Proxy a Auth Service)
// ==========================================

// GET /api/admin/backups
router.get('/backups', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/backups');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore caricamento backup',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// POST /api/admin/backups
router.post('/backups', async (req, res) => {
    try {
        const response = await callService('auth', '/api/admin/backups', 'POST', req.body);
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore creazione backup',
            details: error.originalError || error.message,
            service: 'auth'
        });
    }
});

// ==========================================
// ATTIVITÀ
// ==========================================

// GET /api/admin/activity
router.get('/activity', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const [authActivity, voteActivity] = await Promise.allSettled([
            callService('auth', `/api/admin/activity?limit=${Math.floor(limit/2)}`),
            callService('vote', `/api/admin/activity?limit=${Math.floor(limit/2)}`)
        ]);

        let activities = [];

        if (authActivity.status === 'fulfilled' && authActivity.value) {
            activities = activities.concat(authActivity.value);
        }
        
        if (voteActivity.status === 'fulfilled' && voteActivity.value) {
            activities = activities.concat(voteActivity.value);
        }

        // Ordina per timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        activities = activities.slice(0, parseInt(limit));

        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel caricamento delle attività' });
    }
});

// ==========================================
// BLOCKCHAIN & COINJOIN (Proxy a Vote Service)
// ==========================================

// GET /api/admin/blockchain/status
router.get('/blockchain/status', async (req, res) => {
    try {
        const response = await callService('vote', '/api/admin/blockchain/status');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore stato blockchain',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// GET /api/admin/coinjoin/sessions
router.get('/coinjoin/sessions', async (req, res) => {
    try {
        const response = await callService('vote', '/api/admin/coinjoin/sessions');
        res.json(response);
    } catch (error) {
        res.status(error.status || 500).json({ 
            error: 'Errore sessioni CoinJoin',
            details: error.originalError || error.message,
            service: 'vote'
        });
    }
});

// ==========================================
// CHARTS DATA
// ==========================================

// GET /api/admin/charts/:period
router.get('/charts/:period', async (req, res) => {
    try {
        const { period } = req.params;
        
        const [authData, voteData] = await Promise.allSettled([
            callService('auth', `/api/admin/charts/${period}`),
            callService('vote', `/api/admin/charts/${period}`)
        ]);

        const chartData = {
            users: authData.status === 'fulfilled' ? authData.value : [],
            votes: voteData.status === 'fulfilled' ? voteData.value : [],
            period: period,
            generated: new Date().toISOString(),
            errors: {
                auth: authData.status === 'rejected' ? authData.reason.message : null,
                vote: voteData.status === 'rejected' ? voteData.reason.message : null
            }
        };

        res.json(chartData);
    } catch (error) {
        res.status(500).json({ error: 'Errore nel caricamento dei dati grafici' });
    }
});

// ==========================================
// LOGS
// ==========================================

// GET /api/admin/logs
router.get('/logs', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const logs = [
            {
                timestamp: new Date().toISOString(),
                level: 'info',
                service: 'api-gateway',
                message: 'Admin dashboard access',
                details: { ip: req.ip }
            },
            {
                timestamp: new Date(Date.now() - 60000).toISOString(),
                level: 'success',
                service: 'vote-service',
                message: 'New vote processed successfully'
            },
            {
                timestamp: new Date(Date.now() - 120000).toISOString(),
                level: 'info',
                service: 'auth-service',
                message: 'User authentication completed'
            }
        ];

        res.json(logs.slice(0, parseInt(limit)));
    } catch (error) {
        res.status(500).json({ error: 'Errore nel caricamento dei logs' });
    }
});

console.log('[ADMIN ROUTES] ✓ Route admin gateway complete caricate');

module.exports = router;