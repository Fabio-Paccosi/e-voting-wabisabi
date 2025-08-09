// server3/routes/admin.js - Vote Service Admin Routes
const express = require('express');
const router = express.Router();

// Middleware di autenticazione admin
const adminAuth = (req, res, next) => {
  // Per ora passa sempre - implementa la tua autenticazione
  next();
};

// GET /api/admin/stats - Statistiche voti
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Simula query al database per statistiche voti
    const voteStats = {
      totalVotes: 650,
      pendingVotes: 25,
      processedVotes: 625,
      failedVotes: 5,
      elections: {
        total: 3,
        active: 1,
        completed: 2,
        scheduled: 0
      },
      blockchain: {
        transactionCount: 45,
        confirmedTx: 42,
        pendingTx: 3,
        lastBlock: 2456789
      },
      coinjoin: {
        sessionsTotal: 15,
        sessionsActive: 2,
        sessionsCompleted: 13,
        averageParticipants: 8.5
      }
    };

    res.json(voteStats);
  } catch (error) {
    console.error('Errore stats vote:', error);
    res.status(500).json({ error: 'Errore statistiche voti' });
  }
});

// GET /api/admin/charts/7d - Dati grafici voti ultimi 7 giorni
router.get('/charts/7d', adminAuth, async (req, res) => {
  try {
    const chartData = [];
    
    // Genera dati per ultimi 7 giorni
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      chartData.push({
        date: date.toISOString().split('T')[0],
        votesReceived: Math.floor(Math.random() * 100) + 50,
        votesProcessed: Math.floor(Math.random() * 95) + 45,
        transactions: Math.floor(Math.random() * 10) + 5,
        coinjoinSessions: Math.floor(Math.random() * 3) + 1
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error('Errore charts vote:', error);
    res.status(500).json({ error: 'Errore dati grafici voti' });
  }
});

// GET /api/admin/elections - Lista elezioni
router.get('/elections', adminAuth, async (req, res) => {
  try {
    // Simula lista elezioni dal database
    const elections = [
      {
        id: 1,
        title: 'Elezioni Consiglio Comunale 2024',
        description: 'Elezione dei rappresentanti del consiglio comunale',
        status: 'completed',
        startDate: '2024-01-15T09:00:00Z',
        endDate: '2024-01-15T20:00:00Z',
        totalVotes: 450,
        eligibleVoters: 500,
        turnout: 90,
        candidates: ['Mario Rossi', 'Luigi Bianchi', 'Anna Verdi']
      },
      {
        id: 2,
        title: 'Referendum Infrastrutture',
        description: 'Referendum sulla costruzione della nuova biblioteca',
        status: 'active',
        startDate: '2024-02-01T08:00:00Z',
        endDate: '2024-02-01T22:00:00Z',
        totalVotes: 125,
        eligibleVoters: 800,
        turnout: 15.6,
        candidates: ['Sì', 'No']
      },
      {
        id: 3,
        title: 'Elezioni Universitarie',
        description: 'Elezione rappresentanti studenti',
        status: 'scheduled',
        startDate: '2024-03-15T10:00:00Z',
        endDate: '2024-03-15T18:00:00Z',
        totalVotes: 0,
        eligibleVoters: 1200,
        turnout: 0,
        candidates: ['Candidato A', 'Candidato B', 'Candidato C']
      }
    ];

    res.json(elections);
  } catch (error) {
    console.error('Errore lista elezioni:', error);
    res.status(500).json({ error: 'Errore recupero elezioni' });
  }
});

// GET /api/admin/blockchain/status - Stato blockchain
router.get('/blockchain/status', adminAuth, async (req, res) => {
  try {
    // Simula stato blockchain
    const blockchainStatus = {
      network: 'testnet',
      connected: true,
      blockHeight: 2456789,
      difficulty: '0x1a00ffff',
      hashRate: '45.2 TH/s',
      mempool: {
        size: 1524,
        fee: {
          fast: 15,
          normal: 8,
          slow: 3
        }
      },
      node: {
        version: '0.21.0',
        uptime: 3600000,
        peers: 8,
        storage: '250.5 GB'
      }
    };

    res.json(blockchainStatus);
  } catch (error) {
    console.error('Errore blockchain status:', error);
    res.status(500).json({ error: 'Errore stato blockchain' });
  }
});

// GET /api/admin/coinjoin/sessions - Sessioni CoinJoin attive
router.get('/coinjoin/sessions', adminAuth, async (req, res) => {
  try {
    // Simula sessioni CoinJoin
    const sessions = [
      {
        id: 'session_001',
        status: 'input_registration',
        participants: 6,
        maxParticipants: 10,
        denomination: 0.001,
        startTime: new Date(Date.now() - 300000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 600000).toISOString()
      },
      {
        id: 'session_002',
        status: 'output_registration',
        participants: 8,
        maxParticipants: 8,
        denomination: 0.01,
        startTime: new Date(Date.now() - 800000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 200000).toISOString()
      }
    ];

    res.json(sessions);
  } catch (error) {
    console.error('Errore sessioni coinjoin:', error);
    res.status(500).json({ error: 'Errore recupero sessioni CoinJoin' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'vote-service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

// Aggiungere al server3/app.js:
/*
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
*/