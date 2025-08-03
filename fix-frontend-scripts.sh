#!/bin/bash
# Script per riparare e configurare correttamente il frontend

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔧 RIPARAZIONE FRONTEND E-VOTING WABISABI${NC}"
echo "=================================================================="
echo ""

# Verifica e analizza la cartella client esistente
if [ -d "client" ]; then
    echo -e "${BLUE}STEP 1: Analisi Frontend Esistente${NC}"
    echo "------------------------------------------------------------------"
    
    cd client
    echo -e "${GREEN}✅ Cartella client trovata${NC}"
    
    # Mostra struttura attuale
    echo -e "\n${YELLOW}📁 Struttura attuale:${NC}"
    ls -la | head -15
    
    # Analizza package.json se esiste
    if [ -f "package.json" ]; then
        echo -e "\n${YELLOW}📦 Analisi package.json esistente:${NC}"
        
        # Mostra contenuto package.json
        echo "Contenuto attuale:"
        cat package.json | head -20
        
        # Backup del package.json esistente
        echo -e "\n${YELLOW}📋 Backup package.json esistente...${NC}"
        cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)
        
        # Verifica se è un progetto React
        if grep -q "react" package.json 2>/dev/null; then
            echo -e "${GREEN}✅ Progetto React rilevato${NC}"
            PROJECT_TYPE="react"
        elif grep -q "vue" package.json 2>/dev/null; then
            echo -e "${GREEN}✅ Progetto Vue rilevato${NC}"
            PROJECT_TYPE="vue"
        elif grep -q "angular" package.json 2>/dev/null; then
            echo -e "${GREEN}✅ Progetto Angular rilevato${NC}"
            PROJECT_TYPE="angular"
        else
            echo -e "${YELLOW}⚠️ Tipo progetto non riconosciuto${NC}"
            PROJECT_TYPE="unknown"
        fi
    else
        echo -e "${RED}❌ package.json non trovato${NC}"
        PROJECT_TYPE="none"
    fi
    
    echo -e "\n${BLUE}STEP 2: Configurazione Package.json${NC}"
    echo "------------------------------------------------------------------"
    
    # Crea/aggiorna package.json appropriato
    case $PROJECT_TYPE in
        "react")
            echo -e "${YELLOW}🔧 Configurazione progetto React esistente...${NC}"
            
            # Aggiorna package.json per React
            cat > package.json << 'EOF'
{
  "name": "evoting-wabisabi-frontend",
  "version": "1.0.0",
  "description": "Frontend per sistema E-Voting WabiSabi",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1",
    "axios": "^1.4.0",
    "crypto-browserify": "^3.12.0",
    "buffer": "^6.0.3",
    "stream-browserify": "^3.0.0",
    "process": "^0.11.10",
    "react-router-dom": "^6.14.1",
    "styled-components": "^6.0.7",
    "react-hook-form": "^7.45.2",
    "web3": "^4.0.3",
    "bitcoinjs-lib": "^6.1.3",
    "elliptic": "^6.5.4"
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",
    "webpack": "^5.88.1"
  },
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test",
    "eject": "react-scripts eject",
    "dev": "craco start"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
            ;;
            
        "vue")
            echo -e "${YELLOW}🔧 Configurazione progetto Vue esistente...${NC}"
            
            cat > package.json << 'EOF'
{
  "name": "evoting-wabisabi-frontend",
  "version": "1.0.0",
  "description": "Frontend per sistema E-Voting WabiSabi",
  "scripts": {
    "start": "vue-cli-service serve",
    "dev": "vue-cli-service serve",
    "build": "vue-cli-service build",
    "serve": "vue-cli-service serve"
  },
  "dependencies": {
    "vue": "^3.3.4",
    "vue-router": "^4.2.4",
    "axios": "^1.4.0",
    "crypto-browserify": "^3.12.0",
    "buffer": "^6.0.3"
  },
  "devDependencies": {
    "@vue/cli-service": "^5.0.8"
  }
}
EOF
            ;;
            
        *)
            echo -e "${YELLOW}🔧 Creazione progetto React nuovo...${NC}"
            
            # Crea package.json standard per React
            cat > package.json << 'EOF'
{
  "name": "evoting-wabisabi-frontend",
  "version": "1.0.0",
  "description": "Frontend per sistema E-Voting WabiSabi",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1",
    "axios": "^1.4.0",
    "crypto-browserify": "^3.12.0",
    "buffer": "^6.0.3",
    "stream-browserify": "^3.0.0",
    "process": "^0.11.10",
    "react-router-dom": "^6.14.1",
    "styled-components": "^6.0.7",
    "react-hook-form": "^7.45.2",
    "bitcoinjs-lib": "^6.1.3",
    "elliptic": "^6.5.4"
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",
    "webpack": "^5.88.1"
  },
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test",
    "eject": "react-scripts eject",
    "dev": "craco start"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
            ;;
    esac
    
    echo -e "${GREEN}✅ package.json configurato${NC}"
    
    # Crea craco.config.js per gestire polyfills crypto
    echo -e "\n${YELLOW}⚙️ Configurazione Webpack polyfills...${NC}"
    
    cat > craco.config.js << 'EOF'
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Polyfills per Node.js modules nel browser
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer"),
        "process": require.resolve("process/browser"),
        "vm": false,
        "fs": false,
        "net": false,
        "tls": false
      };

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      return webpackConfig;
    },
  },
};
EOF
    
    echo -e "\n${BLUE}STEP 3: Struttura File React${NC}"
    echo "------------------------------------------------------------------"
    
    # Crea struttura directory se non esiste
    mkdir -p src/components src/pages src/services src/config src/utils public
    
    # Verifica e crea file essenziali se mancanti
    if [ ! -f "public/index.html" ]; then
        echo -e "${YELLOW}📄 Creazione public/index.html...${NC}"
        
        cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Sistema E-Voting WabiSabi - Voto Elettronico Anonimo e Sicuro" />
    <title>E-Voting WabiSabi</title>
  </head>
  <body>
    <noscript>È necessario abilitare JavaScript per utilizzare questa applicazione.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
    fi
    
    if [ ! -f "src/index.js" ]; then
        echo -e "${YELLOW}📄 Creazione src/index.js...${NC}"
        
        cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
    fi
    
    if [ ! -f "src/index.css" ]; then
        echo -e "${YELLOW}🎨 Creazione src/index.css...${NC}"
        
        cat > src/index.css << 'EOF'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}
