const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

// Configurazione servizi backend
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
  vote: process.env.VOTE_SERVICE_URL || 'http://localhost:3003',
};

// Middleware autenticazione admin
const adminAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token di accesso richiesto' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso admin richiesto' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

// Helper per chiamate ai microservizi
const callService = async (service, endpoint, method = 'GET', data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${SERVICES[service]}${endpoint}`,
      headers,
      timeout: 10000
    };
    
    if (data) config.data = data;
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Errore chiamata ${service}${endpoint}:`, error.message);
    throw error;
  }
};

// ==========================================
// AUTENTICAZIONE ADMIN
// ==========================================

// Login admin
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Credenziali admin hardcoded per ora - da spostare in database
    const ADMIN_USERS = [
      { username: 'admin', password: '$2b$10$xyz...', role: 'admin' },
      { username: 'supervisor', password: '$2b$10$abc...', role: 'admin' }
    ];
    
    const admin = ADMIN_USERS.find(u => u.username === username);
    if (!admin) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    // Per demo, accetta password semplice "admin123"
    const validPassword = password === 'admin123' || await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const token = jwt.sign(
      { 
        id: admin.username,
        username: admin.username,
        role: admin.role,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 ore
      },
      process.env.JWT_SECRET
    );
    
    res.json({
      token,
      admin: {
        username: admin.username,
        role: admin.role
      }
    });
    
  } catch (error) {
    console.error('Errore login admin:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Verifica token
router.get('/auth/verify', adminAuth, (req, res) => {
  res.json({
    valid: true,
    admin: {
      username: req.admin.username,
      role: req.admin.role
    }
  });
});

// Logout
router.post('/auth/logout', adminAuth, (req, res) => {
  // Per JWT stateless, il logout è gestito lato client
  res.json({ message: 'Logout effettuato' });
});

// ==========================================
// STATISTICHE DASHBOARD
// ==========================================

// Statistiche generali
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Chiama tutti i servizi per ottenere statistiche
    const [authStats, voteStats] = await Promise.allSettled([
      callService('auth', '/api/admin/stats'),
      callService('vote', '/api/admin/stats')
    ]);
    
    const stats = {
      totalElections: voteStats.status === 'fulfilled' ? voteStats.value.totalElections : 0,
      totalVotes: voteStats.status === 'fulfilled' ? voteStats.value.totalVotes : 0,
      activeUsers: authStats.status === 'fulfilled' ? authStats.value.activeUsers : 0,
      whitelistUsers: authStats.status === 'fulfilled' ? authStats.value.whitelistUsers : 0,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Errore recupero statistiche:', error);
    res.status(500).json({ 
      error: 'Errore recupero statistiche',
      details: error.message 
    });
  }
});

