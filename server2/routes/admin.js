// server2/routes/admin.js - Auth Service Admin Routes
const express = require('express');
const router = express.Router();

// Middleware di autenticazione admin (implementa la tua logica)
const adminAuth = (req, res, next) => {
  // Per ora passa sempre - implementa la tua autenticazione
  next();
};

// GET /api/admin/stats - Statistiche utenti
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Simula query al database per statistiche utenti
    const userStats = {
      total: 1250,
      active: 890,
      verified: 1100,
      pending: 150,
      blocked: 25,
      whitelist: 950,
      growth: {
        thisWeek: 45,
        lastWeek: 38,
        percentage: 18.4
      },
      byStatus: {
        registered: 1250,
        verified: 1100,
        hasVoted: 650,
        credentialsIssued: 1050
      }
    };

    res.json(userStats);
  } catch (error) {
    console.error('Errore stats auth:', error);
    res.status(500).json({ error: 'Errore statistiche utenti' });
  }
});

// GET /api/admin/charts/7d - Dati grafici utenti ultimi 7 giorni
router.get('/charts/7d', adminAuth, async (req, res) => {
  try {
    const chartData = [];
    
    // Genera dati per ultimi 7 giorni
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      chartData.push({
        date: date.toISOString().split('T')[0],
        newUsers: Math.floor(Math.random() * 50) + 20,
        verifiedUsers: Math.floor(Math.random() * 45) + 15,
        activeUsers: Math.floor(Math.random() * 200) + 100,
        credentialsIssued: Math.floor(Math.random() * 40) + 25
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error('Errore charts auth:', error);
    res.status(500).json({ error: 'Errore dati grafici utenti' });
  }
});

// POST /api/admin/auth/login - Login amministratore
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username e password sono richiesti' 
      });
    }
    
    // Verifica credenziali admin (implementa la tua logica)
    if (username === 'admin' && password === 'admin123') {
      // Genera token JWT (in un sistema reale)
      const token = 'admin-jwt-token-' + Date.now();
      
      res.json({ 
        success: true,
        token,
        user: { 
          id: 1, 
          username: 'admin',
          email: 'admin@wabisabi.vote', 
          role: 'admin',
          permissions: ['read', 'write', 'admin']
        } 
      });
    } else {
      res.status(401).json({ 
        success: false,
        error: 'Credenziali non valide' 
      });
    }
  } catch (error) {
    console.error('Errore login admin:', error);
    res.status(500).json({ error: 'Errore interno durante il login' });
  }
});

// POST /api/admin/auth/verify - Verifica token admin
router.post('/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'Token mancante' });
    }
    
    // Simula verifica token admin
    // In un sistema reale verificheresti il JWT
    if (token === 'admin-token' || token.startsWith('Bearer ')) {
      res.json({ 
        valid: true, 
        user: { 
          id: 1, 
          email: 'admin@wabisabi.vote', 
          role: 'admin',
          permissions: ['read', 'write', 'admin']
        } 
      });
    } else {
      res.status(401).json({ 
        valid: false, 
        error: 'Token non valido' 
      });
    }
  } catch (error) {
    console.error('Errore auth verify:', error);
    res.status(500).json({ error: 'Errore verifica token' });
  }
});

// GET /api/admin/users - Lista utenti
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Simula lista utenti dal database
    const users = [];
    for (let i = 0; i < limit; i++) {
      users.push({
        id: i + 1,
        email: `user${i + 1}@example.com`,
        status: ['verified', 'pending', 'blocked'][Math.floor(Math.random() * 3)],
        hasVoted: Math.random() > 0.5,
        credentialsIssued: Math.random() > 0.3,
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
        lastActivity: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
      });
    }

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1250,
        pages: Math.ceil(1250 / limit)
      }
    });
  } catch (error) {
    console.error('Errore lista utenti:', error);
    res.status(500).json({ error: 'Errore recupero utenti' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

// Aggiungere al server2/app.js:
/*
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
*/