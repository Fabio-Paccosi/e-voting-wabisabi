#!/bin/bash
# Script per creare Dockerfile corretti per tutti i server

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 Riparazione Dockerfile - Sistema E-Voting WabiSabi${NC}"
echo "=================================================================="

# Verifica e backup dei Dockerfile esistenti
for server in server1 server2 server3; do
    if [ -f "$server/Dockerfile" ]; then
        echo -e "${YELLOW}📋 Backup di $server/Dockerfile...${NC}"
        cp "$server/Dockerfile" "$server/Dockerfile.backup.$(date +%Y%m%d_%H%M%S)"
    fi
done

# Crea Dockerfile per Server 1 (API Gateway)
echo -e "\n${YELLOW}🌐 Creando server1/Dockerfile (API Gateway)...${NC}"
cat > server1/Dockerfile << 'EOF'
FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Esponi la porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]
EOF

# Crea Dockerfile per Server 2 (Auth Service)
echo -e "${YELLOW}🔐 Creando server2/Dockerfile (Auth Service)...${NC}"
cat > server2/Dockerfile << 'EOF'
FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Esponi la porta
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]
EOF

# Crea Dockerfile per Server 3 (Vote Service)
echo -e "${YELLOW}⛓️ Creando server3/Dockerfile (Vote Service)...${NC}"
cat > server3/Dockerfile << 'EOF'
FROM node:18-alpine

# Installa dipendenze di sistema necessarie per Bitcoin libraries
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    libtool \
    autoconf \
    automake

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Esponi la porta
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]
EOF

echo -e "\n${GREEN}✅ Dockerfile creati con successo!${NC}"

# Verifica che i Dockerfile siano corretti
echo -e "\n${YELLOW}🔍 Verifica sintassi Dockerfile...${NC}"

for server in server1 server2 server3; do
    echo -e "${BLUE}Verificando $server/Dockerfile...${NC}"
    
    if [ -f "$server/Dockerfile" ]; then
        # Verifica che inizi con FROM
        first_line=$(head -n1 "$server/Dockerfile")
        if echo "$first_line" | grep -q "FROM"; then
            echo -e "  ✅ $server/Dockerfile - sintassi corretta"
        else
            echo -e "  ❌ $server/Dockerfile - primo comando non è FROM"
            echo -e "     Prima riga: $first_line"
        fi
    else
        echo -e "  ❌ $server/Dockerfile - file non trovato"
    fi
done

# Test build singoli
echo -e "\n${YELLOW}🔨 Test build singoli...${NC}"

for server in server1 server2 server3; do
    echo -e "${BLUE}Test build $server...${NC}"
    
    if [ -d "$server" ] && [ -f "$server/Dockerfile" ] && [ -f "$server/package.json" ] && [ -f "$server/app.js" ]; then
        cd "$server"
        
        if docker build -t "test-$server" . > "/tmp/$server-build-test.log" 2>&1; then
            echo -e "  ✅ Build $server - SUCCESSO"
            # Rimuovi l'immagine di test
            docker rmi "test-$server" > /dev/null 2>&1 || true
        else
            echo -e "  ❌ Build $server - FALLITO"
            echo -e "  📋 Ultimi 10 righe del log:"
            tail -10 "/tmp/$server-build-test.log" | sed 's/^/    /'
        fi
        
        cd ..
    else
        echo -e "  ⚠️ $server - file mancanti"
        
        # Verifica file specifici
        missing_files=()
        for file in "Dockerfile" "package.json" "app.js" "healthcheck.js"; do
            if [ ! -f "$server/$file" ]; then
                missing_files+=("$file")
            fi
        done
        
        if [ ${#missing_files[@]} -gt 0 ]; then
            echo -e "    File mancanti: ${missing_files[*]}"
        fi
    fi
done

# Mostra struttura finale
echo -e "\n${YELLOW}📁 Struttura file finale:${NC}"
for server in server1 server2 server3; do
    echo -e "${BLUE}$server/${NC}"
    if [ -d "$server" ]; then
        ls -la "$server/" | grep -E "\.(js|json|Dockerfile)$|^d" | sed 's/^/  /'
    else
        echo -e "  ❌ Directory non trovata"
    fi
    echo ""
done

echo -e "${GREEN}🎉 Riparazione Dockerfile completata!${NC}"
echo ""
echo -e "${CYAN}📋 Prossimi passi:${NC}"
echo "1. Test docker-compose build:  docker compose build"
echo "2. Se funziona, avvia:         docker compose up -d"
echo "3. Verifica servizi:           docker compose ps"
echo ""
echo -e "${YELLOW}💡 Se il build fallisce ancora, i log sono salvati in:${NC}"
echo "  - /tmp/server1-build-test.log"
echo "  - /tmp/server2-build-test.log"
echo "  - /tmp/server3-build-test.log"