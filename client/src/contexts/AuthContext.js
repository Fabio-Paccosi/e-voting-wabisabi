import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, authTokenUtils } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Ascolta eventi di logout automatico
    window.addEventListener('auth:logout', handleAutoLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleAutoLogout);
    };
  }, []);

  const handleAutoLogout = (event) => {
    console.log('[AUTH] 🚪 Logout automatico:', event.detail?.reason);
    setUser(null);
    setIsAuthenticated(false);
  };

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      // Controlla se esiste un token
      const token = authTokenUtils.getToken();
      if (!token) {
        console.log('[AUTH] 📭 Nessun token trovato');
        return;
      }
      
      // Controlla se il token è scaduto
      if (authTokenUtils.isTokenExpired()) {
        console.log('[AUTH] ⏰ Token scaduto');
        authTokenUtils.removeToken();
        return;
      }
      
      console.log('[AUTH] 🔍 Verifica stato autenticazione...');
      
      // Verifica token con il server
      const userData = await authAPI.verifyToken();
      
      console.log('[AUTH] ✅ Utente autenticato:', userData.email);
      setUser(userData);
      setIsAuthenticated(true);
      
    } catch (err) {
      console.error('[AUTH] ❌ Verifica autenticazione fallita:', err.message);
      
      // Rimuovi token non valido
      authTokenUtils.removeToken();
      setUser(null);
      setIsAuthenticated(false);
      
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('[AUTH] 🔐 Tentativo login per:', credentials.email);
      
      // Valida input
      if (!credentials.email || !credentials.password) {
        return { 
          success: false, 
          message: 'Email e password sono richiesti' 
        };
      }
      
      // Effettua login
      const response = await authAPI.login(credentials);
      
      if (response.success && response.user) {
        console.log('[AUTH] ✅ Login riuscito per:', response.user.email);
        
        setUser(response.user);
        setIsAuthenticated(true);
        
        return { 
          success: true, 
          user: response.user,
          message: 'Login effettuato con successo'
        };
      } else {
        return { 
          success: false, 
          message: response.message || 'Errore durante il login' 
        };
      }
    } catch (err) {
      console.error('[AUTH] ❌ Errore login:', err.message);
      
      // Gestisci diversi tipi di errore
      let errorMessage = 'Errore di connessione';
      
      if (err.status === 401) {
        errorMessage = 'Credenziali non valide';
      } else if (err.status === 403) {
        errorMessage = 'Account non autorizzato per il voto';
      } else if (err.status === 400) {
        errorMessage = err.message || 'Dati non validi';
      } else if (err.isNetworkError) {
        errorMessage = 'Errore di connessione. Verifica la connessione internet.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return { 
        success: false, 
        message: errorMessage 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('[AUTH] 🚪 Logout in corso...');
      
      // Chiama API di logout
      await authAPI.logout();
      
      // Resetta stato locale
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('[AUTH] ✅ Logout completato');
      
    } catch (err) {
      console.error('[AUTH] ⚠️ Errore durante logout:', err.message);
      
      // Resetta comunque lo stato locale
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUserData = async () => {
    try {
      console.log('[AUTH] 🔄 Refresh dati utente...');
      
      const userData = await authAPI.verifyToken();
      setUser(userData);
      
      return userData;
    } catch (err) {
      console.error('[AUTH] ❌ Errore refresh dati utente:', err.message);
      
      // Se il refresh fallisce, probabilmente il token è scaduto
      await logout();
      throw err;
    }
  };

  // Funzione helper per controllare se l'utente ha un ruolo specifico
  const hasRole = (role) => {
    return user?.role === role;
  };

  // Funzione helper per controllare se l'utente è autorizzato
  const isAuthorized = () => {
    return user?.isAuthorized === true;
  };

  // Funzione helper per ottenere informazioni sul token
  const getTokenInfo = () => {
    const token = authTokenUtils.getToken();
    if (!token) return null;
    
    const decoded = authTokenUtils.decodeToken(token);
    return {
      ...decoded,
      isExpired: authTokenUtils.isTokenExpired(token),
      token
    };
  };

  const value = {
    // Stato
    user,
    loading,
    isAuthenticated,
    
    // Azioni
    login,
    logout,
    refreshUserData,
    
    // Helper
    hasRole,
    isAuthorized,
    getTokenInfo,
    
    // Per compatibilità con codice esistente
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};