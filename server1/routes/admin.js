const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 ore.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 ore
      },
      process.env.JWT_SECRET
    );
    
    res.json({
      message: 'Login admin effettuato',
      token,
      admin: {
        username: admin.username,
        role: admin.role
      }
    });
    
  } catch (error) {
    console.error('Errore login admin:', error);
    res.status(500).json({ error: 'Errore server durante login' });
  }
});

// ==========================================
// GESTIONE UTENTI
// ==========================================

// Lista utenti
router.get('/users', adminAuth, async (req, res) => {
  try {
    const response = await callService('auth', '/api/admin/users', 'GET', null, {
      'Authorization': req.headers.authorization
    });
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore recupero utenti',
      details: error.message 
    });
  }
});

// Dettagli utente specifico
router.get('/users/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await callService('auth', `/api/admin/users/${userId}`, 'GET', null, {
      'Authorization': req.headers.authorization
    });
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore recupero dettagli utente',
      details: error.message 
    });
  }
});

// ==========================================
// GESTIONE ELEZIONI
// ==========================================

// Lista elezioni
router.get('/elections', adminAuth, async (req, res) => {
  try {
    const response = await callService('vote', '/api/admin/elections', 'GET', null, {
      'Authorization': req.headers.authorization
    });
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore recupero elezioni',
      details: error.message 
    });
  }
});

// Crea nuova elezione
router.post('/elections', adminAuth, async (req, res) => {
  try {
    const response = await callService('vote', '/api/admin/elections', 'POST', req.body, {
      'Authorization': req.headers.authorization,
      'Content-Type': 'application/json'
    });
    res.json(response);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore creazione elezione',
      details: error.message 
    });
  }
});

// ==========================================
// STATISTICHE E MONITORAGGIO
// ==========================================

// Dashboard statistiche
router.get('/dashboard/stats', adminAuth, async (req, res) => {
  try {
    // Raccoglie statistiche da più servizi
    const [usersStats, votesStats] = await Promise.all([
      callService('auth', '/api/admin/stats', 'GET', null, {
        'Authorization': req.headers.authorization
      }),
      callService('vote', '/api/admin/stats', 'GET', null, {
        'Authorization': req.headers.authorization
      })
    ]);
    
    res.json({
      users: usersStats,
      votes: votesStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Errore recupero statistiche',
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