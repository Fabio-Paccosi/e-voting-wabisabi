#!/bin/bash
# Script di debug dettagliato per identificare problemi nel build Docker

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Debug Build Docker - Sistema E-Voting WabiSabi${NC}"
echo "=================================================================="

# 1. Controllo prerequisiti Docker
echo -e "\n${YELLOW}📋 CONTROLLO PREREQUISITI${NC}"
echo "------------------------------------------------------------------"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "✅ Docker: $DOCKER_VERSION"
else
    echo -e "❌ Docker non installato"
    exit 1
fi

if command -v docker compose &> /dev/null; then
    echo -e "✅ Docker Compose: $(docker compose version)"
elif command -v docker-compose &> /dev/null; then
    echo -e "✅ Docker Compose: $(docker-compose --version)"
else
    echo -e "❌ Docker Compose non installato"
    exit 1
fi

# 2. Controllo struttura file
echo -e "\n${YELLOW}📁 CONTROLLO STRUTTURA FILE${NC}"
echo "------------------------------------------------------------------"

required_files=(
    "docker-compose.yml"
    ".env"
    "server1/Dockerfile"
    "server1/package.json"
    "server1/app.js"
    "server1/healthcheck.js"
    "server2/Dockerfile"
    "server2/package.json"
    "server2/app.js"
    "server2/healthcheck.js"
    "server3/Dockerfile"
    "server3/package.json"
    "server3/app.js"
    "server3/healthcheck.js"
)

missing_files=()

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "✅ $file"
    else
        echo -e "❌ $file - MANCANTE"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo -e "\n${RED}⚠️  ERRORE: File mancanti rilevati!${NC}"
    echo "Esegui prima fix-missing-files.sh per creare i file mancanti."
    
    # Crea automaticamente i file mancanti più critici
    echo -e "\n${YELLOW}🔧 Creazione automatica file mancanti...${NC}"
    
    # Crea app.js minimali se mancanti
    for server in server1 server2 server3; do
        if [ ! -f "$server/app.js" ]; then
            echo "Creando $server/app.js..."
            mkdir -p "$server"
            cat > "$server/app.js" << EOF
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 300${server: -1};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: '$server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'E-Voting WabiSabi - $server',
        status: 'running'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(\`$server listening on port \${PORT}\`);
});

module.exports = app;
EOF
        fi
    done
fi

# 3. Test sintassi docker-compose.yml
echo -e "\n${YELLOW}🐳 CONTROLLO DOCKER-COMPOSE.YML${NC}"
echo "------------------------------------------------------------------"

if docker compose config > /dev/null 2>&1; then
    echo -e "✅ docker-compose.yml sintassi corretta"
else
    echo -e "❌ docker-compose.yml ha errori di sintassi:"
    docker compose config
    exit 1
fi

# 4. Controllo singoli Dockerfile
echo -e "\n${YELLOW}📦 CONTROLLO DOCKERFILE INDIVIDUALI${NC}"
echo "------------------------------------------------------------------"

servers=("server1" "server2" "server3")

for server in "${servers[@]}"; do
    echo -e "\n${BLUE}Testando $server...${NC}"
    
    if [ -d "$server" ]; then
        cd "$server"
        
        # Controllo package.json
        if [ -f "package.json" ]; then
            if python3 -m json.tool package.json > /dev/null 2>&1; then
                echo -e "  ✅ package.json sintassi corretta"
            else
                echo -e "  ❌ package.json ha errori di sintassi"
            fi
        fi
        
        # Test build singolo container
        echo -e "  🔨 Tentativo build $server..."
        if docker build -t "test-$server" . > "/tmp/$server-build.log" 2>&1; then
            echo -e "  ✅ Build $server completato"
            docker rmi "test-$server" > /dev/null 2>&1 || true
        else
            echo -e "  ❌ Build $server fallito"
            echo -e "  📋 Log errore:"
            tail -20 "/tmp/$server-build.log" | sed 's/^/    /'
            
            # Analisi errore specifico
            if grep -q "package.json.*not found" "/tmp/$server-build.log"; then
                echo -e "  🔍 DIAGNOSI: package.json mancante o non accessibile"
            elif grep -q "npm.*ERR" "/tmp/$server-build.log"; then
                echo -e "  🔍 DIAGNOSI: Errore npm durante installazione dipendenze"
            elif grep -q "COPY.*failed" "/tmp/$server-build.log"; then
                echo -e "  🔍 DIAGNOSI: Errore copia file nel container"
            fi
        fi
        
        cd ..
    else
        echo -e "  ❌ Directory $server non trovata"
    fi
done

# 5. Test docker-compose build dettagliato
echo -e "\n${YELLOW}🏗️ TEST DOCKER-COMPOSE BUILD COMPLETO${NC}"
echo "------------------------------------------------------------------"

echo "Esecuzione: docker compose build --no-cache --progress=plain"
echo ""

if docker compose build --no-cache --progress=plain > /tmp/compose-build.log 2>&1; then
    echo -e "✅ Docker Compose build completato con successo!"
else
    echo -e "❌ Docker Compose build fallito"
    echo -e "\n📋 Log errore completo:"
    echo "------------------------------------------------------------------"
    tail -50 /tmp/compose-build.log
    
    echo -e "\n🔍 ANALISI ERRORE:"
    echo "------------------------------------------------------------------"
    
    if grep -q "No such file or directory" /tmp/compose-build.log; then
        echo -e "➜ File mancanti rilevati"
        grep "No such file or directory" /tmp/compose-build.log | head -5
    fi
    
    if grep -q "npm ERR" /tmp/compose-build.log; then
        echo -e "➜ Errori npm rilevati"
        grep -A5 "npm ERR" /tmp/compose-build.log | head -10
    fi
    
    if grep -q "failed to solve" /tmp/compose-build.log; then
        echo -e "➜ Errore Docker build generico"
        grep -B5 -A5 "failed to solve" /tmp/compose-build.log
    fi
fi

# 6. Pulizia e suggerimenti
echo -e "\n${YELLOW}🧹 PULIZIA E SUGGERIMENTI${NC}"
echo "------------------------------------------------------------------"

echo "File di log salvati in:"
echo "  - /tmp/server1-build.log"
echo "  - /tmp/server2-build.log"
echo "  - /tmp/server3-build.log"
echo "  - /tmp/compose-build.log"

echo -e "\n💡 POSSIBILI SOLUZIONI:"
echo "1. Se mancano file app.js, esegui: ./create-minimal-apps.sh"
echo "2. Se errori npm, controlla dipendenze in package.json"
echo "3. Se errori Docker, verifica sintassi Dockerfile"
echo "4. Per build pulito: docker system prune -f && docker compose build --no-cache"

echo -e "\n${GREEN}Debug completato!${NC}"