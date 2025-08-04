// Servizio API per il dashboard amministratore
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/admin';

class AdminApiService {
  constructor() {
    this.token = localStorage.getItem('adminToken');
    
    // Configura axios con interceptors
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor per aggiungere token
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Response interceptor per gestire errori
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
          window.location.href = '/admin';
        }
        return Promise.reject(error);
      }
    );
  }

  // Autenticazione
  async login(credentials) {
    const response = await this.api.post('/auth/login', credentials);
    if (response.data.success) {
      this.token = response.data.token;
      localStorage.setItem('adminToken', this.token);
    }
    return response.data;
  }

  async logout() {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.token = null;
      localStorage.removeItem('adminToken');
    }
  }

  async verifyToken() {
    return await this.api.get('/auth/verify');
  }

  // Statistiche
  async getStats() {
    const response = await this.api.get('/stats');
    return response.data;
  }

  // Elezioni
  async getElections() {
    const response = await this.api.get('/elections');
    return response.data;
  }

  async getElection(id) {
    const response = await this.api.get(`/elections/${id}`);
    return response.data;
  }

  async createElection(electionData) {
    const response = await this.api.post('/elections', electionData);
    return response.data;
  }

  async updateElection(id, electionData) {
    const response = await this.api.put(`/elections/${id}`, electionData);
    return response.data;
  }

  async deleteElection(id) {
    const response = await this.api.delete(`/elections/${id}`);
    return response.data;
  }

  // Candidati
  async getCandidates(electionId = null) {
    const params = electionId ? { electionId } : {};
    const response = await this.api.get('/candidates', { params });
    return response.data;
  }

  async createCandidate(candidateData) {
    const response = await this.api.post('/candidates', candidateData);
    return response.data;
  }

  async updateCandidate(id, candidateData) {
    const response = await this.api.put(`/candidates/${id}`, candidateData);
    return response.data;
  }

  async deleteCandidate(id) {
    const response = await this.api.delete(`/candidates/${id}`);
    return response.data;  
  }

  // Whitelist
  async getWhitelist() {
    const response = await this.api.get('/whitelist');
    return response.data;
  }

  async addToWhitelist(userData) {
    const response = await this.api.post('/whitelist', userData);
    return response.data;
  }

  async updateWhitelistUser(id, userData) {
    const response = await this.api.put(`/whitelist/${id}`, userData);
    return response.data;
  }

  async removeFromWhitelist(id) {
    const response = await this.api.delete(`/whitelist/${id}`);
    return response.data;
  }

  async syncWhitelist() {
    const response = await this.api.post('/whitelist/sync');
    return response.data;
  }

  // Export
  async exportData(type = 'all') {
    const response = await this.api.get('/export', { 
      params: { type },
      responseType: 'blob'
    });
    return response;
  }
}

export default new AdminApiService();
