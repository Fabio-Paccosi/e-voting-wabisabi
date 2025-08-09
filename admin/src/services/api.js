// admin/src/services/api.js - Servizi API Completi

import axios from 'axios';

// ==========================================
// CONFIGURAZIONE AXIOS
// ==========================================
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';

// Crea istanza axios con configurazione base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere token di autenticazione
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Interceptor per gestire risposte e errori
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`[API] ❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`);
    
    // Gestisci errori di autenticazione
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin';
    }
    
    // Gestisci errori di rete
    if (!error.response) {
      throw new Error('Errore di connessione al server');
    }
    
    // Throw error con messaggio appropriato
    const message = error.response?.data?.error || 
                   error.response?.data?.message || 
                   `Errore ${error.response?.status}`;
    throw new Error(message);
  }
);

// ==========================================
// API DASHBOARD
// ==========================================
export const dashboardAPI = {
  // Statistiche generali
  async getStats() {
    const response = await apiClient.get('/api/admin/stats');
    return response.data;
  },

  // Stato sistema
  async getSystemStatus() {
    const response = await apiClient.get('/api/admin/system/status');
    return response.data;
  },

  // Attività recenti
  async getRecentActivity(limit = 50) {
    const response = await apiClient.get(`/api/admin/activity?limit=${limit}`);
    return response.data;
  },

  // Dati real-time
  async getRealTimeData() {
    const response = await apiClient.get('/api/admin/realtime');
    return response.data;
  },

  // Health check
  async healthCheck() {
    const response = await apiClient.get('/api/health');
    return response.data;
  }
};

