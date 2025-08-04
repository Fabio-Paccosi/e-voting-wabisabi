# Script per configurare il dashboard amministratore del sistema E-Voting

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_msg() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo -e "${CYAN}🔧 SETUP DASHBOARD AMMINISTRATORE E-VOTING${NC}"
echo "=========================================================="
echo ""

# Verifica prerequisiti
print_info "Verifica prerequisiti..."

# Verifica Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js non trovato. Installa Node.js v18+ per continuare."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Versione Node.js troppo vecchia ($NODE_VERSION). Richiesta v16+."
    exit 1
fi

print_msg "Node.js $(node --version) trovato"

# Verifica Docker
if ! command -v docker &> /dev/null; then
    print_warning "Docker non trovato. Alcune funzionalità potrebbero non funzionare."
else
    print_msg "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) trovato"
fi

# Crea struttura directory admin
print_info "Creazione struttura directory admin..."

mkdir -p admin-dashboard/{src,public,build}
mkdir -p admin-dashboard/src/{components,services,utils}
mkdir -p admin-logs
mkdir -p admin-config

print_msg "Directory create"

# Crea package.json per admin dashboard
print_info "Creazione configurazione admin dashboard..."

cat > admin-dashboard/package.json << 'EOF'
{
  "name": "evoting-admin-dashboard",
  "version": "1.0.0",
  "description": "Dashboard amministratore per Sistema E-Voting WabiSabi",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "lucide-react": "^0.263.1",
    "axios": "^1.6.0",
    "react-router-dom": "^6.8.0",
    "tailwindcss": "^3.3.0",
    "@tailwindcss/forms": "^0.5.3"
  },
  "scripts": {
    "start": "BROWSER=none PORT=3006 react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
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
  },
  "proxy": "http://localhost:3001"
}
EOF

# Crea configurazione Tailwind per admin
cat > admin-dashboard/tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          primary: '#3B82F6',
          secondary: '#6366F1',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
EOF

# Crea index.html per admin
cat > admin-dashboard/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Dashboard Amministratore E-Voting WabiSabi" />
    <title>Admin Dashboard - E-Voting WabiSabi</title>
  </head>
  <body>
    <noscript>È necessario abilitare JavaScript per utilizzare questa applicazione.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

# Crea servizio API per admin dashboard
cat > admin-dashboard/src/services/adminApi.js << 'EOF'
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
EOF

# Crea configurazione per variabili d'ambiente admin
cat > admin-config/admin.env << 'EOF'
# Configurazione Dashboard Amministratore E-Voting

# Credenziali Admin (CAMBIARE IN PRODUZIONE!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=your-super-secret-admin-jwt-key-change-in-production

# URLs dei servizi
API_GATEWAY_URL=http://localhost:3001
AUTH_SERVICE_URL=http://localhost:3002
VOTE_SERVICE_URL=http://localhost:3003

# Configurazione dashboard
ADMIN_DASHBOARD_PORT=3006
AUTO_SYNC_WHITELIST=true
ADMIN_SESSION_TIMEOUT=28800  # 8 ore in secondi

# Rate limiting admin
ADMIN_RATE_LIMIT_WINDOW=900000  # 15 minuti
ADMIN_RATE_LIMIT_MAX=100        # 100 richieste per finestra

# Logging
ADMIN_LOG_LEVEL=info
ADMIN_LOG_FILE=admin-logs/admin.log

# Sicurezza
ADMIN_CORS_ORIGINS=http://localhost:3000,http://localhost:3006
ADMIN_SECURE_COOKIES=false  # true in produzione con HTTPS

# Database (se diverso dal principale)
ADMIN_DB_HOST=localhost
ADMIN_DB_PORT=5432
ADMIN_DB_NAME=evoting_admin
ADMIN_DB_USER=postgres
ADMIN_DB_PASS=password
EOF

# Crea Docker Compose per ambiente admin
cat > docker-compose.admin.yml << 'EOF'
version: '3.8'

services:
  admin-dashboard:
    build:
      context: ./admin-dashboard
      dockerfile: Dockerfile
    ports:
      - "3006:3006"
    environment:
      - NODE_ENV=development
      - REACT_APP_API_URL=http://localhost:3001/api/admin
    volumes:
      - ./admin-dashboard/src:/app/src
      - ./admin-dashboard/public:/app/public
    depends_on:
      - api-gateway
    networks:
      - evoting-network

  admin-nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./admin-config/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./admin-dashboard/build:/usr/share/nginx/html
    depends_on:
      - admin-dashboard
    networks:
      - evoting-network

networks:
  evoting-network:
    external: true
EOF

# Crea Dockerfile per admin dashboard
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

# Configurazione nginx personalizzata
COPY nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

