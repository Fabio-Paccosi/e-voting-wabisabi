#!/bin/bash
# start-admin-robust.sh
# Script di avvio robusto per il dashboard amministratore

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 AVVIO ROBUSTO DASHBOARD AMMINISTRATORE${NC}"
echo "================================================="
echo ""

# Funzione per controllare prerequisiti
check_prerequisites() {
    echo -e "${YELLOW}🔍 Controllo prerequisiti...${NC}"
    
    # Verifica Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js non trovato!${NC}"
        echo "📦 Installa Node.js da: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        echo -e "${RED}❌ Node.js troppo vecchio ($NODE_VERSION). Richiesta v16+${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node --version) OK${NC}"
    
    # Verifica directory
    if [ ! -d "admin-dashboard" ]; then
        echo -e "${RED}❌ Directory admin-dashboard non trovata!${NC}"
        echo "🔧 Esegui prima: ./setup-admin.sh"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Directory admin-dashboard OK${NC}"
}

# Funzione per installare dipendenze se necessario
ensure_dependencies() {
    echo -e "${YELLOW}📦 Verifica dipendenze...${NC}"
    
    cd admin-dashboard
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json non trovato!${NC}"
        exit 1
    fi
    
    if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
        echo -e "${YELLOW}📥 Installazione dipendenze in corso...${NC}"
        npm install
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Errore installazione dipendenze!${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Dipendenze OK${NC}"
    cd ..
}

# Funzione per verificare i servizi base
check_base_services() {
    echo -e "${YELLOW}🔗 Verifica servizi base...${NC}"
    
    services_down=0
    for port in 3001 3002 3003; do
        if ! nc -z localhost $port 2>/dev/null; then
            services_down=$((services_down + 1))
        fi
    done
    
    if [ $services_down -gt 0 ]; then
        echo -e "${YELLOW}⚠️ $services_down servizi non attivi. Avvio servizi base...${NC}"
        
        # Verifica Docker
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker non trovato!${NC}"
            echo "🐳 Installa Docker per continuare"
            exit 1
        fi
        
        # Avvia servizi
        echo "🐳 Avvio servizi Docker..."
        docker compose up -d
        
        # Attendi che i servizi siano pronti
        echo "⏳ Attesa avvio servizi (30 secondi)..."
        sleep 30
        
        # Verifica nuovamente
        services_still_down=0
        for port in 3001 3002 3003; do
            if ! nc -z localhost $port 2>/dev/null; then
                services_still_down=$((services_still_down + 1))
            fi
        done
        
        if [ $services_still_down -gt 0 ]; then
            echo -e "${RED}❌ $services_still_down servizi ancora non attivi!${NC}"
            echo "🔍 Controlla i log: docker compose logs"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Servizi base OK${NC}"
}

# Funzione per avviare il dashboard
start_dashboard() {
    echo -e "${YELLOW}🎯 Avvio dashboard amministratore...${NC}"
    
    cd admin-dashboard
    
    # Verifica che la porta 3006 sia libera
    if nc -z localhost 3006 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Porta 3006 già occupata. Terminazione processo esistente...${NC}"
        
        # Trova e termina processi React sulla porta 3006
        pkill -f "react-scripts start" || true
        sleep 2
        
        # Se ancora occupata, forza
        if nc -z localhost 3006 2>/dev/null; then
            echo "🔧 Terminazione forzata processi sulla porta 3006..."
            lsof -ti:3006 | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    fi
    
    echo -e "${GREEN}🌐 Avvio server sviluppo React...${NC}"
    echo -e "${BLUE}📊 Dashboard sarà disponibile su: http://localhost:3006${NC}"
    echo -e "${BLUE}🔐 Credenziali: admin / admin123${NC}"
    echo ""
    echo -e "${YELLOW}⏳ Avvio in corso... (può richiedere 30-60 secondi)${NC}"
    echo -e "${YELLOW}🛑 Premi Ctrl+C per fermare${NC}"
    echo ""
    
    # Avvia React in background e monitora
    BROWSER=none PORT=3006 npm start &
    REACT_PID=$!
    
    # Aspetta che il server sia pronto
    echo "🔄 Attesa server React..."
    for i in {1..60}; do
        if nc -z localhost 3006 2>/dev/null; then
            echo -e "${GREEN}✅ Dashboard avviato con successo!${NC}"
            echo ""
            echo "🌐 Accedi a: http://localhost:3006"
            echo "🔐 Username: admin"
            echo "🔐 Password: admin123"
            echo ""
            break
        fi
        
        # Mostra progresso
        if [ $((i % 10)) -eq 0 ]; then
            echo "⏳ Attesa... ($i/60 secondi)"
        fi
        
        sleep 1
    done
    
    # Verifica finale
    if ! nc -z localhost 3006 2>/dev/null; then
        echo -e "${RED}❌ Dashboard non si è avviato entro 60 secondi!${NC}"
        echo "🔍 Controlla i log sopra per errori"
        kill $REACT_PID 2>/dev/null || true
        exit 1
    fi
    
    # Trap per cleanup
    trap "echo ''; echo '🛑 Arresto dashboard...'; kill $REACT_PID 2>/dev/null; exit" INT TERM
    
    # Tieni in vita
    wait $REACT_PID
}

# Esecuzione principale
main() {
    check_prerequisites
    ensure_dependencies
    check_base_services
    start_dashboard
}

# Avvia se chiamato direttamente
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi