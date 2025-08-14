import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    taxCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/elections');
    }
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value.toUpperCase() // Tax code in uppercase
    }));
    setError('');
  };

  const validateTaxCode = (taxCode) => {
    // Italian tax code validation (basic)
    const taxCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    return taxCodeRegex.test(taxCode);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.email || !formData.taxCode) {
      setError('Tutti i campi sono obbligatori');
      setLoading(false);
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Inserisci un indirizzo email valido');
      setLoading(false);
      return;
    }

    if (!validateTaxCode(formData.taxCode)) {
      setError('Inserisci un codice fiscale valido (16 caratteri)');
      setLoading(false);
      return;
    }

    try {
      // Attempt login
      const result = await login(formData.email, formData.taxCode);
      
      if (result.success) {
        setSuccess('Accesso effettuato con successo!');
        setTimeout(() => {
          navigate('/elections');
        }, 1000);
      } else {
        setError(result.message || 'Credenziali non valide o utente non autorizzato');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <User size={48} />
          </div>
          <h2>Accesso Elettore</h2>
          <p>Inserisci le tue credenziali per accedere al sistema di voto</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">
              <User size={20} />
              Indirizzo Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="mario.rossi@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="taxCode">
              <Lock size={20} />
              Codice Fiscale
            </label>
            <input
              type="text"
              id="taxCode"
              name="taxCode"
              value={formData.taxCode}
              onChange={handleInputChange}
              placeholder="RSSMRA80A01H501X"
              maxLength="16"
              required
              disabled={loading}
            />
          </div>

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

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={20} className="spinning" />
                Accesso in corso...
              </>
            ) : (
              'Accedi al Sistema'
            )}
          </button>
        </form>

        <div className="login-info">
          <div className="info-section">
            <h3>🔒 Sicurezza e Privacy</h3>
            <ul>
              <li>Il tuo voto è completamente anonimo</li>
              <li>Utilizziamo crittografia avanzata</li>
              <li>I dati sono protetti su blockchain</li>
            </ul>
          </div>
          
          <div className="info-section">
            <h3>📋 Requisiti</h3>
            <ul>
              <li>Devi essere registrato nel sistema</li>
              <li>Il tuo account deve essere autorizzato</li>
              <li>Puoi votare solo una volta per elezione</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;