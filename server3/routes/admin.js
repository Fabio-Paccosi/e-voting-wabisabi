const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Database fittizio per elezioni e voti (in produzione usare PostgreSQL)
const db = {
  elections: new Map(),
  votes: new Map(),
  results: new Map(),
  blockchain: {
    blocks: [],
    transactions: []
  },
  logs: [],
  stats: {
    votesPerDay: [],
    electionsCreated: []
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
    service: 'vote',
    metadata
  };
  
  db.logs.unshift(logEntry);
  
  // Mantieni solo gli ultimi 1000 log
  if (db.logs.length > 1000) {
    db.logs = db.logs.slice(0, 1000);
  }
  
  console.log(`[VOTE-ADMIN] ${level.toUpperCase()}: ${message}`);
  return logEntry;
};

// Helper per generare hash blockchain
const generateBlockHash = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// Helper per inizializzare dati demo
const initializeDemoData = () => {
  // Elezione demo
  const demoElection = {
    id: 'election_001',
    title: 'Elezione Sindaco 2025',
    description: 'Elezione per il sindaco della città',
    status: 'active',
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: 'candidate_1', name: 'Mario Rossi', party: 'Lista Civica' },
      { id: 'candidate_2', name: 'Anna Verde', party: 'Movimento Democratico' },
      { id: 'candidate_3', name: 'Luigi Bianchi', party: 'Partito Liberale' }
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin',
    settings: {
      allowMultipleVotes: false,
      requireVerification: true,
      anonymityLevel: 'high'
    }
  };
  
  db.elections.set(demoElection.id, demoElection);
  
  // Voti demo
  const demoVotes = [
    { 
      id: 'vote_001',
      electionId: 'election_001',
      candidateId: 'candidate_1',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      blockHash: generateBlockHash('vote_001'),
      isAnonymous: true
    },
    { 
      id: 'vote_002',
      electionId: 'election_001',
      candidateId: 'candidate_2',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      blockHash: generateBlockHash('vote_002'),
      isAnonymous: true
    },
    { 
      id: 'vote_003',
      electionId: 'election_001',
      candidateId: 'candidate_1',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      blockHash: generateBlockHash('vote_003'),
      isAnonymous: true
    },
    { 
      id: 'vote_004',
      electionId: 'election_001',
      candidateId: 'candidate_3',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      blockHash: generateBlockHash('vote_004'),
      isAnonymous: true
    }
  ];
  
  demoVotes.forEach(vote => {
    db.votes.set(vote.id, vote);
    
    // Aggiungi alla blockchain simulata
    db.blockchain.transactions.push({
      id: vote.id,
      type: 'vote',
      hash: vote.blockHash,
      timestamp: vote.timestamp,
      electionId: vote.electionId
    });
  });
  
  // Calcola risultati demo
  calculateElectionResults(demoElection.id);
  
  logActivity('system', 'Dati demo elezioni inizializzati', 'info', {
    elections: 1,
    votes: demoVotes.length
  });
};

// Helper per calcolare risultati elezione
const calculateElectionResults = (electionId) => {
  const election = db.elections.get(electionId);
  if (!election) return null;
  
  const electionVotes = Array.from(db.votes.values())
    .filter(vote => vote.electionId === electionId);
  
  const results = election.options.map(candidate => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    party: candidate.party,
    votes: electionVotes.filter(vote => vote.candidateId === candidate.id).length,
    percentage: 0
  }));
  
  const totalVotes = electionVotes.length;
  results.forEach(result => {
    result.percentage = totalVotes > 0 ? ((result.votes / totalVotes) * 100).toFixed(2) : 0;
  });
  
  const electionResult = {
    electionId,
    totalVotes,
    results: results.sort((a, b) => b.votes - a.votes),
    lastUpdated: new Date().toISOString()
  };
  
  db.results.set(electionId, electionResult);
  return electionResult;
};

// Inizializza dati demo all'avvio
initializeDemoData();

// ==========================================
// STATISTICHE ELEZIONI E VOTI
// ==========================================

