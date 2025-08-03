#!/bin/bash
# Script per aggiornare i package.json con tutte le dipendenze reali necessarie

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Aggiornamento Package.json - Sistema E-Voting WabiSabi${NC}"
echo "=================================================================="

echo -e "${YELLOW}📋 Problema identificato:${NC}"
echo "I package.json creati sono troppo semplificati per gli app.js esistenti"
echo "Gli app.js del 19 luglio richiedono dipendenze non incluse (uuid, bcrypt, bitcoinjs-lib, etc.)"
echo ""

# Backup dei package.json attuali
for server in server1 server2 server3; do
    if [ -f "$server/package.json" ]; then
        echo -e "${YELLOW}📋 Backup di $server/package.json...${NC}"
        cp "$server/package.json" "$server/package.json.backup.simplified"
    fi
done

# Crea package.json COMPLETO per Server1 (API Gateway)
echo -e "\n${YELLOW}🌐 Creando server1/package.json completo...${NC}"
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
    "express-rate-limit": "^6.7.0",
    "axios": "^1.4.0",
    "uuid": "^11.1.0",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.3",
    "express-validator": "^7.0.1",
    "winston": "^3.8.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crea package.json COMPLETO per Server2 (Auth Service)
echo -e "${YELLOW}🔐 Creando server2/package.json completo...${NC}"
cat > server2/package.json << 'EOF'
{
  "name": "evoting-auth-service",
  "version": "1.0.0",
  "description": "Servizio di Autenticazione e Credenziali per E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest",
    "migrate": "node migrations/run-migrations.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.11.1",
    "redis": "^4.6.8",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^11.1.0",
    "joi": "^17.9.2",
    "elliptic": "^6.5.4",
    "bn.js": "^5.2.1",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crea package.json COMPLETO per Server3 (Vote Service)
echo -e "${YELLOW}⛓️ Creando server3/package.json completo...${NC}"
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
    "uuid": "^11.1.0",
    "joi": "^17.9.2",
    "elliptic": "^6.5.4",
    "bn.js": "^5.2.1",
    "secp256k1": "^5.0.0",
    "bip39": "^3.1.0",
    "bip32": "^4.0.0",
    "tiny-secp256k1": "^2.2.3",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

echo -e "\n${GREEN}✅ Package.json completi creati!${NC}"

# Pulizia dei package-lock.json obsoleti per evitare conflitti
echo -e "\n${YELLOW}🗑️ Pulizia package-lock.json obsoleti...${NC}"
for server in server1 server2 server3; do
    if [ -f "$server/package-lock.json" ]; then
        echo -e "  🗑️ Spostando $server/package-lock.json in backup..."
        mv "$server/package-lock.json" "$server/package-lock.json.old"
    fi
done

# Verifica sintassi JSON
echo -e "\n${YELLOW}🔍 Verifica sintassi package.json...${NC}"
for server in server1 server2 server3; do
    if python3 -m json.tool "$server/package.json" > /dev/null 2>&1; then
        echo -e "  ✅ $server/package.json - sintassi corretta"
    else
        echo -e "  ❌ $server/package.json - errori di sintassi"
    fi
done

# Test build singolo per verificare
echo -e "\n${YELLOW}🔨 Test build con le nuove dipendenze...${NC}"

echo -e "${BLUE}Test build server1...${NC}"
cd server1
if docker build -t test-server1-deps . > /tmp/server1-deps-test.log 2>&1; then
    echo -e "  ✅ Build server1 - SUCCESSO!"
    docker rmi test-server1-deps > /dev/null 2>&1 || true
else
    echo -e "  ❌ Build server1 - fallito"
    echo -e "  📋 Ultimi errori:"
    tail -10 /tmp/server1-deps-test.log | sed 's/^/    /'
fi
cd ..

echo -e "\n${GREEN}🎉 Aggiornamento dipendenze completato!${NC}"
echo ""
echo -e "${CYAN}📋 Dipendenze aggiunte:${NC}"
echo ""
echo -e "${YELLOW}Server1 (API Gateway):${NC}"
echo "  + uuid (per generazione ID)"
echo "  + express-rate-limit (per rate limiting)"
echo "  + winston (per logging)"
echo "  + express-validator (per validazione)"
echo ""
echo -e "${YELLOW}Server2 (Auth Service):${NC}"
echo "  + uuid (per generazione ID)"
echo "  + bcrypt (per hash password)"
echo "  + jsonwebtoken (per JWT)"
echo "  + pg (per PostgreSQL)"
echo "  + redis (per cache)"
echo "  + elliptic (per crittografia)"
echo ""
echo -e "${YELLOW}Server3 (Vote Service):${NC}"
echo "  + uuid (per generazione ID)"
echo "  + bitcoinjs-lib (per Bitcoin)"
echo "  + pg (per PostgreSQL)"
echo "  + elliptic, secp256k1 (per crittografia)"
echo "  + bip39, bip32 (per wallet Bitcoin)"
echo ""
echo -e "${CYAN}📋 Prossimi passi:${NC}"
echo "1. Build completo:     docker compose build"
echo "2. Avvia sistema:      docker compose up -d"
echo "3. Verifica servizi:   docker compose ps"
echo "4. Test endpoints:     curl http://localhost:3001/api/health"
echo ""
echo -e "${GREEN}✨ Ora tutti gli app.js dovrebbero funzionare correttamente!${NC}"

# Mostra confronto versioni
echo -e "\n${BLUE}📊 Confronto versioni package.json:${NC}"
for server in server1 server2 server3; do
    echo -e "${YELLOW}$server:${NC}"
    echo -e "  📄 package.json (nuovo completo)"
    if [ -f "$server/package.json.backup.simplified" ]; then
        echo -e "  📄 package.json.backup.simplified (backup semplificato)"
    fi
    if [ -f "$server/package-lock.json.old" ]; then
        echo -e "  📄 package-lock.json.old (backup del vecchio)"
    fi
    echo ""
done