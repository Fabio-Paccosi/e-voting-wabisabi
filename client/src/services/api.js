import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag per evitare loop infiniti durante logout
let isRefreshing = false;

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log della richiesta per debug
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
      hasToken: !!token,
      headers: config.headers
    });
    
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Log della risposta riuscita
    console.log(`[API] ✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error(`[API] ❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Gestisci errori 401 (token scaduto/non valido)
    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true;
      
      console.log('[API] 🔄 Token non valido, effettuando logout...');
      
      // Rimuovi token e reindirizza al login
      localStorage.removeItem('authToken');
      delete api.defaults.headers.common['Authorization'];
      
      // Dispatch evento personalizzato per notificare il logout al AuthContext
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { reason: 'token_expired' }
      }));
      
      isRefreshing = false;
      
      // Reindirizza solo se non siamo già nella pagina di login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?reason=session_expired';
      }
    }
    
    // Gestisci errori di rete
    if (!error.response) {
      const networkError = new Error('Errore di connessione al server. Verifica la connessione internet.');
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    }
    
    // Aggiungi informazioni aggiuntive all'errore
    const enhancedError = new Error(
      error.response?.data?.error || 
      error.response?.data?.message || 
      `Errore HTTP ${error.response?.status}`
    );
    
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    enhancedError.originalError = error;
    
    return Promise.reject(enhancedError);
  }
);

// Funzioni helper per gestione token
export const authTokenUtils = {
  // Ottieni token dal localStorage
  getToken() {
    return localStorage.getItem('authToken');
  },
  
  // Salva token nel localStorage
  setToken(token) {
    if (token) {
      localStorage.setItem('authToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  },
  
  // Rimuovi token
  removeToken() {
    localStorage.removeItem('authToken');
    delete api.defaults.headers.common['Authorization'];
  },
  
  // Verifica se il token esiste
  hasToken() {
    return !!this.getToken();
  },
  
  // Decodifica token JWT (senza verifica - solo per leggere payload)
  decodeToken(token = null) {
    const tokenToUse = token || this.getToken();
    if (!tokenToUse) return null;
    
    try {
      const base64Url = tokenToUse.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('[API] Errore decodifica token:', error);
      return null;
    }
  },
  
  // Controlla se il token è scaduto
  isTokenExpired(token = null) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    return decoded.exp < Math.floor(Date.now() / 1000);
  }
};

// API specifiche per autenticazione
export const authAPI = {
  // Login utente
  async login(credentials) {
    try {
      console.log('[API] 🔐 Tentativo login...');
      const response = await api.post('/auth/login', credentials);
      
      if (response.data.success && response.data.token) {
        authTokenUtils.setToken(response.data.token);
        console.log('[API] ✅ Login riuscito');
        return response.data;
      } else {
        throw new Error('Risposta di login non valida');
      }
    } catch (error) {
      console.error('[API] ❌ Errore login:', error.message);
      throw error;
    }
  },
  
  // Verifica token
  async verifyToken() {
    try {
      const token = authTokenUtils.getToken();
      if (!token) {
        throw new Error('Nessun token trovato');
      }
      
      console.log('[API] 🔍 Verifica token...');
      const response = await api.post('/auth/verify', { token });
      
      if (response.data.valid) {
        console.log('[API] ✅ Token valido');
        return response.data.user;
      } else {
        throw new Error('Token non valido');
      }
    } catch (error) {
      console.error('[API] ❌ Errore verifica token:', error.message);
      authTokenUtils.removeToken();
      throw error;
    }
  },
  
  // Logout
  async logout() {
    try {
      // Opzionale: chiama endpoint di logout sul server
      // await api.post('/auth/logout');
      
      console.log('[API] 🚪 Logout...');
      authTokenUtils.removeToken();
      
    } catch (error) {
      console.error('[API] ⚠️ Errore durante logout:', error.message);
      // Rimuovi comunque il token locale
      authTokenUtils.removeToken();
    }
  }
};

// Esporta l'istanza axios principale
export default api;