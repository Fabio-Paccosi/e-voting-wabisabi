// server2/routes/admin.js - Auth Service Admin Routes
const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const router = express.Router();

// Configurazione upload CSV
const upload = multer({ 
  memory: true,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file CSV sono supportati'), false);
    }
  }
});

// Database fittizio (in produzione usare PostgreSQL)
const db = {
  users: new Map(),
  whitelist: new Map(),
  logs: [],
  stats: {
    registrations: [],
    logins: []
  }
};

// Helper per logging
const logActivity = (type, message, level = 'info', metadata = {}) => {
  const logEntry = {
    id: Date.now() + Math.random(),
    type,
    message,
    level,
    timestamp: new Date().toISOString(),
    service: 'auth',
    metadata
  };
  
  db.logs.unshift(logEntry);
  
  // Mantieni solo gli ultimi 1000 log
  if (db.logs.length > 1000) {
    db.logs = db.logs.slice(0, 1000);
  }
  
  console.log(`[AUTH-ADMIN] ${level.toUpperCase()}: ${message}`);
  return logEntry;
};

// Helper per inizializzare dati demo
const initializeDemoData = () => {
  // Dati di test per whitelist
  const demoWhitelist = [
    { email: 'alice@example.com', taxCode: 'RSSMRA85M01H501Z', firstName: 'Alice', lastName: 'Rossi' },
    { email: 'bob@example.com', taxCode: 'VRDGPP90L15H501A', firstName: 'Bob', lastName: 'Verdi' },
    { email: 'charlie@example.com', taxCode: 'BNCLRA88S20H501B', firstName: 'Charlie', lastName: 'Bianchi' },
    { email: 'admin@evoting.local', taxCode: 'ADMINTEST001234', firstName: 'Admin', lastName: 'Test' }
  ];
  
  demoWhitelist.forEach(voter => {
    db.whitelist.set(voter.email, {
      ...voter,
      isAuthorized: true,
      authorizationProof: Math.random().toString(36).substring(2, 15),
      addedAt: new Date().toISOString(),
      addedBy: 'system'
    });
  });
  
  // Alcuni utenti registrati di esempio
  const demoUsers = [
    { email: 'alice@example.com', firstName: 'Alice', lastName: 'Rossi', status: 'active' },
    { email: 'bob@example.com', firstName: 'Bob', lastName: 'Verdi', status: 'active' }
  ];
  
  demoUsers.forEach(async (user, index) => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    db.users.set(user.email, {
      id: `user_${index + 1}`,
      ...user,
      password: hashedPassword,
      taxCode: demoWhitelist.find(w => w.email === user.email)?.taxCode,
      registeredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      loginCount: Math.floor(Math.random() * 10) + 1
    });
  });
  
  logActivity('system', 'Dati demo inizializzati', 'info', { 
    whitelistCount: demoWhitelist.length,
    usersCount: demoUsers.length 
  });
};

// Inizializza dati demo all'avvio
initializeDemoData();

// ==========================================
// STATISTICHE UTENTI
// ==========================================

// Statistiche generali
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const totalUsers = db.users.size;
    const whitelistUsers = db.whitelist.size;
    
    const recentRegistrations = Array.from(db.users.values())
      .filter(user => new Date(user.registeredAt) > oneDayAgo).length;
    
    const activeUsers = Array.from(db.users.values())
      .filter(user => user.status === 'active').length;
    
    const weeklyRegistrations = Array.from(db.users.values())
      .filter(user => new Date(user.registeredAt) > oneWeekAgo).length;
    
    res.json({
      totalUsers,
      activeUsers,
      whitelistUsers,
      recentRegistrations,
      weeklyRegistrations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore statistiche auth:', error);
    res.status(500).json({ error: 'Errore recupero statistiche' });
  }
});

