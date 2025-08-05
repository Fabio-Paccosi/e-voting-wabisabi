#!/bin/bash
# Script principale per avvio E-Voting WabiSabi

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_msg() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo -e "${BLUE}================================================"
echo "   E-Voting WabiSabi - Avvio Sistema"
echo -e "================================================${NC}"

MODE=${1:-development}

# Setup automatico con admin dashboard separato
auto_setup() {
    print_msg "Setup automatico file..."
    
    # Crea directory
    mkdir -p {server1,server2,server3,admin-dashboard,database/models,nginx/ssl,logs,backups}
    
    # Crea .env se mancante
    if [ ! -f .env ]; then
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "default-secret-key")
        cat > .env << EOF
NODE_ENV=${MODE}
DB_PASSWORD=SecurePass123!
DB_HOST=postgres
DB_NAME=evoting_wabisabi
DB_USER=postgres
REDIS_PASSWORD=RedisPass456!
JWT_SECRET=${JWT_SECRET}
BITCOIN_NETWORK=testnet
ADMIN_PORT=3006
EOF
        print_msg "✓ File .env creato"
    fi
    
    # Crea docker-compose.yml con admin dashboard separato
    if [ ! -f docker-compose.yml ]; then
        cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    container_name: evoting-postgres
    environment:
      POSTGRES_DB: evoting_wabisabi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - evoting-network

  redis:
    image: redis:7-alpine
    container_name: evoting-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    networks:
      - evoting-network

  api-gateway:
    build: ./server1
    container_name: evoting-gateway
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=${NODE_ENV}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    networks:
      - evoting-network

  auth-service:
    build: ./server2
    container_name: evoting-auth
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=${NODE_ENV}
      - DB_HOST=postgres
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
    networks:
      - evoting-network

  vote-service:
    build: ./server3
    container_name: evoting-vote
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=${NODE_ENV}
      - DB_HOST=postgres
    depends_on:
      - postgres
    networks:
      - evoting-network

  admin-dashboard:
    build: ./admin-dashboard
    container_name: evoting-admin
    ports:
      - "3006:3006"
    environment:
      - NODE_ENV=${NODE_ENV}
      - API_GATEWAY_URL=http://api-gateway:3001
      - AUTH_SERVICE_URL=http://auth-service:3002
    depends_on:
      - api-gateway
      - auth-service
    networks:
      - evoting-network

volumes:
  postgres_data:

networks:
  evoting-network:
    driver: bridge
EOF
        print_msg "✓ Docker compose creato con admin separato"
    fi
    
    # Crea admin dashboard se non esiste
    if [ ! -f "admin-dashboard/app.js" ]; then
        mkdir -p admin-dashboard
        
        cat > admin-dashboard/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'admin-dashboard',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Admin dashboard main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints per admin
app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalElections: 3,
        totalVotes: 156,
        activeUsers: 45,
        whitelistUsers: 12
    });
});

app.get('/api/admin/elections', (req, res) => {
    res.json([
        { id: 1, name: 'Elezioni Comunali 2024', status: 'active', votes: 89 },
        { id: 2, name: 'Referendum Locale', status: 'completed', votes: 67 }
    ]);
});

// Catch all - serve admin dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎛️ Admin Dashboard listening on port ${PORT}`);
    console.log(`📊 Access dashboard at: http://localhost:${PORT}`);
});

