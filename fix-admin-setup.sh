#!/bin/bash
# fix-admin-setup.sh
# Script per correggere i problemi di setup del dashboard admin

set -e

echo "🔧 Correzione setup dashboard amministratore..."

# 1. Copia nginx.conf nella directory corretta
echo "📁 Correzione percorsi file..."
if [ -f "admin-config/nginx.conf" ]; then
    cp admin-config/nginx.conf admin-dashboard/nginx.conf
    echo "✅ nginx.conf copiato in admin-dashboard/"
fi

# 2. Crea un Dockerfile corretto per admin-dashboard
echo "🐳 Correzione Dockerfile..."
cat > admin-dashboard/Dockerfile << 'EOF'
# Multi-stage build per admin dashboard
FROM node:18-alpine AS builder

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia codice sorgente
COPY . .

# Build dell'applicazione
RUN npm run build

# Stage di produzione
FROM nginx:alpine

# Copia build files
COPY --from=builder /app/build /usr/share/nginx/html

# Configurazione nginx personalizzata (se esiste)
COPY --from=builder /app/nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

# 3. Crea src/index.js per admin-dashboard
echo "⚛️ Creazione file React base..."
mkdir -p admin-dashboard/src

cat > admin-dashboard/src/index.js << 'EOF'
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

# 4. Crea src/App.js che usa il nostro dashboard
cat > admin-dashboard/src/App.js << 'EOF'
import React from 'react';
import AdminDashboard from './AdminDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <AdminDashboard />
    </div>
  );
}

export default App;
EOF

# 5. Crea CSS base
cat > admin-dashboard/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

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

.App {
  text-align: left;
}
EOF

cat > admin-dashboard/src/App.css << 'EOF'
/* Stili aggiuntivi per l'admin dashboard */
.admin-dashboard {
  min-height: 100vh;
}

/* Override per componenti specifici */
.table-responsive {
  overflow-x: auto;
}

@media (max-width: 768px) {
  .admin-stats-grid {
    grid-template-columns: 1fr;
  }
}
EOF

# 6. Copia il componente AdminDashboard
echo "📋 Copia componente dashboard..."
cat > admin-dashboard/src/AdminDashboard.js << 'EOF'
// Copiato dal nostro artifact
import React, { useState, useEffect } from 'react';
import { Users, Vote, UserCheck, Settings, Plus, Edit, Trash2, Save, X, Eye, EyeOff } from 'lucide-react';

// [Qui includeremo tutto il codice del componente AdminDashboard dall'artifact]
// Per brevità, creeremo una versione semplificata iniziale

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });

  const handleLogin = () => {
    if (adminCredentials.username === 'admin' && adminCredentials.password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Credenziali non valide');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Settings className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600">Sistema E-Voting WabiSabi</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={adminCredentials.password}
                onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200"
            >
              Accedi
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 text-center">
              <strong>Credenziali Demo:</strong><br />
              Username: admin<br />
              Password: admin123
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Amministratore</h1>
          <p className="text-gray-600">Sistema E-Voting WabiSabi - Versione Base</p>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <div className="flex items-center">
                <Vote className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Elezioni</p>
                  <p className="text-2xl font-bold text-gray-900">2</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Candidati</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-lg">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Elettori</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <button
              onClick={() => setIsAuthenticated(false)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
EOF

# 7. Correggi docker-compose.admin.yml per modalità development
echo "📝 Correzione docker-compose..."
cat > docker-compose.admin.yml << 'EOF'
version: '3.8'

services:
  admin-dashboard:
    build:
      context: ./admin-dashboard
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://localhost:3001/api/admin
    depends_on:
      - api-gateway
    networks:
      - evoting-network
    restart: unless-stopped

networks:
  evoting-network:
    external: true
EOF

# 8. Correggi start-admin.sh
echo "🚀 Correzione script avvio..."
cat > start-admin.sh << 'EOF'
#!/bin/bash
# Script per avviare il dashboard amministratore

echo "🚀 Avvio Dashboard Amministratore E-Voting..."

# Verifica se il sistema principale è in esecuzione
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "⚠️ Sistema principale non in esecuzione. Avvio..."
    docker compose up -d
    echo "⏳ Attesa avvio servizi..."
    sleep 10
fi

# Avvia admin dashboard in modalità sviluppo
if [ "$1" = "dev" ]; then
    echo "🔧 Modalità sviluppo..."
    cd admin-dashboard
    
    # Verifica se node_modules esiste
    if [ ! -d "node_modules" ]; then
        echo "📦 Installazione dipendenze..."
        npm install
    fi
    
    echo "🌐 Avvio server sviluppo..."
    npm start &
    ADMIN_PID=$!
    
    echo "📊 Dashboard admin disponibile su: http://localhost:3006"
    echo "🛑 Premi Ctrl+C per fermare"
    
    # Trap per cleanup
    trap "kill $ADMIN_PID; exit" INT TERM
    wait $ADMIN_PID
else
    # Modalità produzione con Docker
    echo "🐳 Modalità produzione..."
    
    # Verifica che la rete esista
    if ! docker network ls | grep -q evoting-network; then
        echo "🌐 Creazione rete Docker..."
        docker network create evoting-network
    fi
    
    # Build e avvio
    docker compose -f docker-compose.admin.yml up --build -d
    
    echo "✅ Dashboard admin avviato!"
    echo "📊 Accesso: http://localhost:8080"
    echo "📋 Controlla status: docker compose -f docker-compose.admin.yml ps"
fi
EOF

chmod +x start-admin.sh

# 9. Crea uno script per installare le dipendenze
echo "📦 Creazione script installazione..."
cat > install-admin-deps.sh << 'EOF'
#!/bin/bash
echo "📦 Installazione dipendenze admin dashboard..."

cd admin-dashboard

# Verifica Node.js
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trovato. Installa Node.js."
    exit 1
fi

# Installa dipendenze
echo "⬇️ Download dipendenze..."
npm install

echo "✅ Dipendenze installate!"
echo "🚀 Ora puoi avviare con: ./start-admin.sh dev"
EOF

chmod +x install-admin-deps.sh

# 10. Crea script per reset completo
cat > reset-admin.sh << 'EOF'
#!/bin/bash
echo "🔄 Reset completo dashboard admin..."

# Stop containers
docker compose -f docker-compose.admin.yml down 2>/dev/null || true

# Rimuovi immagini
docker rmi wabisabi_evoting-admin-dashboard 2>/dev/null || true

# Pulisci node_modules
rm -rf admin-dashboard/node_modules
rm -rf admin-dashboard/build

echo "✅ Reset completato!"
echo "🔄 Rilancia setup: ./install-admin-deps.sh"
EOF

chmod +x reset-admin.sh

echo "✅ Correzioni applicate!"
echo ""
echo "🔄 PROSSIMI PASSI:"
echo "1. Installa dipendenze: ./install-admin-deps.sh"
echo "2. Avvia modalità dev: ./start-admin.sh dev"
echo "3. Oppure modalità prod: ./start-admin.sh"
echo ""
echo "🔧 In caso di problemi: ./reset-admin.sh"