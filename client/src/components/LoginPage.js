import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, AlertCircle, CheckCircle, Loader, Eye, EyeOff, Mail } from 'lucide-react';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mostra messaggio se arrivato da logout automatico
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      setError('Sessione scaduta. Effettua nuovamente il login.');
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[LOGIN] Utente già autenticato, reindirizzando...');
      navigate('/elections');
    }
  }, [isAuthenticated, user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Pulisci errori quando l'utente inizia a digitare
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // Password deve essere almeno di 6 caratteri
    return password && password.length >= 6;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validazione client-side
    if (!formData.email || !formData.password) {
      setError('Email e password sono obbligatori');
      setLoading(false);
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Inserisci un indirizzo email valido');
      setLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('La password deve essere di almeno 6 caratteri');
      setLoading(false);
      return;
    }

    try {
      console.log('[LOGIN] Tentativo login per:', formData.email);
      
      // Attempt login
      const result = await login({
        email: formData.email.toLowerCase().trim(),
        password: formData.password
      });
      
      if (result.success) {
        setSuccess('Accesso effettuato con successo!');
        console.log('[LOGIN] ✅ Login riuscito, reindirizzando...');
        
        // Piccolo delay per mostrare il messaggio di successo
        setTimeout(() => {
          navigate('/elections');
        }, 1000);
      } else {
        console.log('[LOGIN] ❌ Login fallito:', result.message);
        setError(result.message || 'Credenziali non valide');
      }
    } catch (err) {
      console.error('[LOGIN] ❌ Errore imprevisto:', err);
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Funzione per demo - riempie credenziali di test
  const fillTestCredentials = () => {
    setFormData({
      email: 'testuser@example.com',
      password: 'testpass123'
    });
    setError('');
    setSuccess('');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <User size={48} />
          </div>
          <h1>Accesso al Sistema di Voto</h1>
          <p>Inserisci le tue credenziali per accedere alla piattaforma di voto elettronico sicuro</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Campo Email */}
          <div className="form-group">
            <label htmlFor="email">
              <Mail size={20} />
              Indirizzo Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="mario.rossi@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {/* Campo Password */}
          <div className="form-group">
            <label htmlFor="password">
              <Lock size={20} />
              Password
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Inserisci la tua password"
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={loading}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Messaggi di errore e successo */}
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <CheckCircle size={20} />
              {success}
            </div>
          )}

          {/* Bottone Submit */}
          <button 
            type="submit" 
            className="login-button"
            disabled={loading || !formData.email || !formData.password}
          >
            {loading ? (
              <>
                <Loader size={20} className="spinner" />
                Accesso in corso...
              </>
            ) : (
              <>
                <User size={20} />
                Accedi
              </>
            )}
          </button>
        </form>

        {/* Sezione informazioni 
        <div className="login-info">
          <div className="info-section">
            <h3>Sistema di Voto Sicuro</h3>
            <ul>
              <li>🔒 Autenticazione sicura con JWT</li>
              <li>🔐 Voto anonimo garantito dal protocollo WabiSabi</li>
              <li>⛓️ Registrazione immutabile su blockchain Bitcoin</li>
              <li>🛡️ Privacy e integrità del voto protette</li>
            </ul>
          </div>
        </div>
        */}

        {/* Footer */}
        <div className="login-footer">
          <p>
            <strong>Problemi di accesso?</strong><br />
            Contatta l'amministratore del sistema per assistenza.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;