module.exports = app;
EOF

        cat > admin-dashboard/package.json << 'EOF'
{
  "name": "evoting-admin-dashboard",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

        cat > admin-dashboard/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 3006
CMD ["npm", "start"]
EOF

        # Crea interfaccia admin HTML semplice
        mkdir -p admin-dashboard/public
        cat > admin-dashboard/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - E-Voting WabiSabi</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
</head>
<body class="bg-gray-100">
    <div id="app">
        <nav class="bg-blue-600 text-white p-4">
            <div class="container mx-auto flex justify-between items-center">
                <h1 class="text-xl font-bold">🗳️ E-Voting Admin Dashboard</h1>
                <div class="text-sm">Porta: 3006</div>
            </div>
        </nav>
        
        <div class="container mx-auto mt-8 px-4">
            <!-- Statistiche -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Elezioni Totali</h3>
                    <p class="text-3xl font-bold text-blue-600" id="totalElections">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Voti Totali</h3>
                    <p class="text-3xl font-bold text-green-600" id="totalVotes">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Utenti Attivi</h3>
                    <p class="text-3xl font-bold text-yellow-600" id="activeUsers">-</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Whitelist</h3>
                    <p class="text-3xl font-bold text-purple-600" id="whitelistUsers">-</p>
                </div>
            </div>
            
            <!-- Status Servizi -->
            <div class="bg-white p-6 rounded-lg shadow mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">🔍 Status Servizi</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 border rounded-lg">
                        <div class="flex items-center justify-between">
                            <span>API Gateway</span>
                            <span id="gateway-status" class="px-2 py-1 rounded text-sm">Checking...</span>
                        </div>
                        <div class="text-sm text-gray-500">http://localhost:3001</div>
                    </div>
                    <div class="p-4 border rounded-lg">
                        <div class="flex items-center justify-between">
                            <span>Auth Service</span>
                            <span id="auth-status" class="px-2 py-1 rounded text-sm">Checking...</span>
                        </div>
                        <div class="text-sm text-gray-500">http://localhost:3002</div>
                    </div>
                    <div class="p-4 border rounded-lg">
                        <div class="flex items-center justify-between">
                            <span>Vote Service</span>
                            <span id="vote-status" class="px-2 py-1 rounded text-sm">Checking...</span>
                        </div>
                        <div class="text-sm text-gray-500">http://localhost:3003</div>
                    </div>
                </div>
            </div>
            
            <!-- Azioni rapide -->
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">⚡ Azioni Rapide</h3>
                <div class="flex flex-wrap gap-4">
                    <button onclick="testSystem()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Test Sistema
                    </button>
                    <button onclick="backupDb()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Backup Database
                    </button>
                    <button onclick="viewLogs()" class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                        Visualizza Logs
                    </button>
                    <button onclick="restartServices()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        Restart Servizi
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Carica statistiche
        async function loadStats() {
            try {
                const response = await axios.get('/api/admin/stats');
                const stats = response.data;
                
                document.getElementById('totalElections').textContent = stats.totalElections;
                document.getElementById('totalVotes').textContent = stats.totalVotes;
                document.getElementById('activeUsers').textContent = stats.activeUsers;
                document.getElementById('whitelistUsers').textContent = stats.whitelistUsers;
            } catch (error) {
                console.error('Errore caricamento statistiche:', error);
            }
        }
        
        // Verifica status servizi
        async function checkServices() {
            const services = [
                { id: 'gateway-status', url: 'http://localhost:3001/api/health' },
                { id: 'auth-status', url: 'http://localhost:3002/api/health' },
                { id: 'vote-status', url: 'http://localhost:3003/api/health' }
            ];
            
            for (const service of services) {
                try {
                    await axios.get(service.url);
                    document.getElementById(service.id).textContent = 'Online';
                    document.getElementById(service.id).className = 'px-2 py-1 rounded text-sm bg-green-100 text-green-800';
                } catch (error) {
                    document.getElementById(service.id).textContent = 'Offline';
                    document.getElementById(service.id).className = 'px-2 py-1 rounded text-sm bg-red-100 text-red-800';
                }
            }
        }
        
        // Funzioni azioni rapide
        function testSystem() {
            alert('Test sistema avviato! Controlla i logs per i risultati.');
        }
        
        function backupDb() {
            alert('Backup database avviato! Verrà salvato nella cartella backups/');
        }
        
        function viewLogs() {
            window.open('http://localhost:3001/logs', '_blank');
        }
        
        function restartServices() {
            if (confirm('Sei sicuro di voler riavviare i servizi?')) {
                alert('Riavvio servizi in corso...');
            }
        }
        
        // Inizializzazione
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            checkServices();
            
            // Aggiorna ogni 30 secondi
            setInterval(checkServices, 30000);
        });
    </script>