// Grafici registrazioni nel tempo
router.get('/charts/:timeRange', async (req, res) => {
  try {
    const { timeRange } = req.params;
    const now = new Date();
    let startDate;
    let interval;
    
    switch (timeRange) {
      case '1d':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        interval = 60 * 60 * 1000; // 1 ora
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000; // 1 giorno
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000; // 1 giorno
        break;
      default:
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000;
    }
    
    const registrationsOverTime = [];
    const users = Array.from(db.users.values());
    
    for (let time = startDate.getTime(); time <= now.getTime(); time += interval) {
      const periodStart = new Date(time);
      const periodEnd = new Date(time + interval);
      
      const count = users.filter(user => {
        const regDate = new Date(user.registeredAt);
        return regDate >= periodStart && regDate < periodEnd;
      }).length;
      
      registrationsOverTime.push({
        date: periodStart.toISOString(),
        registrations: count
      });
    }
    
    res.json({
      registrationsOverTime,
      timeRange,
      generated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore grafici auth:', error);
    res.status(500).json({ error: 'Errore generazione grafici' });
  }
});

// ==========================================
// GESTIONE UTENTI
// ==========================================

// Lista utenti con paginazione
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'all', search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let users = Array.from(db.users.values());
    
    // Filtro per status
    if (status !== 'all') {
      users = users.filter(user => user.status === status);
    }
    
    // Filtro per ricerca
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.taxCode?.toLowerCase().includes(searchLower)
      );
    }
    
    // Ordinamento per data registrazione (più recenti prima)
    users.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
    
    const total = users.length;
    const paginatedUsers = users.slice(offset, offset + parseInt(limit));
    
    // Rimuovi password dai risultati
    const safeUsers = paginatedUsers.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.json({
      users: safeUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Errore lista utenti:', error);
    res.status(500).json({ error: 'Errore recupero utenti' });
  }
});

// Dettagli utente specifico
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = Array.from(db.users.values()).find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    const { password, ...safeUser } = user;
    
    res.json({
      user: safeUser,
      whitelistInfo: db.whitelist.get(user.email) || null
    });
    
  } catch (error) {
    console.error('Errore dettagli utente:', error);
    res.status(500).json({ error: 'Errore recupero dettagli utente' });
  }
});

// Aggiorna stato utente
router.put('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status non valido' });
    }
    
    const user = Array.from(db.users.entries()).find(([email, u]) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    const [email, userData] = user;
    userData.status = status;
    userData.lastModified = new Date().toISOString();
    
    db.users.set(email, userData);
    
    logActivity('user_status_change', `Status utente ${email} cambiato a ${status}`, 'info', {
      userId,
      email,
      newStatus: status
    });
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        status: userData.status
      }
    });
    
  } catch (error) {
    console.error('Errore aggiornamento status utente:', error);
    res.status(500).json({ error: 'Errore aggiornamento status' });
  }
});

// ==========================================
// GESTIONE WHITELIST
// ==========================================

// Lista whitelist
router.get('/whitelist', async (req, res) => {
  try {
    const whitelist = Array.from(db.whitelist.values())
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    res.json({
      whitelist,
      total: whitelist.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore whitelist:', error);
    res.status(500).json({ error: 'Errore recupero whitelist' });
  }
});

// Aggiungi singolo utente alla whitelist
router.post('/whitelist', async (req, res) => {
  try {
    const { email, taxCode, firstName, lastName } = req.body;
    
    if (!email || !taxCode) {
      return res.status(400).json({ error: 'Email e codice fiscale richiesti' });
    }
    
    if (db.whitelist.has(email)) {
      return res.status(409).json({ error: 'Email già presente in whitelist' });
    }
    
    const whitelistEntry = {
      email,
      taxCode: taxCode.toUpperCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      isAuthorized: true,
      authorizationProof: Math.random().toString(36).substring(2, 15),
      addedAt: new Date().toISOString(),
      addedBy: 'admin' // In produzione usare req.admin.username
    };
    
    db.whitelist.set(email, whitelistEntry);
    
    logActivity('whitelist_add', `Aggiunto ${email} alla whitelist`, 'info', whitelistEntry);
    
    res.status(201).json({
      success: true,
      entry: whitelistEntry
    });
    
  } catch (error) {
    console.error('Errore aggiunta whitelist:', error);
    res.status(500).json({ error: 'Errore aggiunta whitelist' });
  }
});

// Rimuovi dalla whitelist
router.delete('/whitelist/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!db.whitelist.has(email)) {
      return res.status(404).json({ error: 'Email non trovata in whitelist' });
    }
    
    const removedEntry = db.whitelist.get(email);
    db.whitelist.delete(email);
    
    logActivity('whitelist_remove', `Rimosso ${email} dalla whitelist`, 'warning', removedEntry);
    
    res.json({
      success: true,
      message: `${email} rimosso dalla whitelist`
    });
    
  } catch (error) {
    console.error('Errore rimozione whitelist:', error);
    res.status(500).json({ error: 'Errore rimozione whitelist' });
  }
});

