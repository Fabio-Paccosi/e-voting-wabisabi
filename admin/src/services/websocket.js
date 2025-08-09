import { io } from 'socket.io-client';

class AdminWebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionStatus = 'disconnected'; // disconnected, connecting, connected, error
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      console.warn('[WebSocket] Già connesso');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        reject(new Error('Token admin non trovato'));
        return;
      }

      this.connectionStatus = 'connecting';
      this.emit('connection-status-change', this.connectionStatus);

      this.socket = io('/admin', {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        autoConnect: true
      });

      // Eventi connessione
      this.socket.on('connect', () => {
        console.log('[WebSocket] Connesso al server admin');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.emit('connection-status-change', this.connectionStatus);
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[WebSocket] Disconnesso:', reason);
        this.connectionStatus = 'disconnected';
        this.emit('connection-status-change', this.connectionStatus);
        
        if (reason === 'io server disconnect') {
          // Server ha disconnesso, riconnetti manualmente
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('[WebSocket] Errore connessione:', error.message);
        this.connectionStatus = 'error';
        this.emit('connection-status-change', this.connectionStatus);
        
        if (error.message.includes('Token') || error.message.includes('Accesso')) {
          // Errore autenticazione
          localStorage.removeItem('adminToken');
          window.location.href = '/login';
          reject(error);
        } else {
          this.handleReconnect();
          reject(error);
        }
      });

      // Setup event listeners
      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Stati iniziali
    this.socket.on('initial-state', (data) => {
      console.log('[WebSocket] Stato iniziale ricevuto');
      this.emit('initial-state', data);
    });

    // Aggiornamenti statistiche
    this.socket.on('stats-update', (data) => {
      this.emit('stats-update', data);
    });

    // Nuovi voti
    this.socket.on('new-vote', (data) => {
      this.emit('new-vote', data);
    });

    // Nuove registrazioni
    this.socket.on('user-registered', (data) => {
      this.emit('user-registered', data);
    });

    // Cambio status elezione
    this.socket.on('election-status-change', (data) => {
      this.emit('election-status-change', data);
    });

    // Aggiornamenti sistema
    this.socket.on('system-status-update', (data) => {
      this.emit('system-status-update', data);
    });

    // Aggiornamenti elezione specifica
    this.socket.on('election-vote-update', (data) => {
      this.emit('election-vote-update', data);
    });

    this.socket.on('election-status-update', (data) => {
      this.emit('election-status-update', data);
    });

    // Avvisi sistema
    this.socket.on('system-alert', (data) => {
      this.emit('system-alert', data);
    });

    // Errori
    this.socket.on('error', (data) => {
      console.error('[WebSocket] Errore server:', data.message);
      this.emit('error', data);
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Limite tentativi riconnessione raggiunto');
      this.connectionStatus = 'error';
      this.emit('connection-status-change', this.connectionStatus);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`[WebSocket] Tentativo riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus = 'disconnected';
      this.emit('connection-status-change', this.connectionStatus);
    }
  }

  // Metodi per eventi specifici
  requestStatsUpdate() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('request-stats-update');
    }
  }

  requestSystemStatus() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('request-system-status');
    }
  }

  joinElection(electionId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-election', electionId);
    }
  }

  leaveElection(electionId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave-election', electionId);
    }
  }

  // Sistema eventi interno
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Errore callback evento ${event}:`, error);
        }
      });
    }
  }

  // Getter per stato
  isConnected() {
    return this.socket && this.socket.connected;
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }
}

// Istanza singleton
const adminWebSocket = new AdminWebSocketService();

export default adminWebSocket;