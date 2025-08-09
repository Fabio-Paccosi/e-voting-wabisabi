const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class AdminSocketServer {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: ["http://localhost:3006", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    
    this.adminClients = new Map(); // Track admin connections
    this.setupNamespace();
  }

  setupNamespace() {
    // Namespace separato per admin
    const adminNamespace = this.io.of('/admin');
    
    // Middleware autenticazione
    adminNamespace.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Token richiesto'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
          return next(new Error('Accesso admin richiesto'));
        }

        socket.admin = decoded;
        next();
      } catch (error) {
        next(new Error('Token non valido'));
      }
    });

    adminNamespace.on('connection', (socket) => {
      console.log(`[WebSocket] Admin connesso: ${socket.admin.username}`);
      
      // Registra client admin
      this.adminClients.set(socket.id, {
        socket,
        admin: socket.admin,
        connectedAt: new Date()
      });

      // Invia stato iniziale
      this.sendInitialState(socket);

      // Gestisci eventi admin
      this.setupAdminEvents(socket);

      // Cleanup alla disconnessione
      socket.on('disconnect', () => {
        console.log(`[WebSocket] Admin disconnesso: ${socket.admin.username}`);
        this.adminClients.delete(socket.id);
      });
    });
  }

  setupAdminEvents(socket) {
    // Richiesta refresh statistiche
    socket.on('request-stats-update', async () => {
      try {
        const stats = await this.getLatestStats();
        socket.emit('stats-update', stats);
      } catch (error) {
        socket.emit('error', { message: 'Errore recupero statistiche' });
      }
    });

    // Richiesta stato sistema
    socket.on('request-system-status', async () => {
      try {
        const status = await this.getSystemStatus();
        socket.emit('system-status-update', status);
      } catch (error) {
        socket.emit('error', { message: 'Errore recupero stato sistema' });
      }
    });

    // Join room per elezione specifica
    socket.on('join-election', (electionId) => {
      socket.join(`election-${electionId}`);
      console.log(`[WebSocket] Admin joined election room: ${electionId}`);
    });

    // Leave room elezione
    socket.on('leave-election', (electionId) => {
      socket.leave(`election-${electionId}`);
      console.log(`[WebSocket] Admin left election room: ${electionId}`);
    });
  }

  async sendInitialState(socket) {
    try {
      const [stats, systemStatus] = await Promise.all([
        this.getLatestStats(),
        this.getSystemStatus()
      ]);

      socket.emit('initial-state', {
        stats,
        systemStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[WebSocket] Errore invio stato iniziale:', error);
    }
  }

  // Broadcast a tutti gli admin connessi
  broadcastToAdmins(event, data) {
    const adminNamespace = this.io.of('/admin');
    adminNamespace.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[WebSocket] Broadcast: ${event} to ${this.adminClients.size} admins`);
  }

  // Broadcast a room specifica
  broadcastToRoom(room, event, data) {
    const adminNamespace = this.io.of('/admin');
    adminNamespace.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[WebSocket] Broadcast: ${event} to room ${room}`);
  }

  // Eventi dal sistema per notificare admin
  onNewVote(voteData) {
    this.broadcastToAdmins('new-vote', {
      electionId: voteData.electionId,
      voteCount: voteData.totalVotes,
      activeSessions: voteData.activeSessions
    });

    // Notifica specifica alla room dell'elezione
    this.broadcastToRoom(`election-${voteData.electionId}`, 'election-vote-update', {
      newVote: true,
      totalVotes: voteData.totalVotes
    });
  }

  onUserRegistered(userData) {
    this.broadcastToAdmins('user-registered', {
      email: userData.email,
      firstName: userData.firstName,
      registeredAt: userData.registeredAt
    });
  }

  onElectionStatusChange(electionData) {
    this.broadcastToAdmins('election-status-change', {
      electionId: electionData.id,
      status: electionData.status,
      title: electionData.title
    });

    this.broadcastToRoom(`election-${electionData.id}`, 'election-status-update', {
      status: electionData.status
    });
  }

  onStatsUpdate(newStats) {
    this.broadcastToAdmins('stats-update', newStats);
  }

  onSystemAlert(alertData) {
    this.broadcastToAdmins('system-alert', {
      level: alertData.level,
      message: alertData.message,
      service: alertData.service
    });
  }

  // Helper methods per recuperare dati
  async getLatestStats() {
    // Qui dovresti chiamare i tuoi servizi per ottenere statistiche aggiornate
    // Per ora restituisco dati mock
    return {
      totalElections: Math.floor(Math.random() * 10) + 5,
      totalVotes: Math.floor(Math.random() * 1000) + 500,
      activeUsers: Math.floor(Math.random() * 100) + 50,
      whitelistUsers: Math.floor(Math.random() * 200) + 100
    };
  }

  async getSystemStatus() {
    return {
      services: [
        { name: 'auth-service', status: 'online', responseTime: Math.floor(Math.random() * 100) + 20 },
        { name: 'vote-service', status: 'online', responseTime: Math.floor(Math.random() * 100) + 30 }
      ],
      database: { status: 'healthy', responseTime: Math.floor(Math.random() * 50) + 10 },
      redis: { status: 'healthy', responseTime: Math.floor(Math.random() * 20) + 5 }
    };
  }

  // Metodi per statistiche server
  getConnectedAdmins() {
    return Array.from(this.adminClients.values()).map(client => ({
      username: client.admin.username,
      connectedAt: client.connectedAt
    }));
  }

  getConnectionCount() {
    return this.adminClients.size;
  }
}

module.exports = AdminSocketServer;