// Upload CSV whitelist
router.post('/whitelist/upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File CSV richiesto' });
    }
    
    const csvString = req.file.buffer.toString('utf8');
    const stream = Readable.from([csvString]);
    
    const results = [];
    const errors = [];
    
    stream
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Validazione CSV
          const email = row.email?.trim().toLowerCase();
          const taxCode = row.taxCode?.trim().toUpperCase();
          const firstName = row.firstName?.trim() || '';
          const lastName = row.lastName?.trim() || '';
          
          if (!email || !taxCode) {
            errors.push({ row: results.length + 1, error: 'Email e codice fiscale richiesti' });
            return;
          }
          
          if (db.whitelist.has(email)) {
            errors.push({ row: results.length + 1, email, error: 'Email già presente' });
            return;
          }
          
          const whitelistEntry = {
            email,
            taxCode,
            firstName,
            lastName,
            isAuthorized: true,
            authorizationProof: Math.random().toString(36).substring(2, 15),
            addedAt: new Date().toISOString(),
            addedBy: 'admin-csv'
          };
          
          db.whitelist.set(email, whitelistEntry);
          results.push(whitelistEntry);
          
        } catch (error) {
          errors.push({ row: results.length + 1, error: error.message });
        }
      })
      .on('end', () => {
        logActivity('whitelist_csv_upload', `Upload CSV completato: ${results.length} aggiunti, ${errors.length} errori`, 'info', {
          added: results.length,
          errors: errors.length
        });
        
        res.json({
          success: true,
          added: results.length,
          errors: errors.length,
          details: {
            added: results,
            errors: errors
          }
        });
      })
      .on('error', (error) => {
        console.error('Errore parsing CSV:', error);
        res.status(400).json({ error: 'Errore parsing CSV: ' + error.message });
      });
      
  } catch (error) {
    console.error('Errore upload CSV:', error);
    res.status(500).json({ error: 'Errore upload CSV' });
  }
});

// ==========================================
// SISTEMA E LOG
// ==========================================

// Info sistema (database e Redis)
router.get('/system-info', async (req, res) => {
  try {
    // Simula check database e Redis
    const dbStartTime = Date.now();
    // Simula query database
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    const dbResponseTime = Date.now() - dbStartTime;
    
    const redisStartTime = Date.now();
    // Simula ping Redis
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
    const redisResponseTime = Date.now() - redisStartTime;
    
    res.json({
      database: {
        status: 'healthy',
        responseTime: dbResponseTime,
        connections: 5,
        tables: ['users', 'whitelist', 'sessions']
      },
      redis: {
        status: 'healthy', 
        responseTime: redisResponseTime,
        memory: '2.1MB',
        keys: 42
      },
      auth_service: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error('Errore info sistema auth:', error);
    res.status(500).json({ error: 'Errore recupero info sistema' });
  }
});

// Log servizio auth
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, level = 'all' } = req.query;
    
    let logs = [...db.logs];
    
    if (level !== 'all') {
      logs = logs.filter(log => log.level === level);
    }
    
    logs = logs.slice(0, parseInt(limit));
    
    res.json({
      logs,
      total: db.logs.length,
      service: 'auth'
    });
    
  } catch (error) {
    console.error('Errore log auth:', error);
    res.status(500).json({ error: 'Errore recupero log' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-admin',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;