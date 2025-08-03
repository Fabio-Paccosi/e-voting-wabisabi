import React, { useState, useEffect } from 'react';
import './App.css';

// Configurazione API
const API_CONFIG = {
  AUTH_SERVICE_URL: 'http://localhost:3002',
  VOTE_SERVICE_URL: 'http://localhost:3003',
  API_GATEWAY_URL: 'http://localhost:3001'
};

// Service per chiamate API
const apiService = {
  async healthCheck(serviceUrl) {
    const response = await fetch(`${serviceUrl}/api/health`);
    return response.json();
  },
  
  async register(userData) {
    const response = await fetch(`${API_CONFIG.AUTH_SERVICE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  },
  
  async issueCredential(userId) {
    const response = await fetch(`${API_CONFIG.AUTH_SERVICE_URL}/api/credential/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return response.json();
  },
  
  async submitVote(voteData) {
    const response = await fetch(`${API_CONFIG.VOTE_SERVICE_URL}/api/vote/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voteData)
    });
    return response.json();
  }
};

function App() {
  const [healthStatus, setHealthStatus] = useState({});
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('register');

  useEffect(() => {
    checkHealthStatus();
  }, []);

  const checkHealthStatus = async () => {
    const services = {
      'auth-service': API_CONFIG.AUTH_SERVICE_URL,
      'vote-service': API_CONFIG.VOTE_SERVICE_URL,
      'api-gateway': API_CONFIG.API_GATEWAY_URL
    };
    
    const status = {};
    
    for (const [name, url] of Object.entries(services)) {
      try {
        await apiService.healthCheck(url);
        status[name] = 'online';
      } catch (error) {
        status[name] = 'offline';
      }
    }
    
    setHealthStatus(status);
  };

  const handleRegistration = async (userData) => {
    try {
      const result = await apiService.register(userData);
      console.log('Registrazione:', result);
      
      if (result.success) {
        alert('Registrazione completata!');
        setUser(result);
        setActiveTab('vote');
      } else {
        alert('Errore: ' + (result.error || 'Registrazione fallita'));
      }
    } catch (error) {
      console.error('Errore registrazione:', error);
      alert('Errore di connessione');
    }
  };

  const handleVoteSubmission = async (candidate) => {
    try {
      // Ottieni credenziale
      const credential = await apiService.issueCredential(user.userId);
      
      if (!credential.success) {
        alert('Errore ottenimento credenziale');
        return;
      }
      
      // Submetti voto
      const voteData = {
        commitment: Math.random().toString(16).substr(2, 64), // Simulato
        serialNumber: credential.credential.serialNumber,
        voteData: { candidate }
      };
      
      const result = await apiService.submitVote(voteData);
      
      if (result.success) {
        alert('Voto registrato con successo!');
        setActiveTab('results');
      } else {
        alert('Errore voto: ' + (result.error || 'Voto fallito'));
      }
    } catch (error) {
      console.error('Errore voto:', error);
      alert('Errore di connessione durante il voto');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🗳️ E-Voting WabiSabi</h1>
        <p>Sistema di Voto Elettronico Anonimo e Sicuro</p>
        
        <div className="health-status">
          <h3>Stato Servizi:</h3>
          {Object.entries(healthStatus).map(([service, status]) => (
            <span key={service} className={`status ${status}`}>
              {service}: {status === 'online' ? '✅' : '❌'}
            </span>
          ))}
          <button onClick={checkHealthStatus}>🔄</button>
        </div>
      </header>

      <main className="App-main">
        <div className="tabs">
          {['register', 'vote', 'results'].map(tab => (
            <button 
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'register' ? '👤 Registrazione' : 
               tab === 'vote' ? '🗳️ Voto' : '📊 Risultati'}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'register' && (
            <RegistrationForm onSubmit={handleRegistration} />
          )}
          
          {activeTab === 'vote' && (
            <VotingForm onSubmit={handleVoteSubmission} user={user} />
          )}
          
          {activeTab === 'results' && (
            <div className="results">
              <h2>Sistema Attivo</h2>
              <p>Voto anonimo completato con successo!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function RegistrationForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    taxCode: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Registrazione Elettore</h2>
      {['email', 'firstName', 'lastName', 'taxCode'].map(field => (
        <input
          key={field}
          type={field === 'email' ? 'email' : 'text'}
          placeholder={field === 'firstName' ? 'Nome' : 
                      field === 'lastName' ? 'Cognome' :
                      field === 'taxCode' ? 'Codice Fiscale' : 'Email'}
          value={formData[field]}
          onChange={(e) => setFormData({...formData, [field]: e.target.value})}
          required
        />
      ))}
      <button type="submit">Registrati</button>
    </form>
  );
}

function VotingForm({ onSubmit, user }) {
  const [selectedCandidate, setSelectedCandidate] = useState('');
  
  const candidates = ['Candidato A', 'Candidato B', 'Candidato C'];

  if (!user) {
    return <p>Registrati prima per poter votare</p>;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedCandidate) {
      onSubmit(selectedCandidate);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <h2>Voto Anonimo</h2>
      <p>Elettore: {user.firstName || 'Utente registrato'}</p>
      
      {candidates.map(candidate => (
        <label key={candidate} className="candidate">
          <input
            type="radio"
            name="candidate"
            value={candidate}
            checked={selectedCandidate === candidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
          />
          {candidate}
        </label>
      ))}
      
      <button type="submit" disabled={!selectedCandidate}>
        Vota Anonimamente
      </button>
    </form>
  );
}

export default App;
