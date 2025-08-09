const express = require('express');
const axios = require('axios');
const router = express.Router();

// URL dei servizi con fallback - DOCKER e LOCAL
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://auth-service:3002' : 'http://127.0.0.1:3002');
const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://vote-service:3003' : 'http://127.0.0.1:3003');

console.log('[ADMIN ROUTES] Configurazione servizi:');
console.log(`  Auth Service: ${AUTH_SERVICE_URL}`);
console.log(`  Vote Service: ${VOTE_SERVICE_URL}`);

// Helper per chiamate ai servizi - VERSIONE CORRETTA
const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
  const baseURL = service === 'auth' ? AUTH_SERVICE_URL : VOTE_SERVICE_URL;
  const url = `${baseURL}${endpoint}`;
  
  console.log(`[CALL SERVICE] ${method} ${url}`, data ? 'with data' : 'no data');
  
  try {
    const config = {
      method: method.toLowerCase(),
      url,
      timeout: 10000,
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
    console.error(`[CALL SERVICE] ✗ ${method} ${url} → ERROR:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Re-throw con informazioni più dettagliate
    const errorToThrow = new Error(`Errore chiamata ${service}: ${error.message}`);
    errorToThrow.status = error.response?.status || 500;
    errorToThrow.originalError = error.response?.data || error.message;
    throw errorToThrow;
  }
};

// ==========================================
// AUTH ROUTES
// ==========================================

// POST /api/admin/auth/login - Login admin
router.post('/auth/login', async (req, res) => {
  console.log('[ADMIN LOGIN] Richiesta login:', req.body.username);
  
  try {
    const response = await callService('auth', '/api/admin/auth/login', 'POST', req.body);
    console.log('[ADMIN LOGIN] ✓ Login riuscito');
    res.json(response);
  } catch (error) {
    console.error('[ADMIN LOGIN] ✗ Errore login:', error.message);
    res.status(error.status || 500).json({ 
      error: 'Errore nel login amministratore',
      details: error.originalError || error.message
    });
  }
});

// POST /api/admin/auth/verify - Verifica token admin
router.post('/auth/verify', async (req, res) => {
  console.log('[ADMIN VERIFY] Verifica token');
  
  try {
    const response = await callService('auth', '/api/admin/auth/verify', 'POST', req.body);
    console.log('[ADMIN VERIFY] ✓ Verifica completata');
    res.json(response);
  } catch (error) {
    console.error('[ADMIN VERIFY] ✗ Errore verifica:', error.message);
    res.status(error.status || 500).json({ 
      error: 'Errore nella verifica autenticazione',
      details: error.originalError || error.message
    });
  }
});

// ==========================================
// STATISTICHE AGGREGATE
// ==========================================

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  console.log('[ADMIN STATS] Richiesta statistiche aggregate');
  
  try {
    // Chiamate parallele ai servizi con gestione errori individuali
    const [authStats, voteStats] = await Promise.allSettled([
      callService('auth', '/api/admin/stats'),
      callService('vote', '/api/admin/stats')
    ]);

    // Combina le statistiche
    const stats = {
      users: authStats.status === 'fulfilled' ? authStats.value : { 
        error: 'Auth service non disponibile',
        total: 0, 
        active: 0 
      },
      votes: voteStats.status === 'fulfilled' ? voteStats.value : { 
        error: 'Vote service non disponibile',
        total: 0, 
        pending: 0 
      },
      system: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          auth: authStats.status,
          vote: voteStats.status
        }
      }
    };

    console.log('[ADMIN STATS] ✓ Statistiche aggregate generate');
    res.json(stats);
  } catch (error) {
    console.error('[ADMIN STATS] ✗ Errore aggregazione stats:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle statistiche' });
  }
});

// GET /api/admin/system-status
router.get('/system-status', async (req, res) => {
  console.log('[ADMIN STATUS] Verifica stato sistema');
  
  try {
    // Verifica stato di tutti i servizi
    const services = [
      { name: 'API Gateway', url: 'http://localhost:3001/api/health' },
      { name: 'Auth Service', url: `${AUTH_SERVICE_URL}/api/health` },
      { name: 'Vote Service', url: `${VOTE_SERVICE_URL}/api/health` }
    ];

    const statusChecks = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const start = Date.now();
          const response = await axios.get(service.url, { timeout: 5000 });
          const responseTime = Date.now() - start;
          return { 
            name: service.name, 
            status: 'running', 
            responseTime: `${responseTime}ms`,
            url: service.url
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

    console.log('[ADMIN STATUS] ✓ Stato sistema verificato');
    res.json(systemStatus);
  } catch (error) {
    console.error('[ADMIN STATUS] ✗ Errore system-status:', error);
    res.status(500).json({ error: 'Errore nel caricamento dello stato del sistema' });
  }
});

// GET /api/admin/logs
router.get('/logs', async (req, res) => {
  console.log('[ADMIN LOGS] Richiesta logs');
  
  try {
    const { limit = 10 } = req.query;
    
    // Per ora restituiamo logs simulati
    const logs = [];
    
    for (let i = 0; i < parseInt(limit); i++) {
      logs.push({
        id: Date.now() + i,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)],
        service: ['gateway', 'auth', 'vote'][Math.floor(Math.random() * 3)],
        message: `Log entry ${i + 1} - Sistema operativo`,
        details: `Dettagli operazione ${i + 1}`
      });
    }

    console.log('[ADMIN LOGS] ✓ Logs generati');
    res.json(logs);
  } catch (error) {
    console.error('[ADMIN LOGS] ✗ Errore logs:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei logs' });
  }
});

// GET /api/admin/charts/7d
router.get('/charts/7d', async (req, res) => {
  console.log('[ADMIN CHARTS] Richiesta dati grafici');
  
  try {
    // Raccoglie dati per grafici da entrambi i servizi
    const [authData, voteData] = await Promise.allSettled([
      callService('auth', '/api/admin/charts/7d'),
      callService('vote', '/api/admin/charts/7d')
    ]);

    const chartData = {
      users: authData.status === 'fulfilled' ? authData.value : [],
      votes: voteData.status === 'fulfilled' ? voteData.value : [],
      period: '7d',
      generated: new Date().toISOString(),
      errors: {
        auth: authData.status === 'rejected' ? authData.reason.message : null,
        vote: voteData.status === 'rejected' ? voteData.reason.message : null
      }
    };

    console.log('[ADMIN CHARTS] ✓ Dati grafici generati');
    res.json(chartData);
  } catch (error) {
    console.error('[ADMIN CHARTS] ✗ Errore charts:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei dati grafici' });
  }
});

// ==========================================
// TEST ENDPOINT
// ==========================================

// GET /api/admin/test-connection
router.get('/test-connection', async (req, res) => {
  console.log('[ADMIN TEST] Test connessione servizi');
  
  try {
    const tests = [];
    
    // Test Auth Service
    try {
      const authResponse = await axios.get(`${AUTH_SERVICE_URL}/api/health`, { timeout: 3000 });
      tests.push({
        service: 'auth',
        url: `${AUTH_SERVICE_URL}/api/health`,
        status: 'ok',
        responseTime: authResponse.headers['x-response-time'] || 'N/A'
      });
    } catch (error) {
      tests.push({
        service: 'auth',
        url: `${AUTH_SERVICE_URL}/api/health`,
        status: 'error',
        error: error.message
      });
    }
    
    // Test Vote Service
    try {
      const voteResponse = await axios.get(`${VOTE_SERVICE_URL}/api/health`, { timeout: 3000 });
      tests.push({
        service: 'vote',
        url: `${VOTE_SERVICE_URL}/api/health`,
        status: 'ok',
        responseTime: voteResponse.headers['x-response-time'] || 'N/A'
      });
    } catch (error) {
      tests.push({
        service: 'vote',
        url: `${VOTE_SERVICE_URL}/api/health`,
        status: 'error',
        error: error.message
      });
    }
    
    res.json({
      gateway: 'ok',
      services: tests,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ADMIN TEST] ✗ Errore test:', error);
    res.status(500).json({ error: 'Errore test connessione' });
  }
});

console.log('[ADMIN ROUTES] ✓ Route admin caricate');

module.exports = router;