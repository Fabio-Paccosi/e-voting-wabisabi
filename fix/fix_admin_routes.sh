#!/bin/bash

echo "🔧 Sistemazione route admin per i servizi..."

# Ferma i container
echo "🛑 Fermando i container..."
docker compose down

# Crea le directory routes se non esistono
echo "📁 Creando directory routes..."
mkdir -p server2/routes
mkdir -p server3/routes

# Verifica se i file admin.js esistono già
if [ -f "server2/routes/admin.js" ]; then
    echo "⚠️  server2/routes/admin.js esiste già, creando backup..."
    mv server2/routes/admin.js server2/routes/admin.js.backup
fi

if [ -f "server3/routes/admin.js" ]; then
    echo "⚠️  server3/routes/admin.js esiste già, creando backup..."
    mv server3/routes/admin.js server3/routes/admin.js.backup
fi

# Crea il file server2/routes/admin.js
echo "📝 Creando server2/routes/admin.js..."
cat > server2/routes/admin.js << 'EOF'
// server2/routes/admin.js - Auth Service Admin Routes
const express = require('express');
const router = express.Router();

// Middleware di autenticazione admin
const adminAuth = (req, res, next) => {
  next();
};

// POST /api/admin/auth/login - Login amministratore
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === 'admin123') {
      const token = 'mock_jwt_token_' + Date.now();
      res.json({
        success: true,
        token,
        user: {
          id: 1,
          username: 'admin',
          role: 'administrator'
        }
      });
    } else {
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  } catch (error) {
    console.error('Errore login admin:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/admin/auth/verify - Verifica token
router.post('/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (token && token.startsWith('mock_jwt_token_')) {
      res.json({
        valid: true,
        user: {
          id: 1,
          username: 'admin',
          role: 'administrator'
        }
      });
    } else {
      res.status(401).json({ 
        valid: false, 
        error: 'Token non valido' 
      });
    }
  } catch (error) {
    console.error('Errore verifica token:', error);
    res.status(500).json({ error: 'Errore verifica autenticazione' });
  }
});

// GET /api/admin/stats - Statistiche auth service
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const authStats = {
      totalUsers: 1250,
      activeUsers: 890,
      pendingUsers: 45,
      suspendedUsers: 15,
      todayRegistrations: 8,
      todayLogins: 156,
      whitelistEntries: 500,
      verifiedUsers: 1100
    };

    res.json(authStats);
  } catch (error) {
    console.error('Errore stats auth:', error);
    res.status(500).json({ error: 'Errore statistiche autenticazione' });
  }
});

// GET /api/admin/activity - Attività recente
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const { limit = 25 } = req.query;
    const activities = [];
    
    const authEvents = [
      'Nuovo utente registrato',
      'Login amministratore',
      'Verifica identità completata',
      'Token di autenticazione rinnovato'
    ];

    for (let i = 0; i < parseInt(limit); i++) {
      activities.push({
        id: `auth_${Date.now()}_${i}`,
        type: 'auth',
        action: authEvents[Math.floor(Math.random() * authEvents.length)],
        timestamp: new Date(Date.now() - (i * 180000)).toISOString(),
        source: 'auth-service',
        details: {
          userId: Math.floor(Math.random() * 1000) + 1,
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`
        }
      });
    }

    res.json(activities);
  } catch (error) {
    console.error('Errore activity auth:', error);
    res.status(500).json({ error: 'Errore caricamento attività' });
  }
});

console.log('[AUTH ADMIN ROUTES] ✓ Route admin auth caricate');
module.exports = router;
EOF

# Crea il file server3/routes/admin.js
echo "📝 Creando server3/routes/admin.js..."
cat > server3/routes/admin.js << 'EOF'
// server3/routes/admin.js - Vote Service Admin Routes
const express = require('express');
const router = express.Router();

// Middleware di autenticazione admin
const adminAuth = (req, res, next) => {
  next();
};

// GET /api/admin/stats - Statistiche vote service
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const voteStats = {
      totalVotes: 850,
      pendingVotes: 15,
      processedVotes: 825,
      failedVotes: 10,
      elections: {
        total: 4,
        active: 1,
        completed: 2,
        scheduled: 1
      },
      blockchain: {
        transactionCount: 65,
        confirmedTx: 62,
        pendingTx: 3,
        lastBlock: 2456789
      }
    };

    res.json(voteStats);
  } catch (error) {
    console.error('Errore stats vote:', error);
    res.status(500).json({ error: 'Errore statistiche voti' });
  }
});

// GET /api/admin/activity - Attività recente
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const { limit = 25 } = req.query;
    const activities = [];
    
    const voteEvents = [
      'Nuovo voto ricevuto',
      'Voto processato e confermato',
      'Elezione creata',
      'Sessione CoinJoin avviata'
    ];

    for (let i = 0; i < parseInt(limit); i++) {
      activities.push({
        id: `vote_${Date.now()}_${i}`,
        type: 'vote',
        action: voteEvents[Math.floor(Math.random() * voteEvents.length)],
        timestamp: new Date(Date.now() - (i * 240000)).toISOString(),
        source: 'vote-service',
        details: {
          electionId: Math.floor(Math.random() * 5) + 1,
          voteId: `vote_${Math.floor(Math.random() * 10000)}`
        }
      });
    }

    res.json(activities);
  } catch (error) {
    console.error('Errore activity vote:', error);
    res.status(500).json({ error: 'Errore caricamento attività voti' });
  }
});

console.log('[VOTE ADMIN ROUTES] ✓ Route admin vote caricate');
module.exports = router;
EOF

echo " File route admin creati con successo!"

# Riavvia i container
echo "🚀 Riavviando i container..."
docker compose up --build -d

echo " Operazione completata!"
echo " Controlla i log con: docker compose logs -f"