# Crea configurazione nginx per admin
cat > admin-config/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Admin dashboard SPA
        location / {
            try_files $uri $uri/ /index.html;
            expires 1h;
            add_header Cache-Control "public, no-transform";
        }

        # Static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API proxy
        location /api/ {
            proxy_pass http://api-gateway:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Crea script di inizializzazione admin
cat > init-admin.js << 'EOF'
// Script di inizializzazione per il dashboard amministratore
const { adminDb } = require('./admin-routes');
const crypto = require('crypto');

function initializeAdminSystem() {
  console.log('🚀 Inizializzazione sistema amministratore...');

  // Crea utenti admin di default se non esistono
  if (adminDb.whitelist.size === 0) {
    console.log('📝 Creazione whitelist di default...');
    
    const defaultUsers = [
      {
        email: 'admin@evoting.local',
        taxCode: 'ADMINTEST001234',
        firstName: 'Admin',
        lastName: 'Sistema',
        status: 'active'
      },
      {
        email: 'test@example.com',
        taxCode: 'RSSMRA85M01H501Z',
        firstName: 'Test',
        lastName: 'User',
        status: 'active'
      }
    ];

    defaultUsers.forEach((user, index) => {
      const userData = {
        id: (index + 1).toString(),
        ...user,
        isAuthorized: true,
        authorizationProof: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      adminDb.whitelist.set(user.email, userData);
    });

    console.log(`✅ ${defaultUsers.length} utenti aggiunti alla whitelist`);
  }

  // Crea elezione di test se non esiste
  if (adminDb.elections.size === 0) {
    console.log('🗳️ Creazione elezione di test...');
    
    const testElection = {
      id: '1',
      title: 'Elezione Test 2025',
      description: 'Elezione di test per validare il sistema',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      totalVotes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    adminDb.elections.set('1', testElection);
    console.log('✅ Elezione di test creata');
  }

  console.log('🎉 Inizializzazione completata!');
  console.log('');
  console.log('📊 Stato del sistema:');
  console.log(`   - Elezioni: ${adminDb.elections.size}`);
  console.log(`   - Candidati: ${adminDb.candidates.size}`);
  console.log(`   - Utenti whitelist: ${adminDb.whitelist.size}`);
  console.log('');
  console.log('🌐 Accesso admin dashboard:');
  console.log('   - URL: http://localhost:3006');
  console.log('   - Username: admin');
  console.log('   - Password: admin123');
}

// Esegui se chiamato direttamente
if (require.main === module) {
  initializeAdminSystem();
}

module.exports = { initializeAdminSystem };
EOF

# Crea script di avvio completo
cat > start-admin.sh << 'EOF'
#!/bin/bash
# Script per avviare il dashboard amministratore

echo "🚀 Avvio Dashboard Amministratore E-Voting..."

# Verifica se il sistema principale è in esecuzione
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "⚠️ Sistema principale non in esecuzione. Avvio..."
    docker compose up -d
    echo "⏳ Attesa avvio servizi..."
    sleep 10
fi

# Avvia admin dashboard in modalità sviluppo
if [ "$1" = "dev" ]; then
    echo "🔧 Modalità sviluppo..."
    cd admin-dashboard
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
    docker compose -f docker-compose.yml -f docker-compose.admin.yml up -d
    
    echo "✅ Dashboard admin avviato!"
    echo "📊 Accesso: http://localhost:8080"
fi
EOF

# Crea script di test admin
cat > test-admin.sh << 'EOF'
#!/bin/bash
# Script per testare il dashboard amministratore

echo "🧪 Test Dashboard Amministratore..."

# Verifica servizi attivi
echo "1. Verifica servizi base..."
curl -s http://localhost:3001/api/health || echo "❌ API Gateway non raggiungibile"
curl -s http://localhost:3002/api/health || echo "❌ Auth Service non raggiungibile"
curl -s http://localhost:3003/api/health || echo "❌ Vote Service non raggiungibile"

# Test login admin
echo "2. Test login amministratore..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
    echo "✅ Login admin funzionante"
    
    # Estrai token
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    # Test statistiche
    echo "3. Test recupero statistiche..."
    STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3001/api/admin/stats)
    
    if echo "$STATS_RESPONSE" | grep -q "totalElections"; then
        echo "✅ Statistiche recuperate correttamente"
    else
        echo "❌ Errore recupero statistiche"
    fi
    
    # Test whitelist
    echo "4. Test gestione whitelist..."
    WHITELIST_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3001/api/admin/whitelist)
    
    if echo "$WHITELIST_RESPONSE" | grep -q "whitelist"; then
        echo "✅ Whitelist accessibile"
    else
        echo "❌ Errore accesso whitelist"
    fi
    
else
    echo "❌ Login admin fallito"
fi

echo "🏁 Test completati!"
EOF

# Rendi eseguibili gli script
chmod +x start-admin.sh
chmod +x test-admin.sh

print_msg "Configurazione admin completata!"

echo ""
echo "================================================"
echo "🎯 PROSSIMI PASSI:"
echo "================================================"
echo ""
echo "1. 📦 Installa dipendenze admin dashboard:"
echo "   cd admin-dashboard && npm install"
echo ""
echo "2. 🚀 Avvia il dashboard (modalità sviluppo):"
echo "   ./start-admin.sh dev"
echo ""
echo "3. 🌐 Accedi al dashboard admin:"
echo "   URL: http://localhost:3006"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "4. 🧪 Testa il sistema:"
echo "   ./test-admin.sh"
echo ""
echo "================================================"
echo "⚙️ CONFIGURAZIONE:"
echo "================================================"
echo ""
echo "• File configurazione: admin-config/admin.env"
echo "• Logs admin: admin-logs/"
echo "• Dashboard port: 3006 (dev) / 8080 (prod)"
echo ""
echo "🔐 SICUREZZA:"
echo "- Cambia le credenziali admin di default!"
echo "- Configura HTTPS in produzione"
echo "- Aggiorna le variabili d'ambiente"
echo ""
print_msg "Setup amministratore completato! 🎉"