</body>
</html>
EOF
        
        print_msg "✓ Admin dashboard creato sulla porta 3006"
    fi
    
    # Crea app.js per altri server come prima...
    for i in {1..3}; do
        server="server$i"
        if [ ! -f "$server/app.js" ]; then
            mkdir -p "$server"
            cat > "$server/app.js" << EOF
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 300$i;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: '$server',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({ message: 'E-Voting WabiSabi - $server' });
});

app.listen(PORT, () => {
    console.log(\`$server listening on port \${PORT}\`);
});
EOF
            
            cat > "$server/package.json" << EOF
{
  "name": "$server",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  }
}
EOF
            
            cat > "$server/Dockerfile" << EOF
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 300$i
CMD ["npm", "start"]
EOF
            print_msg "✓ $server creato"
        fi
    done
}

# Controllo prerequisiti (come prima)
check_prerequisites() {
    print_msg "Controllo prerequisiti..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker non installato!"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose non installato!"
        exit 1
    fi
    
    print_msg "✓ Prerequisiti OK"
}

# Avvio sistema aggiornato
start_system() {
    print_msg "Avvio sistema Docker..."
    
    # Stop vecchi servizi
    docker compose down 2>/dev/null || true
    
    # Build e start
    print_msg "Build containers..."
    docker compose build
    
    print_msg "Avvio servizi..."
    docker compose up -d
    
    # Attesa avvio
    print_msg "Attesa avvio servizi (30 secondi)..."
    for i in {1..30}; do
        echo -n "."
        sleep 1
    done
    echo ""
    
    # Verifica stato
    docker compose ps
    
    # Test connettività
    print_msg "Test connettività..."
    sleep 5
    
    services_ok=true
    
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        print_msg "✓ API Gateway: OK"
    else
        print_warning "⚠ API Gateway: Non risponde ancora"
        services_ok=false
    fi
    
    if curl -s http://localhost:3002/api/health >/dev/null 2>&1; then
        print_msg "✓ Auth Service: OK"  
    else
        print_warning "⚠ Auth Service: Non risponde ancora"
        services_ok=false
    fi
    
    if curl -s http://localhost:3003/api/health >/dev/null 2>&1; then
        print_msg "✓ Vote Service: OK"
    else
        print_warning "⚠ Vote Service: Non risponde ancora"
        services_ok=false
    fi
    
    # Verifica admin dashboard se nella modalità admin
    if [ "$MODE" = "admin" ]; then
        sleep 5  # Attesa extra per admin
        if curl -s http://localhost:3006/api/health >/dev/null 2>&1; then
            print_msg "✓ Admin Dashboard: OK"
        else
            print_warning "⚠ Admin Dashboard: Non risponde ancora"
            services_ok=false
        fi
    fi
    
    print_msg "Sistema avviato! 🚀"
    echo ""
    echo "Accessi:"
    echo "- API Gateway: http://localhost:3001"
    echo "- Auth Service: http://localhost:3002"  
    echo "- Vote Service: http://localhost:3003"
    
    if [ "$MODE" = "admin" ]; then
        echo "- Admin Dashboard: http://localhost:3006"
    fi
    
    echo ""
    echo "Comandi utili:"
    echo "- Logs: docker compose logs -f"
    echo "- Stop: docker compose down"
    echo "- Test e debug: ./manage.sh help"
}

# Main con correzione modalità admin
main() {
    check_prerequisites
    auto_setup
    
    case "$MODE" in
        "development"|"dev")
            start_system
            ;;
        "admin")
            start_system 
            ;;
        "production"|"prod")
            NODE_ENV=production start_system
            ;;
        *)
            echo "Uso: $0 [development|admin|production]"
            echo ""
            echo "Modalità:"
            echo "  development  - Avvio sviluppo (default)"
            echo "  admin        - Avvio con dashboard admin su porta 3006"
            echo "  production   - Avvio produzione"
            exit 1
            ;;
    esac
}

main