EOF
    fi
    
    # Verifica se App.js esiste, se no lo crea
    if [ ! -f "src/App.js" ]; then
        echo -e "${YELLOW}📄 Creazione src/App.js...${NC}"
        
        # Crea App.js semplificato
        cat > src/App.js << 'EOF'
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
EOF
    fi
    
    if [ ! -f "src/App.css" ]; then
        echo -e "${YELLOW}🎨 Creazione src/App.css...${NC}"
        
        cat > src/App.css << 'EOF'
.App {
  text-align: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.App-header {
  padding: 20px;
  background: rgba(0,0,0,0.3);
}

.App-header h1 {
  margin: 0;
  font-size: 2.5rem;
}

.health-status {
  margin: 20px 0;
  display: flex;
  gap: 15px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.status {
  padding: 5px 10px;
  border-radius: 5px;
  font-weight: bold;
}

.status.online {
  background: rgba(0,255,0,0.3);
}

.status.offline {
  background: rgba(255,0,0,0.3);
}

.App-main {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  justify-content: center;
}

.tabs button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  background: rgba(255,255,255,0.2);
  color: white;
  cursor: pointer;
  font-size: 1rem;
}

.tabs button.active {
  background: rgba(255,255,255,0.4);
}

.tabs button:hover {
  background: rgba(255,255,255,0.3);
}

.form {
  background: rgba(255,255,255,0.1);
  padding: 30px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.form h2 {
  margin-top: 0;
}

.form input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: none;
  border-radius: 5px;
  background: rgba(255,255,255,0.9);
  color: #333;
  box-sizing: border-box;
}

.form button {
  width: 100%;
  padding: 15px;
  margin: 20px 0 0;
  border: none;
  border-radius: 5px;
  background: #4CAF50;
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
}

.form button:hover:not(:disabled) {
  background: #45a049;
}

.form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.candidate {
  display: block;
  padding: 10px;
  margin: 10px 0;
  background: rgba(255,255,255,0.1);
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
}

.candidate:hover {
  background: rgba(255,255,255,0.2);
}

.candidate input {
  margin-right: 10px;
  width: auto;
}

.results {
  background: rgba(255,255,255,0.1);
  padding: 30px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}
EOF
    fi
    
    echo -e "\n${BLUE}STEP 4: Installazione Dipendenze${NC}"
    echo "------------------------------------------------------------------"
    
    # Rimuovi node_modules esistenti per installazione pulita
    if [ -d "node_modules" ]; then
        echo -e "${YELLOW}🗑️ Rimozione node_modules esistenti...${NC}"
        rm -rf node_modules package-lock.json
    fi
    
    echo -e "${YELLOW}📦 Installazione dipendenze...${NC}"
    npm install
    
    echo -e "\n${GREEN}✅ Frontend riparato e configurato!${NC}"
    
    cd ..
else
    echo -e "${RED}❌ Cartella client non trovata${NC}"
    echo -e "${YELLOW}💡 Esegui prima: ./setup-frontend.sh${NC}"
    exit 1
fi

echo -e "\n${CYAN}🎉 RIPARAZIONE COMPLETATA!${NC}"
echo "=================================================================="
echo ""
echo -e "${GREEN}✅ Frontend pronto per l'uso${NC}"
echo ""
echo -e "${YELLOW}📋 Per avviare:${NC}"
echo "   cd client"
echo "   npm start"
echo ""
echo -e "${YELLOW}🌐 URL disponibili:${NC}"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo -e "${YELLOW}🔧 Script di avvio disponibili:${NC}"
echo "   npm start  # Server di sviluppo"
echo "   npm run build  # Build di produzione"
echo "   npm test   # Test suite"
echo ""
echo -e "${GREEN}🚀 Il frontend è ora compatibile con il backend E-Voting WabiSabi!${NC}"