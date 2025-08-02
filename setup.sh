#!/bin/bash
# setup-fixed.sh - Script di setup automatico per il sistema E-Voting WabiSabi

set -e  # Esci in caso di errore

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi colorati
print_msg() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Banner
echo "================================================"
echo "   Sistema E-Voting WabiSabi - Setup Automatico"
echo "================================================"
echo ""

# Controlla prerequisiti
print_msg "Controllo prerequisiti..."

# Controlla Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker non trovato! Installa Docker prima di continuare."
    print_msg "Visita: https://docs.docker.com/get-docker/"
    exit 1
fi

# Controlla Docker Compose
if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose non trovato! Installa Docker Compose prima di continuare."
    exit 1
fi

# Controlla Node.js (opzionale per sviluppo)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_msg "Node.js trovato: $NODE_VERSION"
else
    print_warning "Node.js non trovato. Necessario solo per sviluppo locale."
fi

# Crea struttura directory
print_msg "Creazione struttura directory..."

directories=(
    "server1"
    "server2"
    "server3"
    "database/models"
    "security"
    "monitoring"
    "client"
    "test"
    "nginx/ssl"
    "prometheus"
    "grafana/dashboards"
    "grafana/datasources"
    "logs"
    "backups"
)

for dir in "${directories[@]}"; do
    mkdir -p "$dir"
    print_msg "Creata directory: $dir"
done

# Crea file .env se non esiste
if [ ! -f .env ]; then
    print_msg "Creazione file .env..."
    
    # Genera JWT secret casuale
    JWT_SECRET_RANDOM=$(openssl rand -hex 32 2>/dev/null || echo "default-secret-key-change-this")
    
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
JWT_SECRET=${JWT_SECRET_RANDOM}

# Bitcoin
BITCOIN_NETWORK=testnet
BITCOIN_RPC_USER=bitcoinrpc
BITCOIN_RPC_PASS=BitcoinSecurePass789!

# Tor
TOR_USER=tor
TOR_PASSWORD=TorSecurePass321!

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin

# API URLs
AUTH_SERVICE_URL=http://auth-service:3002
VOTE_SERVICE_URL=http://vote-service:3003
EOF
    print_msg "File .env creato con valori di default"
else
    print_warning "File .env già esistente, non sovrascritto"
fi

# Crea certificati SSL self-signed per sviluppo
print_msg "Generazione certificati SSL per sviluppo..."
if [ ! -f nginx/ssl/cert.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=IT/ST=Lazio/L=Roma/O=EVoting/CN=evoting.local" 2>/dev/null || {
        print_warning "Impossibile generare certificati SSL automaticamente"
        print_msg "Genera manualmente con: openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem"
    }
else
    print_warning "Certificati SSL già esistenti"
fi

# Crea file prometheus.yml
print_msg "Creazione configurazione Prometheus..."
cat > prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3001']
    metrics_path: '/monitoring/metrics'

  - job_name: 'auth-service'
    static_configs:
      - targets: ['auth-service:3002']
    metrics_path: '/monitoring/metrics'

  - job_name: 'vote-service'
    static_configs:
      - targets: ['vote-service:3003']
    metrics_path: '/monitoring/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

# Crea datasource Grafana
print_msg "Creazione datasource Grafana..."
cat > grafana/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Crea uno script di test rapido
print_msg "Creazione script di test..."
cat > quick-test.sh << 'EOF'
#!/bin/bash
# Script di test rapido del sistema

echo "===================================="
echo "Test Rapido Sistema E-Voting"
echo "===================================="
echo ""

# Funzione per test con output colorato
test_endpoint() {
    local name=$1
    local url=$2
    echo -n "Test $name: "
    
    if curl -f -s "$url" > /dev/null; then
        echo -e "\033[0;32m✓ OK\033[0m"
        return 0
    else
        echo -e "\033[0;31m✗ FAILED\033[0m"
        return 1
    fi
}

# Test health endpoints
test_endpoint "API Gateway Health" "http://localhost:3001/api/health"
test_endpoint "Auth Service Health" "http://localhost:3002/api/health"
test_endpoint "Vote Service Health" "http://localhost:3003/api/health"

echo ""
echo "Test registrazione utente..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User",
    "taxCode": "RSSMRA85M01H501Z"
  }' 2>/dev/null)

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "\033[0;32m✓ Registrazione completata\033[0m"
else
    echo -e "\033[0;31m✗ Registrazione fallita\033[0m"
    echo "Risposta: $RESPONSE"