// Statistiche generali
router.get('/stats', async (req, res) => {
  try {
    const totalElections = db.elections.size;
    const totalVotes = db.votes.size;
    
    const activeElections = Array.from(db.elections.values())
      .filter(election => election.status === 'active').length;
    
    const completedElections = Array.from(db.elections.values())
      .filter(election => election.status === 'completed').length;
    
    const today = new Date().toDateString();
    const todayVotes = Array.from(db.votes.values())
      .filter(vote => new Date(vote.timestamp).toDateString() === today).length;
    
    const lastHourVotes = Array.from(db.votes.values())
      .filter(vote => new Date(vote.timestamp) > new Date(Date.now() - 60 * 60 * 1000)).length;
    
    res.json({
      totalElections,
      totalVotes,
      activeElections,
      completedElections,
      todayVotes,
      lastHourVotes,
      blockchainTransactions: db.blockchain.transactions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore statistiche vote:', error);
    res.status(500).json({ error: 'Errore recupero statistiche' });
  }
});

// Grafici voti nel tempo
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
    
    const votesOverTime = [];
    const electionsOverTime = [];
    const votes = Array.from(db.votes.values());
    const elections = Array.from(db.elections.values());
    
    for (let time = startDate.getTime(); time <= now.getTime(); time += interval) {
      const periodStart = new Date(time);
      const periodEnd = new Date(time + interval);
      
      const voteCount = votes.filter(vote => {
        const voteDate = new Date(vote.timestamp);
        return voteDate >= periodStart && voteDate < periodEnd;
      }).length;
      
      const electionCount = elections.filter(election => {
        const electionDate = new Date(election.createdAt);
        return electionDate >= periodStart && electionDate < periodEnd;
      }).length;
      
      votesOverTime.push({
        date: periodStart.toISOString(),
        votes: voteCount
      });
      
      electionsOverTime.push({
        date: periodStart.toISOString(),
        elections: electionCount
      });
    }
    
    res.json({
      votesOverTime,
      electionsOverTime,
      timeRange,
      generated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Errore grafici vote:', error);
    res.status(500).json({ error: 'Errore generazione grafici' });
  }
});

// ==========================================
// GESTIONE ELEZIONI
// ==========================================

// Lista elezioni
router.get('/elections', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let elections = Array.from(db.elections.values());
    
    if (status !== 'all') {
      elections = elections.filter(election => election.status === status);
    }
    
    // Aggiungi statistiche per ogni elezione
    const electionsWithStats = elections.map(election => {
      const electionVotes = Array.from(db.votes.values())
        .filter(vote => vote.electionId === election.id);
      
      return {
        ...election,
        voteCount: electionVotes.length,
        lastVote: electionVotes.length > 0 
          ? Math.max(...electionVotes.map(v => new Date(v.timestamp).getTime()))
          : null
      };
    });
    
    // Ordina per data creazione (più recenti prima)
    electionsWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      elections: electionsWithStats,
      total: electionsWithStats.length
    });
    
  } catch (error) {
    console.error('Errore lista elezioni:', error);
    res.status(500).json({ error: 'Errore recupero elezioni' });
  }
});

// Dettagli elezione specifica
router.get('/elections/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    const electionVotes = Array.from(db.votes.values())
      .filter(vote => vote.electionId === electionId);
    
    const results = db.results.get(electionId) || calculateElectionResults(electionId);
    
    res.json({
      election,
      voteCount: electionVotes.length,
      results,
      recentVotes: electionVotes
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
        .map(vote => ({
          id: vote.id,
          timestamp: vote.timestamp,
          blockHash: vote.blockHash
        }))
    });
    
  } catch (error) {
    console.error('Errore dettagli elezione:', error);
    res.status(500).json({ error: 'Errore recupero dettagli elezione' });
  }
});

// Crea nuova elezione
router.post('/elections', async (req, res) => {
  try {
    const { title, description, options, startDate, endDate, settings } = req.body;
    
    if (!title || !options || options.length < 2) {
      return res.status(400).json({ 
        error: 'Titolo e almeno 2 opzioni richiesti' 
      });
    }
    
    const electionId = `election_${Date.now()}`;
    
    const election = {
      id: electionId,
      title,
      description: description || '',
      status: 'draft',
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      options: options.map((option, index) => ({
        id: `candidate_${electionId}_${index}`,
        name: option.name,
        party: option.party || '',
        description: option.description || ''
      })),
      createdAt: new Date().toISOString(),
      createdBy: 'admin', // In produzione usare req.admin.username
      settings: {
        allowMultipleVotes: false,
        requireVerification: true,
        anonymityLevel: 'high',
        ...settings
      }
    };
    
    db.elections.set(electionId, election);
    
    logActivity('election_created', `Nuova elezione creata: ${title}`, 'info', {
      electionId,
      optionsCount: options.length
    });
    
    res.status(201).json({
      success: true,
      election
    });
    
  } catch (error) {
    console.error('Errore creazione elezione:', error);
    res.status(500).json({ error: 'Errore creazione elezione' });
  }
});

