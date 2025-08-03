#!/bin/bash
# Script rapido per avviare il frontend esistente

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 AVVIO FRONTEND E-VOTING WABISABI${NC}"
echo "================================================="
echo ""

# Verifica se il backend è attivo
echo -e "${YELLOW}🔍 Verifica backend...${NC}"

backend_ok=true

# Test API Gateway
if curl -f -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "  ✅ API Gateway (3001): Online"
else
    echo -e "  ❌ API Gateway (3001): Offline"
    backend_ok=false
fi

# Test Auth Service
if curl -f -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo -e "  ✅ Auth Service (3002): Online"
else
    echo -e "  ❌ Auth Service (3002): Offline"
    backend_ok=false
fi

# Test Vote Service
if curl -f -s http://localhost:3003/api/health > /dev/null 2>&1; then
    echo -e "  ✅ Vote Service (3003): Online"
else
    echo -e "  ❌ Vote Service (3003): Offline"
    backend_ok=false
fi

if [ "$backend_ok" = false ]; then
    echo -e "\n${RED}⚠️ Alcuni servizi backend non sono attivi!${NC}"
    echo -e "${YELLOW}💡 Avvia il backend con: docker compose up -d${NC}"
    echo ""
    read -p "Vuoi continuare comunque? (y/n): " continue_anyway
    if [[ ! $continue_anyway =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verifica e avvia frontend
echo -e "\n${YELLOW}🌐 Avvio frontend...${NC}"

if [ -d "client" ]; then
    cd client
    
    if [ -f "package.json" ]; then
        echo -e "${GREEN}✅ Progetto frontend trovato${NC}"
        
        # Verifica se node_modules esiste
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}📦 Installazione dipendenze...${NC}"
            npm install
        fi
        
        echo -e "${GREEN}🚀 Avvio React dev server...${NC}"
        echo ""
        echo -e "${CYAN}Frontend disponibile su: http://localhost:3000${NC}"
        echo -e "${CYAN}Backend disponibile su: http://localhost:3001${NC}"
        echo ""
        echo -e "${YELLOW}💡 Premi Ctrl+C per fermare il server${NC}"
        echo ""
        
        # Avvia il server React
        npm start
    else
        echo -e "${RED}❌ package.json non trovato nella cartella client${NC}"
        echo -e "${YELLOW}💡 Esegui prima: ./setup-frontend.sh${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Cartella client non trovata${NC}"
    echo -e "${YELLOW}💡 Esegui prima: ./setup-frontend.sh${NC}"
    exit 1
fi