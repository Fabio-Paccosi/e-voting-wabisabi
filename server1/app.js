// Server 1: API Gateway e WabiSabi Protocol Coordination

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurazione middleware di sicurezza
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Rate limiting per prevenire attacchi DDoS
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100, // massimo 100 richieste per IP
    message: 'Troppe richieste da questo IP, riprova più tardi'
});
app.use('/api/', limiter);

// Configurazione URL dei servizi
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const VOTE_SERVICE_URL = process.env.VOTE_SERVICE_URL || 'http://localhost:3003';

// Configurazione URL dei servizi Admin
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const http = require('http');
const AdminSocketServer = require('./websocket/admin-socket');

// Crea server HTTP
const server = http.createServer(app);

// Setup WebSocket
const adminSocket = new AdminSocketServer(server);

// Rendi disponibile globally per altri moduli
app.set('adminSocket', adminSocket);

// Avvia server
server.listen(PORT, () => {
  console.log(`[API Gateway] Server avviato sulla porta ${PORT}`);
  console.log(`[WebSocket] Admin socket server attivo`);
});

// Simulazione eventi per testing
if (process.env.NODE_ENV === 'development') {
  // Simula aggiornamenti statistiche ogni 30 secondi
  setInterval(() => {
    adminSocket.onStatsUpdate({
      totalElections: Math.floor(Math.random() * 10) + 5,
      totalVotes: Math.floor(Math.random() * 1000) + 500,
      activeUsers: Math.floor(Math.random() * 100) + 50,
      whitelistUsers: Math.floor(Math.random() * 200) + 100
    });
  }, 30000);

  // Simula nuovi voti ogni minuto
  setInterval(() => {
    adminSocket.onNewVote({
      electionId: 'election_001',
      totalVotes: Math.floor(Math.random() * 500) + 100,
      activeSessions: Math.floor(Math.random() * 10) + 1
    });
  }, 60000);
}

// ====================
// COORDINATOR SERVICE
// ====================
class CoordinatorService {
    constructor() {
        // Stato delle sessioni di voto
        this.votingSessions = new Map();
        this.pendingVotes = new Map();
        this.MIN_VOTES_FOR_COINJOIN = 5; // Minimo numero di voti per attivare CoinJoin
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuti timeout sessione
    }

    // Crea una nuova sessione di voto
    createVotingSession(electionId) {
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            electionId,
            status: 'active',
            startTime: new Date(),
            endTime: null,
            voteCount: 0,
            participants: new Set(),
            transactionIds: []
        };
        
        this.votingSessions.set(sessionId, session);
        
        // Imposta timeout automatico per la sessione
        setTimeout(() => {
            this.closeSession(sessionId);
        }, this.SESSION_TIMEOUT);
        
        return session;
    }

    // Registra un voto nella sessione corrente
    async registerVote(sessionId, voteData) {
        const session = this.votingSessions.get(sessionId);
        if (!session || session.status !== 'active') {
            throw new Error('Sessione di voto non valida o chiusa');
        }

        // Aggiungi il voto ai voti pendenti
        const voteId = uuidv4();
        this.pendingVotes.set(voteId, {
            ...voteData,
            sessionId,
            timestamp: new Date()
        });

        session.voteCount++;
        session.participants.add(voteData.userId);

        // Verifica se abbiamo raggiunto il numero minimo per CoinJoin
        if (session.voteCount >= this.MIN_VOTES_FOR_COINJOIN) {
            await this.triggerCoinJoin(sessionId);
        }

        return voteId;
    }

    // Attiva il processo CoinJoin quando ci sono abbastanza voti
    async triggerCoinJoin(sessionId) {
        try {
            const session = this.votingSessions.get(sessionId);
            const votesToProcess = [];

            // Raccogli tutti i voti pendenti per questa sessione
            for (const [voteId, vote] of this.pendingVotes) {
                if (vote.sessionId === sessionId) {
                    votesToProcess.push({ voteId, ...vote });
                }
            }

            // Invia i voti al servizio di elaborazione voti
            const response = await axios.post(`${VOTE_SERVICE_URL}/api/coinjoin/create`, {
                sessionId,
                votes: votesToProcess
            });

            if (response.data.success) {
                // Rimuovi i voti processati dai pendenti
                votesToProcess.forEach(vote => {
                    this.pendingVotes.delete(vote.voteId);
                });

                // Aggiungi la transazione alla sessione
                session.transactionIds.push(response.data.transactionId);
            }

            return response.data;
        } catch (error) {
            console.error('Errore nel trigger CoinJoin:', error);
            throw error;
        }
    }

    // Chiudi una sessione di voto
    async closeSession(sessionId) {
        const session = this.votingSessions.get(sessionId);
        if (!session) return;

        session.status = 'closed';
        session.endTime = new Date();

        // Processa eventuali voti rimanenti
        if (this.pendingVotes.size > 0) {
            await this.triggerCoinJoin(sessionId);
        }

        return session;
    }

    // Ottieni lo stato di una sessione
    getSessionStatus(sessionId) {
        const session = this.votingSessions.get(sessionId);
        if (!session) return null;

        return {
            id: session.id,
            status: session.status,
            voteCount: session.voteCount,
            participantCount: session.participants.size,
            transactionCount: session.transactionIds.length
        };
    }
}