// Aggiorna elezione
router.put('/elections/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    const updates = req.body;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    // Non permettere modifiche se l'elezione è attiva
    if (election.status === 'active') {
      return res.status(400).json({ 
        error: 'Impossibile modificare elezione attiva' 
      });
    }
    
    const updatedElection = {
      ...election,
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    db.elections.set(electionId, updatedElection);
    
    logActivity('election_updated', `Elezione ${electionId} aggiornata`, 'info', updates);
    
    res.json({
      success: true,
      election: updatedElection
    });
    
  } catch (error) {
    console.error('Errore aggiornamento elezione:', error);
    res.status(500).json({ error: 'Errore aggiornamento elezione' });
  }
});

// Avvia elezione
router.post('/elections/:electionId/start', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    if (election.status === 'active') {
      return res.status(400).json({ error: 'Elezione già attiva' });
    }
    
    election.status = 'active';
    election.actualStartDate = new Date().toISOString();
    
    db.elections.set(electionId, election);
    
    logActivity('election_started', `Elezione ${electionId} avviata`, 'info', {
      electionId,
      title: election.title
    });
    
    res.json({
      success: true,
      message: 'Elezione avviata',
      election
    });
    
  } catch (error) {
    console.error('Errore avvio elezione:', error);
    res.status(500).json({ error: 'Errore avvio elezione' });
  }
});

// Termina elezione
router.post('/elections/:electionId/end', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    if (election.status !== 'active') {
      return res.status(400).json({ error: 'Solo elezioni attive possono essere terminate' });
    }
    
    election.status = 'completed';
    election.actualEndDate = new Date().toISOString();
    
    db.elections.set(electionId, election);
    
    // Ricalcola risultati finali
    const finalResults = calculateElectionResults(electionId);
    
    logActivity('election_ended', `Elezione ${electionId} terminata`, 'info', {
      electionId,
      title: election.title,
      totalVotes: finalResults.totalVotes
    });
    
    res.json({
      success: true,
      message: 'Elezione terminata',
      election,
      finalResults
    });
    
  } catch (error) {
    console.error('Errore termine elezione:', error);
    res.status(500).json({ error: 'Errore termine elezione' });
  }
});

// Risultati elezione
router.get('/elections/:electionId/results', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    const results = calculateElectionResults(electionId);
    
    res.json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status
      },
      results
    });
    
  } catch (error) {
    console.error('Errore risultati elezione:', error);
    res.status(500).json({ error: 'Errore recupero risultati' });
  }
});

// Statistiche voti per elezione specifica
router.get('/elections/:electionId/vote-stats', async (req, res) => {
  try {
    const { electionId } = req.params;
    
    const election = db.elections.get(electionId);
    if (!election) {
      return res.status(404).json({ error: 'Elezione non trovata' });
    }
    
    const votes = Array.from(db.votes.values())
      .filter(vote => vote.electionId === electionId);
    
    // Voti per ora nelle ultime 24 ore
    const hourlyStats = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(Date.now() - i * 60 * 60 * 1000);
      const hourEnd = new Date(Date.now() - (i - 1) * 60 * 60 * 1000);
      
      const hourVotes = votes.filter(vote => {
        const voteTime = new Date(vote.timestamp);
        return voteTime >= hourStart && voteTime < hourEnd;
      }).length;
      
      hourlyStats.push({
        hour: hourStart.getHours(),
        votes: hourVotes,
        timestamp: hourStart.toISOString()
      });
    }
    
    res.json({
      electionId,
      totalVotes: votes.length,
      hourlyStats,
      lastVoteTime: votes.length > 0 
        ? Math.max(...votes.map(v => new Date(v.timestamp).getTime()))
        : null,
      averageVotesPerHour: votes.length / 24
    });
    
  } catch (error) {
    console.error('Errore statistiche voti elezione:', error);
    res.status(500).json({ error: 'Errore recupero statistiche voti' });
  }
});

// ==========================================
// BLOCKCHAIN E SISTEMA
// ==========================================

// Stato blockchain
router.get('/blockchain/status', async (req, res) => {
  try {
    const transactions = db.blockchain.transactions;
    const latestTransaction = transactions.length > 0 
      ? transactions[transactions.length - 1] 
      : null;
    
    res.json({
      status: 'healthy',
      totalTransactions: transactions.length,
      latestTransaction,
      blockHeight: Math.floor(transactions.length / 10) + 1, // Simula blocchi da 10 transazioni
      network: 'testnet',
      lastBlockTime: latestTransaction?.timestamp,
      pendingTransactions: 0
    });
    
  } catch (error) {
    console.error('Errore stato blockchain:', error);
    res.status(500).json({ error: 'Errore recupero stato blockchain' });
  }
});

// Log servizio vote
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
      service: 'vote'
    });
    
  } catch (error) {
    console.error('Errore log vote:', error);
    res.status(500).json({ error: 'Errore recupero log' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'vote-admin',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;