fi

echo ""
echo "Test completati!"
EOF
chmod +x quick-test.sh

# Script di utilità aggiuntivi
print_msg "Creazione script di utilità..."

# Script per reset database
cat > reset-db.sh << 'EOF'
#!/bin/bash
echo "Reset database in corso..."
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS evoting_wabisabi;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE evoting_wabisabi;"
echo "Database resettato! Esegui 'make migrate' per reinizializzare."
EOF
chmod +x reset-db.sh

# Script per backup
cat > backup-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.sql"
echo "Backup database in: $BACKUP_FILE"
docker compose exec -T postgres pg_dump -U postgres evoting_wabisabi > "$BACKUP_FILE"
echo "Backup completato!"
EOF
chmod +x backup-db.sh

print_msg "Script di utilità creati:"
echo "  - quick-test.sh: Test rapido del sistema"
echo "  - reset-db.sh: Reset completo del database"
echo "  - backup-db.sh: Backup del database"

echo ""
print_msg "Setup completato!"
echo ""

# Chiedi se vuole avviare il sistema - versione più robusta
while true; do
    echo -n "Vuoi avviare il sistema ora? (y/n): "
    read -r risposta
    
    case "$risposta" in
        [yY]|[yY][eE][sS])
            print_msg "Avvio del sistema in corso..."
            echo ""
            
            # Costruisci i container
            print_msg "Costruzione container Docker..."
            if docker compose build; then
                print_msg "Container costruiti con successo"
            else
                print_error "Errore nella costruzione dei container"
                exit 1
            fi
            
            # Avvia il sistema
            print_msg "Avvio servizi..."
            if docker compose up -d; then
                print_msg "Servizi avviati"
            else
                print_error "Errore nell'avvio dei servizi"
                exit 1
            fi
            
            # Attendi che i servizi siano pronti
            print_msg "Attesa avvio servizi (30 secondi)..."
            echo -n "Attendo: "
            for i in {1..30}; do
                echo -n "."
                sleep 1
            done
            echo " fatto!"
            
            # Mostra stato
            echo ""
            print_msg "Stato dei servizi:"
            docker compose ps
            
            # Test di connettività
            echo ""
            print_msg "Verifica servizi..."
            
            # Controlla se i servizi rispondono
            services_ok=true
            
            if curl -f -s http://localhost:3001/api/health > /dev/null 2>&1; then
                echo "  ✓ API Gateway: OK"
            else
                echo "  ✗ API Gateway: Non risponde"
                services_ok=false
            fi
            
            if curl -f -s http://localhost:3002/api/health > /dev/null 2>&1; then
                echo "  ✓ Auth Service: OK"
            else
                echo "  ✗ Auth Service: Non risponde"
                services_ok=false
            fi
            
            if curl -f -s http://localhost:3003/api/health > /dev/null 2>&1; then
                echo "  ✓ Vote Service: OK"
            else
                echo "  ✗ Vote Service: Non risponde"
                services_ok=false
            fi
            
            echo ""
            
            if $services_ok; then
                print_msg "Sistema avviato con successo! ✨"
            else
                print_warning "Alcuni servizi non rispondono ancora. Potrebbero essere ancora in avvio."
                print_msg "Controlla i log con: docker compose logs -f"
            fi
            
            echo ""
            echo "================================================"
            echo "Punti di accesso:"
            echo "- API Gateway: http://localhost:3001"
            echo "- Grafana: http://localhost:3000 (admin/admin)"
            echo "- Prometheus: http://localhost:9090"
            echo ""
            echo "Comandi utili:"
            echo "- Test sistema: ./quick-test.sh"
            echo "- Visualizza log: docker compose logs -f"
            echo "- Ferma sistema: docker compose down"
            echo "- Backup DB: ./backup-db.sh"
            echo "================================================"
            
            break
            ;;
            
        [nN]|[nN][oO])
            echo ""
            print_msg "Sistema non avviato."
            echo ""
            echo "Per avviare il sistema manualmente:"
            echo "  docker compose up -d"
            echo ""
            echo "Per maggiori informazioni:"
            echo "  docker compose --help"
            echo ""
            break
            ;;
            
        *)
            echo "Per favore rispondi 'y' (yes) o 'n' (no)"
            ;;
    esac
done

echo ""
echo "Setup completato! 🎉"
echo ""