const coordinator = new CoordinatorService();

// ====================
// API GATEWAY ROUTES
// ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'api-gateway',
        timestamp: new Date().toISOString()
    });
});

// Route per l'autenticazione - proxy verso Auth Service
app.post('/api/auth/register', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/register`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Errore registrazione:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Errore durante la registrazione'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/login`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Errore login:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Errore durante il login'
        });
    }
});

// Route per le credenziali - proxy verso Auth Service
app.post('/api/credentials/request', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/credentials/request`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Errore richiesta credenziali:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Errore nella richiesta credenziali'
        });
    }
});

// Route per la gestione delle sessioni di voto
app.post('/api/voting/session/create', async (req, res) => {
    try {
        const { electionId } = req.body;
        const session = coordinator.createVotingSession(electionId);
        res.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                startTime: session.startTime
            }
        });
    } catch (error) {
        console.error('Errore creazione sessione:', error);
        res.status(500).json({
            error: 'Errore nella creazione della sessione di voto'
        });
    }
});

app.get('/api/voting/session/:sessionId/status', (req, res) => {
    try {
        const status = coordinator.getSessionStatus(req.params.sessionId);
        if (!status) {
            return res.status(404).json({ error: 'Sessione non trovata' });
        }
        res.json({ success: true, status });
    } catch (error) {
        console.error('Errore status sessione:', error);
        res.status(500).json({ error: 'Errore nel recupero dello stato' });
    }
});

// Route per il submit del voto
app.post('/api/vote/submit', async (req, res) => {
    try {
        const { sessionId, credential, commitment, zkProof } = req.body;

        // Prima verifica le credenziali con il servizio Auth
        const authResponse = await axios.post(`${AUTH_SERVICE_URL}/api/credentials/verify`, {
            credential,
            serialNumber: credential.serialNumber
        });

        if (!authResponse.data.valid) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        // Poi inoltra il voto al servizio di elaborazione voti
        const voteResponse = await axios.post(`${VOTE_SERVICE_URL}/api/vote/process`, {
            commitment,
            zkProof,
            serialNumber: credential.serialNumber
        });

        // Registra il voto nel coordinatore
        const voteId = await coordinator.registerVote(sessionId, {
            userId: authResponse.data.userId,
            commitment,
            serialNumber: credential.serialNumber
        });

        res.json({
            success: true,
            voteId,
            message: 'Voto registrato con successo'
        });
    } catch (error) {
        console.error('Errore submit voto:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Errore durante la registrazione del voto'
        });
    }
});

// Route per chiudere una sessione di voto
app.post('/api/voting/session/:sessionId/close', async (req, res) => {
    try {
        const session = await coordinator.closeSession(req.params.sessionId);
        res.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                endTime: session.endTime,
                finalVoteCount: session.voteCount,
                transactionCount: session.transactionIds.length
            }
        });
    } catch (error) {
        console.error('Errore chiusura sessione:', error);
        res.status(500).json({ error: 'Errore nella chiusura della sessione' });
    }
});

// Route per verificare lo stato delle transazioni
app.get('/api/transaction/:txId/status', async (req, res) => {
    try {
        const response = await axios.get(`${VOTE_SERVICE_URL}/api/transaction/${req.params.txId}/status`);
        res.json(response.data);
    } catch (error) {
        console.error('Errore verifica transazione:', error);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Errore nella verifica della transazione'
        });
    }
});

// Middleware per gestione errori globale
app.use((err, req, res, next) => {
    console.error('Errore non gestito:', err);
    res.status(500).json({
        error: 'Si è verificato un errore interno del server',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Avvio del server
app.listen(PORT, () => {
    console.log(`Server 1 (API Gateway) in ascolto sulla porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;