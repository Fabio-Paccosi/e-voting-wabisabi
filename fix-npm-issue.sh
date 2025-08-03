#!/bin/bash
# Script per risolvere il conflitto npm tra package.json e package-lock.json

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Risoluzione Conflitto NPM - Sistema E-Voting WabiSabi${NC}"
echo "=================================================================="

echo -e "${YELLOW}📋 Problema identificato:${NC}"
echo "I package.json appena creati non sono allineati con i package-lock.json esistenti"
echo "Questo causa il fallimento di 'npm ci --only=production'"
echo ""

# Opzione 1: Modifica Dockerfile per usare npm install
echo -e "${BLUE}SOLUZIONE 1: Modifica Dockerfile per usare npm install${NC}"
echo "------------------------------------------------------------------"

for server in server1 server2 server3; do
    echo -e "${YELLOW}🔧 Aggiornando $server/Dockerfile...${NC}"
    
    # Backup del Dockerfile corrente
    cp "$server/Dockerfile" "$server/Dockerfile.backup.npm"
    
    # Crea nuovo Dockerfile che usa npm install e pulisce prima
    cat > "$server/Dockerfile" << EOF
FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \\
    python3 \\
    make \\
    g++ \\
    git$([ "$server" = "server3" ] && echo " \\
    libtool \\
    autoconf \\
    automake")

# Crea directory di lavoro
WORKDIR /app

# Copia package.json
COPY package.json ./

# Rimuovi package-lock.json per evitare conflitti e installa dipendenze
RUN npm install --only=production --no-package-lock

# Copia il resto del codice sorgente
COPY . .

# Esponi la porta
EXPOSE 300$(echo $server | sed 's/server//')

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]
EOF

    echo -e "  ✅ $server/Dockerfile aggiornato"
done

echo -e "\n${BLUE}SOLUZIONE 2: Pulizia completa e ricostruzione${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🗑️ Pulizia node_modules e package-lock.json esistenti...${NC}"

for server in server1 server2 server3; do
    if [ -d "$server/node_modules" ]; then
        echo -e "  🗑️ Rimuovendo $server/node_modules..."
        rm -rf "$server/node_modules"
    fi
    
    if [ -f "$server/package-lock.json" ]; then
        echo -e "  🗑️ Rimuovendo $server/package-lock.json..."
        mv "$server/package-lock.json" "$server/package-lock.json.backup"
    fi
done

echo -e "\n${BLUE}Test build con la nuova configurazione${NC}"
echo "------------------------------------------------------------------"

# Test build di un server per verificare che funzioni
echo -e "${YELLOW}🔨 Test build server1...${NC}"
cd server1

if docker build -t test-server1-npm . > /tmp/server1-npm-test.log 2>&1; then
    echo -e "${GREEN}✅ Build server1 - SUCCESSO con npm install!${NC}"
    docker rmi test-server1-npm > /dev/null 2>&1 || true
else
    echo -e "${RED}❌ Build server1 - ancora problemi${NC}"
    echo -e "${YELLOW}📋 Log completo:${NC}"
    cat /tmp/server1-npm-test.log | tail -20
fi

cd ..

echo -e "\n${BLUE}SOLUZIONE 3: Dockerfile ottimizzato con multi-stage${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🏗️ Creando Dockerfile ottimizzati...${NC}"

for server in server1 server2 server3; do
    port=$(echo $server | sed 's/server/300/')
    
    cat > "$server/Dockerfile.optimized" << EOF
# Multi-stage build per ottimizzare le immagini
FROM node:18-alpine AS dependencies

# Installa dipendenze di sistema
RUN apk add --no-cache \\
    python3 \\
    make \\
    g++ \\
    git$([ "$server" = "server3" ] && echo " \\
    libtool \\
    autoconf \\
    automake")

WORKDIR /app

# Copia solo package.json
COPY package.json ./

# Installa tutte le dipendenze (incluse dev per il build)
RUN npm install

# Stage di produzione
FROM node:18-alpine AS production

WORKDIR /app

# Copia solo le dipendenze di produzione dal stage precedente
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json

# Copia il codice dell'applicazione
COPY app.js healthcheck.js ./

# Rimuovi dipendenze di sviluppo per ridurre la dimensione
RUN npm prune --production

# Crea utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodeuser -u 1001

USER nodeuser

# Esponi la porta
EXPOSE $port

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]
EOF

done

echo -e "\n${GREEN}🎉 Soluzioni create!${NC}"
echo ""
echo -e "${CYAN}📋 Opzioni disponibili:${NC}"
echo ""
echo -e "${YELLOW}OPZIONE A - Dockerfile semplici (raccomandato):${NC}"
echo "  docker compose build"
echo ""
echo -e "${YELLOW}OPZIONE B - Dockerfile ottimizzati:${NC}"
echo "  # Copia i Dockerfile ottimizzati"
echo "  for server in server1 server2 server3; do"
echo "    cp \$server/Dockerfile.optimized \$server/Dockerfile"
echo "  done"
echo "  docker compose build"
echo ""
echo -e "${YELLOW}OPZIONE C - Build singolo per test:${NC}"
echo "  cd server1 && docker build -t test-server1 ."
echo ""
echo -e "${GREEN}✨ Prova ora: docker compose build${NC}"

# Mostra informazioni sui file modificati
echo -e "\n${BLUE}📁 File modificati:${NC}"
for server in server1 server2 server3; do
    echo -e "${YELLOW}$server/${NC}"
    echo "  📄 Dockerfile (aggiornato)"
    echo "  📄 Dockerfile.optimized (nuovo)"
    echo "  📄 Dockerfile.backup.npm (backup)"
    if [ -f "$server/package-lock.json.backup" ]; then
        echo "  📄 package-lock.json.backup (backup del vecchio)"
    fi
    echo ""
done