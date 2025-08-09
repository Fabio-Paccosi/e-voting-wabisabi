// admin/src/services/api.js
import axios from 'axios';

// Configurazione base API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Crea istanza axios con configurazione comune
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor per gestire errori di autenticazione
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==========================================
// API DASHBOARD & STATISTICHE
// ==========================================
export const dashboardAPI = {
  // Statistiche generali sistema
  async getStats() {
    const response = await apiClient.get('/api/admin/stats');
    return response.data;
  },

  // Stato servizi sistema
  async getSystemStatus() {
    const response = await apiClient.get('/api/admin/system-status');
    return response.data;
  },

  // Grafici statistiche temporali
  async getChartsData(timeRange = '7d') {
    const response = await apiClient.get(`/api/admin/charts/${timeRange}`);
    return response.data;
  },

  // Log attività recente
  async getRecentLogs(limit = 10) {
    const response = await apiClient.get(`/api/admin/logs?limit=${limit}`);
    return response.data;
  }
};

// ==========================================
// API GESTIONE ELEZIONI
// ==========================================
export const electionsAPI = {
  // Lista tutte le elezioni
  async getElections(status = 'all') {
    const response = await apiClient.get(`/api/admin/elections?status=${status}`);
    return response.data;
  },

  // Dettagli elezione specifica
  async getElection(electionId) {
    const response = await apiClient.get(`/api/admin/elections/${electionId}`);
    return response.data;
  },

  // Crea nuova elezione
  async createElection(electionData) {
    const response = await apiClient.post('/api/admin/elections', electionData);
    return response.data;
  },

  // Aggiorna elezione
  async updateElection(electionId, electionData) {
    const response = await apiClient.put(`/api/admin/elections/${electionId}`, electionData);
    return response.data;
  },

  // Avvia elezione
  async startElection(electionId) {
    const response = await apiClient.post(`/api/admin/elections/${electionId}/start`);
    return response.data;
  },

  // Chiudi elezione
  async endElection(electionId) {
    const response = await apiClient.post(`/api/admin/elections/${electionId}/end`);
    return response.data;
  },

  // Risultati elezione
  async getResults(electionId) {
    const response = await apiClient.get(`/api/admin/elections/${electionId}/results`);
    return response.data;
  },

  // Statistiche voti in tempo reale
  async getVoteStats(electionId) {
    const response = await apiClient.get(`/api/admin/elections/${electionId}/vote-stats`);
    return response.data;
  }
};

// ==========================================
// API GESTIONE UTENTI
// ==========================================
export const usersAPI = {
  // Lista utenti registrati
  async getUsers(page = 1, limit = 50, status = 'all') {
    const response = await apiClient.get(`/api/admin/users?page=${page}&limit=${limit}&status=${status}`);
    return response.data;
  },

  // Dettagli utente specifico
  async getUser(userId) {
    const response = await apiClient.get(`/api/admin/users/${userId}`);
    return response.data;
  },

  // Aggiorna stato utente
  async updateUserStatus(userId, status) {
    const response = await apiClient.put(`/api/admin/users/${userId}/status`, { status });
    return response.data;
  },

  // Whitelist elettori
  async getWhitelist() {
    const response = await apiClient.get('/api/admin/whitelist');
    return response.data;
  },

  // Aggiungi alla whitelist
  async addToWhitelist(userData) {
    const response = await apiClient.post('/api/admin/whitelist', userData);
    return response.data;
  },

  // Rimuovi dalla whitelist
  async removeFromWhitelist(email) {
    const response = await apiClient.delete(`/api/admin/whitelist/${email}`);
    return response.data;
  },

  // Statistiche registrazioni
  async getRegistrationStats() {
    const response = await apiClient.get('/api/admin/users/stats');
    return response.data;
  }
};

// ==========================================
// API BLOCKCHAIN & SISTEMA
// ==========================================
export const systemAPI = {
  // Stato blockchain
  async getBlockchainStatus() {
    const response = await apiClient.get('/api/admin/blockchain/status');
    return response.data;
  },

  // Impostazioni sistema
  async getSettings() {
    const response = await apiClient.get('/api/admin/settings');
    return response.data;
  },

  // Aggiorna impostazioni
  async updateSettings(settings) {
    const response = await apiClient.put('/api/admin/settings', settings);
    return response.data;
  },

  // Backup database
  async createBackup() {
    const response = await apiClient.post('/api/admin/backup');
    return response.data;
  },

  // Lista backup
  async getBackups() {
    const response = await apiClient.get('/api/admin/backups');
    return response.data;
  },

  // Ripristina backup
  async restoreBackup(backupId) {
    const response = await apiClient.post(`/api/admin/backups/${backupId}/restore`);
    return response.data;
  },

  // Log di sistema
  async getSystemLogs(level = 'all', limit = 100) {
    const response = await apiClient.get(`/api/admin/logs?level=${level}&limit=${limit}`);
    return response.data;
  }
};

// ==========================================
// API AUTENTICAZIONE ADMIN
// ==========================================
export const authAPI = {
  // Login admin
  async login(credentials) {
    const response = await apiClient.post('/api/admin/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('adminToken', response.data.token);
    }
    return response.data;
  },

  // Logout admin
  async logout() {
    localStorage.removeItem('adminToken');
    await apiClient.post('/api/admin/auth/logout');
  },

  // Verifica token
  async verifyToken() {
    const response = await apiClient.get('/api/admin/auth/verify');
    return response.data;
  },

  // Cambio password
  async changePassword(oldPassword, newPassword) {
    const response = await apiClient.post('/api/admin/auth/change-password', {
      oldPassword,
      newPassword
    });
    return response.data;
  }
};

// ==========================================
// WEBSOCKET PER REAL-TIME UPDATES
// ==========================================
export class AdminWebSocket {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    // Connessione WebSocket per aggiornamenti real-time
    if (typeof io !== 'undefined') {
      this.socket = io(`${API_BASE_URL}/admin`, {
        auth: {
          token: localStorage.getItem('adminToken')
        }
      });

      this.socket.on('connect', () => {
        console.log('WebSocket Admin connesso');
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket Admin disconnesso');
      });

      // Eventi real-time
      this.socket.on('stats-update', (data) => {
        this.emit('stats-update', data);
      });

      this.socket.on('new-vote', (data) => {
        this.emit('new-vote', data);
      });

      this.socket.on('user-registered', (data) => {
        this.emit('user-registered', data);
      });

      this.socket.on('election-status-change', (data) => {
        this.emit('election-status-change', data);
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

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
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
}

// Istanza singleton WebSocket
export const adminWS = new AdminWebSocket();

export default {
  dashboardAPI,
  electionsAPI,
  usersAPI,
  systemAPI,
  authAPI,
  AdminWebSocket,
  adminWS
};