// ==========================================
// API ELEZIONI
// ==========================================
export const electionsAPI = {
  // Lista elezioni
  async getElections(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/api/admin/elections?${queryString}`);
    return response.data;
  },

  // Dettaglio elezione
  async getElection(id) {
    const response = await apiClient.get(`/api/admin/elections/${id}`);
    return response.data;
  },

  // Crea elezione
  async createElection(data) {
    const response = await apiClient.post('/api/admin/elections', data);
    return response.data;
  },

  // Aggiorna elezione
  async updateElection(id, data) {
    const response = await apiClient.put(`/api/admin/elections/${id}`, data);
    return response.data;
  },

  // Elimina elezione
  async deleteElection(id) {
    const response = await apiClient.delete(`/api/admin/elections/${id}`);
    return response.data;
  },

  // Avvia elezione
  async startElection(id) {
    const response = await apiClient.post(`/api/admin/elections/${id}/start`);
    return response.data;
  },

  // Ferma elezione
  async stopElection(id) {
    const response = await apiClient.post(`/api/admin/elections/${id}/stop`);
    return response.data;
  },

  // Risultati elezione
  async getElectionResults(id) {
    const response = await apiClient.get(`/api/admin/elections/${id}/results`);
    return response.data;
  },

  // Statistiche elezione
  async getElectionStats(id) {
    const response = await apiClient.get(`/api/admin/elections/${id}/stats`);
    return response.data;
  }
};

// ==========================================
// API UTENTI
// ==========================================
export const usersAPI = {
  // Lista utenti con paginazione
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/api/admin/users?${queryString}`);
    return response.data;
  },

  // Dettaglio utente
  async getUser(id) {
    const response = await apiClient.get(`/api/admin/users/${id}`);
    return response.data;
  },

  // Aggiorna stato utente
  async updateUserStatus(id, status) {
    const response = await apiClient.patch(`/api/admin/users/${id}/status`, { status });
    return response.data;
  },

  // Elimina utente
  async deleteUser(id) {
    const response = await apiClient.delete(`/api/admin/users/${id}`);
    return response.data;
  },

  // Lista whitelist
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
    const response = await apiClient.delete(`/api/admin/whitelist/${encodeURIComponent(email)}`);
    return response.data;
  },

  // Statistiche registrazioni
  async getRegistrationStats() {
    const response = await apiClient.get('/api/admin/users/stats');
    return response.data;
  },

  // Esporta utenti
  async exportUsers(format = 'csv') {
    const response = await apiClient.get(`/api/admin/users/export?format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Reset password utente
  async resetUserPassword(id) {
    const response = await apiClient.post(`/api/admin/users/${id}/reset-password`);
    return response.data;
  },

  // Invia credenziali utente
  async sendUserCredentials(id) {
    const response = await apiClient.post(`/api/admin/users/${id}/send-credentials`);
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

  // Informazioni blocco
  async getBlockInfo(blockNumber) {
    const response = await apiClient.get(`/api/admin/blockchain/block/${blockNumber}`);
    return response.data;
  },

  // Transazioni recenti
  async getRecentTransactions(limit = 20) {
    const response = await apiClient.get(`/api/admin/blockchain/transactions?limit=${limit}`);
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

  // Elimina backup
  async deleteBackup(backupId) {
    const response = await apiClient.delete(`/api/admin/backups/${backupId}`);
    return response.data;
  },

  // Ripristina backup
  async restoreBackup(backupId) {
    const response = await apiClient.post(`/api/admin/backups/${backupId}/restore`);
    return response.data;
  },

  // Scarica backup
  async downloadBackup(backupId) {
    const response = await apiClient.get(`/api/admin/backups/${backupId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Log di sistema
  async getSystemLogs(level = 'all', limit = 100) {
    const response = await apiClient.get(`/api/admin/logs?level=${level}&limit=${limit}`);
    return response.data;
  },

  // Cancella log
  async clearLogs() {
    const response = await apiClient.delete('/api/admin/logs');
    return response.data;
  },

  // Metriche performance
  async getPerformanceMetrics() {
    const response = await apiClient.get('/api/admin/metrics/performance');
    return response.data;
  },

  // Statistiche utilizzo
  async getUsageStats(period = '24h') {
    const response = await apiClient.get(`/api/admin/metrics/usage?period=${period}`);
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
    try {
      await apiClient.post('/api/admin/auth/logout');
    } catch (error) {
      // Ignora errori durante logout
      console.warn('Errore durante logout:', error);
    }
  },

  // Verifica token
  async verifyToken() {
    const response = await apiClient.get('/api/admin/auth/verify');
    return response.data;
  },

  // Cambia password admin
  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.post('/api/admin/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Lista sessioni attive
  async getActiveSessions() {
    const response = await apiClient.get('/api/admin/auth/sessions');
    return response.data;
  },

  // Termina sessione specifica
  async terminateSession(sessionId) {
    const response = await apiClient.delete(`/api/admin/auth/sessions/${sessionId}`);
    return response.data;
  }
};

// ==========================================
// API NOTIFICHE
// ==========================================
export const notificationsAPI = {
  // Lista notifiche
  async getNotifications(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/api/admin/notifications?${queryString}`);
    return response.data;
  },

  // Segna come letta
  async markAsRead(notificationId) {
    const response = await apiClient.patch(`/api/admin/notifications/${notificationId}/read`);
    return response.data;
  },

  // Segna tutte come lette
  async markAllAsRead() {
    const response = await apiClient.patch('/api/admin/notifications/read-all');
    return response.data;
  },

  // Invia notifica
  async sendNotification(data) {
    const response = await apiClient.post('/api/admin/notifications', data);
    return response.data;
  },

  // Elimina notifica
  async deleteNotification(notificationId) {
    const response = await apiClient.delete(`/api/admin/notifications/${notificationId}`);
    return response.data;
  }
};

// ==========================================
// WEBSOCKET CONNECTION
// ==========================================
export class AdminWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.warn('[WS] No auth token available');
        return;
      }

      const wsUrl = `${WS_URL.replace('http', 'ws')}/ws/admin?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] ✅ Connected to admin WebSocket');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] 📨 Message received:', data.type);
          this.emit(data.type, data.payload);
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Connection closed:', event.code, event.reason);
        this.emit('disconnected');
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[WS] Max reconnection attempts reached');
      this.emit('reconnection_failed');
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WS] Cannot send message - not connected');
    }
  }
}

// Istanza globale WebSocket
export const adminWS = new AdminWebSocket();

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
export const apiUtils = {
  // Formatta errori per UI
  formatError(error) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'Si è verificato un errore sconosciuto';
  },

  // Download file da blob
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Formatta dimensione file
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Polling per operazioni asincrone
  async pollOperation(operationId, checkFn, interval = 1000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await checkFn(operationId);
        if (result.completed) {
          return result;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    throw new Error('Operation timeout');
  }
};

// ==========================================
// EXPORT DEFAULT
// ==========================================
export default {
  dashboardAPI,
  electionsAPI,
  usersAPI,
  systemAPI,
  authAPI,
  notificationsAPI,
  adminWS,
  apiUtils
};