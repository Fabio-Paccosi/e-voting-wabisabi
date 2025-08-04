#!/bin/bash
# Script completo per riparare tutti i problemi del sistema E-Voting WabiSabi

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 RIPARAZIONE COMPLETA - Sistema E-Voting WabiSabi${NC}"
echo "=================================================================="
echo ""

# Step 1: Fix docker-compose.yml
echo -e "${BLUE}STEP 1: Riparazione docker-compose.yml${NC}"
echo "------------------------------------------------------------------"

if [ -f "docker-compose.yml" ]; then
    echo -e "${YELLOW}📋 Backup del file esistente...${NC}"
    cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
fi

echo -e "${YELLOW}📝 Creazione nuovo docker-compose.yml...${NC}"
cat > docker-compose.yml << 'EOF'
services:
  # Database PostgreSQL
  postgres:
    image: postgres:15-alpine
    container_name: evoting-postgres
    environment:
      POSTGRES_DB: evoting_wabisabi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - evoting-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis per caching e sessioni
  redis:
    image: redis:7-alpine
    container_name: evoting-redis
    command: redis-server --requirepass ${REDIS_PASSWORD:-redis123}
    ports:
      - "6379:6379"
    networks:
      - evoting-network
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Server 1: API Gateway
  api-gateway:
    build:
      context: ./server1
      dockerfile: Dockerfile
    container_name: evoting-api-gateway
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3001
      AUTH_SERVICE_URL: http://auth-service:3002
      VOTE_SERVICE_URL: http://vote-service:3003
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379
    ports:
      - "3001:3001"
    depends_on:
      - redis
      - postgres
    networks:
      - evoting-network
    restart: unless-stopped

  # Server 2: Authentication & Credentials
  auth-service:
    build:
      context: ./server2
      dockerfile: Dockerfile
    container_name: evoting-auth-service
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3002
      DB_HOST: postgres
      DB_NAME: evoting_wabisabi
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD:-password}
      JWT_SECRET: ${JWT_SECRET:-your-secret-key}
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379
    ports:
      - "3002:3002"
    depends_on:
      - postgres
      - redis
    networks:
      - evoting-network
    restart: unless-stopped

  # Server 3: Vote Processing & Blockchain
  vote-service:
    build:
      context: ./server3
      dockerfile: Dockerfile
    container_name: evoting-vote-service
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3003
      DB_HOST: postgres
      DB_NAME: evoting_wabisabi
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD:-password}
      BITCOIN_NETWORK: ${BITCOIN_NETWORK:-testnet}
      BITCOIN_NODE_URL: ${BITCOIN_NODE_URL:-http://bitcoin-node:8332}
      BITCOIN_RPC_USER: ${BITCOIN_RPC_USER:-user}
      BITCOIN_RPC_PASS: ${BITCOIN_RPC_PASS:-pass}
    ports:
      - "3003:3003"
    depends_on:
      - postgres
      - bitcoin-node
    networks:
      - evoting-network
    restart: unless-stopped

  # Bitcoin Core Node (Testnet)
  bitcoin-node:
    image: ruimarinho/bitcoin-core:0.21
    container_name: evoting-bitcoin-node
    command:
      - -testnet
      - -server
      - -rpcuser=${BITCOIN_RPC_USER:-user}
      - -rpcpassword=${BITCOIN_RPC_PASS:-pass}
      - -rpcallowip=0.0.0.0/0
      - -rpcbind=0.0.0.0
      - -printtoconsole
    volumes:
      - bitcoin_data:/home/bitcoin/.bitcoin
    ports:
      - "18332:18332"
      - "18333:18333"
    networks:
      - evoting-network

volumes:
  postgres_data:
  redis_data:
  bitcoin_data:

networks:
  evoting-network:
    driver: bridge
EOF

# Verifica sintassi docker-compose
if docker compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ docker-compose.yml creato e verificato${NC}"
else
    echo -e "${RED}❌ Errore nella sintassi docker-compose.yml${NC}"
    exit 1
fi

# Step 2: Crea structure directory
echo -e "\n${BLUE}STEP 2: Creazione struttura directory${NC}"
echo "------------------------------------------------------------------"

directories=(
    "server1"
    "server2"
    "server3"
    "nginx"
    "prometheus"
    "grafana/provisioning"
    "grafana/dashboards"
    "logs"
    "backups"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "✅ Creata: $dir"
    fi
done

# Step 3: Crea package.json per tutti i server
echo -e "\n${BLUE}STEP 3: Creazione package.json${NC}"
echo "------------------------------------------------------------------"

# Server1 package.json
echo -e "${YELLOW}📦 Creando server1/package.json...${NC}"
cat > server1/package.json << 'EOF'
{
  "name": "evoting-api-gateway",
  "version": "1.0.0",
  "description": "API Gateway per sistema E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "redis": "^4.6.8",
    "axios": "^1.4.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.9.2",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Server2 package.json
echo -e "${YELLOW}📦 Creando server2/package.json...${NC}"
cat > server2/package.json << 'EOF'
{
  "name": "evoting-auth-service",
  "version": "1.0.0",
  "description": "Servizio di Autenticazione e Credenziali per E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.11.1",
    "redis": "^4.6.8",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.9.2",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Server3 package.json
echo -e "${YELLOW}📦 Creando server3/package.json...${NC}"
cat > server3/package.json << 'EOF'
{
  "name": "evoting-vote-service",
  "version": "1.0.0",
  "description": "Servizio di Elaborazione Voti e Blockchain per E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.11.1",
    "bitcoinjs-lib": "^6.1.3",
    "axios": "^1.4.0",
    "joi": "^17.9.2",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Step 4: Crea app.js per tutti i server (se non esistono)
echo -e "\n${BLUE}STEP 4: Creazione app.js${NC}"
echo "------------------------------------------------------------------"

# Server1 app.js
if [ ! -f "server1/app.js" ]; then
    echo -e "${YELLOW}🌐 Creando server1/app.js...${NC}"
    cat > server1/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'API Gateway',
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'E-Voting WabiSabi - API Gateway',
        status: 'running',
        version: '1.0.0'
    });
});

app.use('/api/auth', (req, res) => {
    res.json({ message: 'Auth service endpoint - placeholder' });
});

app.use('/api/vote', (req, res) => {
    res.json({ message: 'Vote service endpoint - placeholder' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🌐 API Gateway listening on port ${PORT}`);
});

module.exports = app;
EOF
fi

# Server2 app.js
if [ ! -f "server2/app.js" ]; then
    echo -e "${YELLOW}🔐 Creando server2/app.js...${NC}"
    cat > server2/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3002;
const users = new Map();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Auth & Credentials Service',
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'E-Voting WabiSabi - Auth & Credentials Service',
        status: 'running'
    });
});

app.post('/api/register', (req, res) => {
    const { email, taxCode } = req.body;
    if (!email || !taxCode) {
        return res.status(400).json({ error: 'Email and taxCode required' });
    }
    
    const userId = `user_${Date.now()}`;
    users.set(email, { id: userId, email, taxCode, isAuthorized: true, hasVoted: false });
    
    res.json({ success: true, userId });
});

app.listen(PORT, () => {
    console.log(`🔐 Auth Service listening on port ${PORT}`);
});

module.exports = app;
EOF
fi

# Server3 app.js
if [ ! -f "server3/app.js" ]; then
    echo -e "${YELLOW}⛓️ Creando server3/app.js...${NC}"
    cat > server3/app.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3003;
const votes = new Map();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Vote Processing & Blockchain Service',
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'E-Voting WabiSabi - Vote Processing Service',
        status: 'running'
    });
});

app.post('/api/vote/submit', (req, res) => {
    const { commitment, serialNumber } = req.body;
    if (!commitment || !serialNumber) {
        return res.status(400).json({ error: 'Commitment and serialNumber required' });
    }
    
    const voteId = `vote_${Date.now()}`;
    votes.set(voteId, { commitment, serialNumber, timestamp: new Date().toISOString() });
    
    res.json({ success: true, voteId });
});

app.listen(PORT, () => {
    console.log(`⛓️ Vote Service listening on port ${PORT}`);
});

module.exports = app;
EOF
fi

# Step 5: Crea healthcheck.js per tutti i server
echo -e "\n${BLUE}STEP 5: Creazione healthcheck.js${NC}"
echo "------------------------------------------------------------------"

for server in server1 server2 server3; do
    port=$((3000 + ${server: -1}))
    if [ ! -f "$server/healthcheck.js" ]; then
        echo -e "${YELLOW}🏥 Creando $server/healthcheck.js...${NC}"
        cat > "$server/healthcheck.js" << EOF
const http = require('http');

const options = {
    host: 'localhost',
    port: $port,
    path: '/api/health',
    timeout: 2000
};

const request = http.request(options, (res) => {
    if (res.statusCode == 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', () => {
    process.exit(1);
});

request.end();
EOF
    fi
done

# Step 6: Verifica .env
echo -e "\n${BLUE}STEP 6: Verifica file .env${NC}"
echo "------------------------------------------------------------------"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creando file .env...${NC}"
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "default-secret-key-change-this")
    
    cat > .env << EOF
# Ambiente
NODE_ENV=development

# Database
DB_PASSWORD=SuperSecurePassword123!
DB_HOST=postgres
DB_NAME=evoting_wabisabi
DB_USER=postgres

# Redis
REDIS_PASSWORD=RedisSecurePass456!

# JWT
JWT_SECRET=${JWT_SECRET}

# Bitcoin
BITCOIN_NETWORK=testnet
BITCOIN_RPC_USER=bitcoinrpc
BITCOIN_RPC_PASS=BitcoinSecurePass789!

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
EOF
    echo -e "✅ File .env creato"
else
    echo -e "✅ File .env già presente"
fi

# Step 7: Test finale
echo -e "\n${BLUE}STEP 7: Test finale${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🔍 Verifica docker-compose.yml...${NC}"
if docker compose config > /dev/null 2>&1; then
    echo -e "✅ Sintassi corretta"
else
    echo -e "❌ Errori rilevati"
    exit 1
fi

echo -e "${YELLOW}🔍 Verifica struttura file...${NC}"
required_files=(
    "server1/package.json"
    "server1/app.js" 
    "server1/healthcheck.js"
    "server2/package.json"
    "server2/app.js"
    "server2/healthcheck.js"
    "server3/package.json"
    "server3/app.js"
    "server3/healthcheck.js"
)

all_good=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ✅ $file"
    else
        echo -e "  ❌ $file"
        all_good=false
    fi
done

if [ "$all_good" = false ]; then
    echo -e "${RED}❌ Alcuni file sono ancora mancanti${NC}"
    exit 1
fi

# Successo finale
echo ""
echo -e "${GREEN}🎉 RIPARAZIONE COMPLETATA CON SUCCESSO! 🎉${NC}"
echo "=================================================================="
echo ""
echo -e "${CYAN}📋 Comandi per testare:${NC}"
echo "1. Test build:        docker compose build"
echo "2. Avvia sistema:     docker compose up -d"
echo "3. Verifica servizi:  docker compose ps"
echo "4. Visualizza log:    docker compose logs -f"
echo ""
echo -e "${CYAN}🌐 Endpoints una volta avviato:${NC}"
echo "- API Gateway:     http://localhost:3001"
echo "- Auth Service:    http://localhost:3002"
echo "- Vote Service:    http://localhost:3003"
echo "- PostgreSQL:      localhost:5432"
echo "- Redis:           localhost:6379"
echo ""
echo -e "${GREEN}✨ Ora puoi eseguire: docker compose build${NC}"