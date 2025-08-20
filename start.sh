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
    mkdir -p {server1,server2,server3,database/models,nginx/ssl,logs,backups}
    
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

volumes:
  postgres_data:

networks:
  evoting-network:
    driver: bridge
EOF
        print_msg "✓ Docker compose creato con admin separato"
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
    
    print_msg "Sistema avviato! "
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