// Stato sistema
router.get('/system-status', adminAuth, async (req, res) => {
  try {
    const services = [];
    
    // Test connettività servizi
    for (const [name, url] of Object.entries(SERVICES)) {
      const startTime = Date.now();
      try {
        await axios.get(`${url}/api/health`, { timeout: 5000 });
        services.push({
          name: `${name}-service`,
          status: 'online',
          responseTime: Date.now() - startTime,
          url: url
        });
      } catch (error) {
        services.push({
          name: `${name}-service`,
          status: 'offline',
          responseTime: Date.now() - startTime,
          error: error.message
        });
      }
    }
    
    // Test database e Redis (tramite auth service)
    let database = { status: 'unknown', responseTime: 0 };
    let redis = { status: 'unknown', responseTime: 0 };
    
    try {
      const systemInfo = await callService('auth', '/api/admin/system-info');
      database = systemInfo.database || database;
      redis = systemInfo.redis || redis;
    } catch (error) {
      console.warn('Impossibile recuperare info sistema:', error.message);
    }
    
    res.json({
      services,
      database,
      redis,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('Errore stato sistema:', error);
    res.status(500).json({ error: 'Errore recupero stato sistema' });
  }
});

// Grafici e trend
router.get('/charts/:timeRange', adminAuth, async (req, res) => {
  try {
    const { timeRange } = req.params; // 1d, 7d, 30d
    
    // Chiama i servizi per ottenere dati storici
    const [voteData, authData] = await Promise.allSettled([
      callService('vote', `/api/admin/charts/${timeRange}`),
      callService('auth', `/api/admin/charts/${timeRange}`)
    ]);
    
    const charts = {
      votesOverTime: voteData.status === 'fulfilled' ? voteData.value.votesOverTime : [],
      registrationsOverTime: authData.status === 'fulfilled' ? authData.value.registrationsOverTime : [],
      electionsOverTime: voteData.status === 'fulfilled' ? voteData.value.electionsOverTime : []
    };
    
    res.json(charts);
    
  } catch (error) {
    console.error('Errore grafici:', error);
    res.status(500).json({ error: 'Errore recupero dati grafici' });
  }
});

// Log sistema aggregati
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const { limit = 50, level = 'all' } = req.query;
    
    // Recupera log da tutti i servizi
    const [authLogs, voteLogs] = await Promise.allSettled([
      callService('auth', `/api/admin/logs?limit=${limit}&level=${level}`),
      callService('vote', `/api/admin/logs?limit=${limit}&level=${level}`)
    ]);
    
    let allLogs = [];
    
    if (authLogs.status === 'fulfilled') {
      allLogs = [...allLogs, ...authLogs.value.logs.map(log => ({ ...log, service: 'auth' }))];
    }
    
    if (voteLogs.status === 'fulfilled') {
      allLogs = [...allLogs, ...voteLogs.value.logs.map(log => ({ ...log, service: 'vote' }))];
    }
    
    // Ordina per timestamp
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      logs: allLogs.slice(0, limit),
      total: allLogs.length
    });
    
  } catch (error) {
    console.error('Errore log sistema:', error);
    res.status(500).json({ error: 'Errore recupero log' });
  }
});

// ==========================================
// PROXY ROUTES PER MICROSERVIZI
// ==========================================

// Proxy per gestione elezioni
router.use('/elections', adminAuth, async (req, res) => {
  try {
    const response = await callService(
      'vote',
      `/api/admin/elections${req.url}`,
      req.method,
      req.body,
      { 'Content-Type': 'application/json' }
    );
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore servizio elezioni',
      details: error.message 
    });
  }
});

// Proxy per gestione utenti
router.use('/users', adminAuth, async (req, res) => {
  try {
    const response = await callService(
      'auth',
      `/api/admin/users${req.url}`,
      req.method,
      req.body,
      { 'Content-Type': 'application/json' }
    );
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore servizio utenti',
      details: error.message 
    });
  }
});

// Proxy per whitelist
router.use('/whitelist', adminAuth, async (req, res) => {
  try {
    const response = await callService(
      'auth',
      `/api/admin/whitelist${req.url}`,
      req.method,
      req.body,
      req.headers['content-type']?.includes('multipart/form-data') 
        ? req.headers 
        : { 'Content-Type': 'application/json' }
    );
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore servizio whitelist',
      details: error.message 
    });
  }
});

// ==========================================
// OPERAZIONI SISTEMA
// ==========================================

// Health check admin
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Informazioni sistema generale
router.get('/system-info', adminAuth, async (req, res) => {
  try {
    // Statistiche Node.js
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      system: {
        node_version: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      services: SERVICES,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore info sistema:', error);
    res.status(500).json({ error: 'Errore recupero info sistema' });
  }
});

// Restart servizi (comando remoto)
router.post('/restart-service/:service', adminAuth, async (req, res) => {
  try {
    const { service } = req.params;
    
    if (!SERVICES[service]) {
      return res.status(400).json({ error: 'Servizio non trovato' });
    }
    
    // Segnale di restart (implementazione dipende dall'infrastruttura)
    console.log(`Admin ${req.admin.username} richiesto restart servizio: ${service}`);
    
    res.json({
      message: `Richiesta restart per ${service} inviata`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore restart servizio:', error);
    res.status(500).json({ error: 'Errore restart servizio' });
  }
});

// ==========================================
// MIDDLEWARE GESTIONE ERRORI
// ==========================================

// Error handler
router.use((error, req, res, next) => {
  console.error('Errore admin router:', error);
  res.status(500).json({
    error: 'Errore interno server admin',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;