#!/bin/bash
# diagnose-admin.sh
# Script per diagnosticare problemi del dashboard admin

echo "🔍 DIAGNOSTICA DASHBOARD AMMINISTRATORE"
echo "=========================================="
echo ""

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Contatori
issues=0
checks=0

check_result() {
    local description=$1
    local result=$2
    checks=$((checks + 1))
    
    if [ "$result" = "OK" ]; then
        echo -e "✅ $description"
    else
        echo -e "❌ $description: $result"
        issues=$((issues + 1))
    fi
}

echo -e "${BLUE}1. VERIFICA PREREQUISITI${NC}"
echo "----------------------------------------"

# Verifica Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_result "Node.js installato" "OK ($NODE_VERSION)"
else
    check_result "Node.js installato" "NON TROVATO"
fi

# Verifica npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_result "npm installato" "OK ($NPM_VERSION)"
else
    check_result "npm installato" "NON TROVATO"
fi

echo ""
echo -e "${BLUE}2. VERIFICA STRUTTURA FILE${NC}"
echo "----------------------------------------"

# Verifica directory e file principali
if [ -d "admin-dashboard" ]; then
    check_result "Directory admin-dashboard" "OK"
else
    check_result "Directory admin-dashboard" "MANCANTE"
fi

if [ -f "admin-dashboard/package.json" ]; then
    check_result "package.json" "OK"
else
    check_result "package.json" "MANCANTE"
fi

if [ -f "admin-dashboard/src/index.js" ]; then
    check_result "src/index.js" "OK"
else
    check_result "src/index.js" "MANCANTE"
fi

if [ -f "admin-dashboard/src/AdminDashboard.js" ]; then
    check_result "AdminDashboard.js" "OK"
else
    check_result "AdminDashboard.js" "MANCANTE"
fi

echo ""
echo -e "${BLUE}3. VERIFICA DIPENDENZE${NC}"
echo "----------------------------------------"

if [ -d "admin-dashboard/node_modules" ]; then
    check_result "node_modules installato" "OK"
    
    # Controlla dipendenze specifiche
    if [ -d "admin-dashboard/node_modules/react" ]; then
        check_result "React installato" "OK"
    else
        check_result "React installato" "MANCANTE"
    fi
    
    if [ -d "admin-dashboard/node_modules/lucide-react" ]; then
        check_result "Lucide React installato" "OK"
    else
        check_result "Lucide React installato" "MANCANTE"
    fi
else
    check_result "node_modules installato" "MANCANTE"
fi

echo ""
echo -e "${BLUE}4. VERIFICA PORTE${NC}"
echo "----------------------------------------"

# Verifica porte sistema principale
for port in 3001 3002 3003; do
    if nc -z localhost $port 2>/dev/null; then
        check_result "Porta $port (sistema base)" "OK - ATTIVA"
    else
        check_result "Porta $port (sistema base)" "INATTIVA"
    fi
done

# Verifica porta admin dashboard
if nc -z localhost 3006 2>/dev/null; then
    check_result "Porta 3006 (admin dashboard)" "OK - ATTIVA"
else
    check_result "Porta 3006 (admin dashboard)" "INATTIVA"
fi

echo ""
echo -e "${BLUE}5. VERIFICA PROCESSI${NC}"
echo "----------------------------------------"

# Verifica processi Node.js in esecuzione
if pgrep -f "react-scripts start" > /dev/null; then
    check_result "Processo React in esecuzione" "OK"
else
    check_result "Processo React in esecuzione" "NON TROVATO"
fi

# Verifica Docker
if command -v docker &> /dev/null; then
    if docker compose ps | grep -q "Up"; then
        check_result "Servizi Docker" "OK - ATTIVI"
    else
        check_result "Servizi Docker" "INATTIVI O NON CONFIGURATI"
    fi
else
    check_result "Docker installato" "NON TROVATO"
fi

echo ""
echo -e "${BLUE}6. TEST CONNETTIVITA'${NC}"
echo "----------------------------------------"

# Test dei servizi base
for port in 3001 3002 3003; do
    if curl -s http://localhost:$port/api/health > /dev/null 2>&1; then
        check_result "Servizio localhost:$port/api/health" "OK"
    else
        check_result "Servizio localhost:$port/api/health" "NON RISPONDE"
    fi
done

echo ""
echo -e "${BLUE}RIEPILOGO DIAGNOSTICA${NC}"
echo "=========================================="

if [ $issues -eq 0 ]; then
    echo -e "${GREEN}✅ TUTTI I CONTROLLI SUPERATI ($checks/$checks)${NC}"
    echo "Il sistema dovrebbe funzionare correttamente."
    echo ""
    echo "Se il dashboard non è accessibile, prova:"
    echo "1. ./start-admin.sh dev"
    echo "2. Attendi qualche secondo per l'avvio"
    echo "3. Accedi a http://localhost:3006"
else
    echo -e "${RED}⚠️ PROBLEMI RILEVATI: $issues/$checks controlli falliti${NC}"
    echo ""
    echo -e "${YELLOW}🔧 SOLUZIONI SUGGERITE:${NC}"
    
    if ! command -v node &> /dev/null; then
        echo "📦 Installa Node.js:"
        echo "   - macOS: brew install node"
        echo "   - Ubuntu: sudo apt install nodejs npm"
        echo "   - Windows: scarica da nodejs.org"
        echo ""
    fi
    
    if [ ! -d "admin-dashboard" ]; then
        echo "📁 Crea struttura admin:"
        echo "   ./setup-admin.sh"
        echo ""
    fi
    
    if [ ! -d "admin-dashboard/node_modules" ]; then
        echo "📦 Installa dipendenze:"
        echo "   ./install-admin-deps.sh"
        echo ""
    fi
    
    # Controlla se i servizi base sono attivi
    services_down=0
    for port in 3001 3002 3003; do
        if ! nc -z localhost $port 2>/dev/null; then
            services_down=$((services_down + 1))
        fi
    done
    
    if [ $services_down -gt 0 ]; then
        echo "🐳 Avvia servizi base:"
        echo "   docker compose up -d"
        echo "   # Attendi 30 secondi per l'avvio"
        echo ""
    fi
    
    if ! nc -z localhost 3006 2>/dev/null; then
        echo "🚀 Avvia dashboard admin:"
        echo "   ./start-admin.sh dev"
        echo ""
    fi
fi

echo ""
echo -e "${BLUE}LOG E DEBUGGING${NC}"
echo "=========================================="

# Mostra log recenti se esistono
if [ -f "admin-logs/admin.log" ]; then
    echo "📄 Ultimi log admin:"
    tail -n 5 admin-logs/admin.log
    echo ""
fi

# Suggerimenti per il debugging
echo "🐛 Per debug avanzato:"
echo "   - Log React: guarda il terminale dove hai lanciato start-admin.sh"
echo "   - Log Docker: docker compose logs -f"
echo "   - Log sistema: journalctl -f"
echo "   - Test manuale: cd admin-dashboard && npm start"

echo ""
echo "📞 Se il problema persiste:"
echo "   1. ./reset-admin.sh (reset completo)"
echo "   2. ./setup-admin.sh (rifai setup)"
echo "   3. ./quick-setup.sh (setup automatico)"