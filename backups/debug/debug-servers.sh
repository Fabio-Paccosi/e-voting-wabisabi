#!/bin/bash
# debug-servers.sh - Verifica stato dei server

echo "🔍 Debug Server WabiSabi"
echo "========================"

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verifica porte in ascolto
echo -e "${YELLOW}1. Verifica porte in ascolto:${NC}"
for port in 3001 3002 3003; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "  ✓ Porta $port: ${GREEN}IN ASCOLTO${NC}"
    else
        echo -e "  ✗ Porta $port: ${RED}LIBERA${NC}"
    fi
done

echo ""
echo -e "${YELLOW}2. Test connettività base:${NC}"

# Test connettività
for port in 3001 3002 3003; do
    if curl -s "http://localhost:$port/api/health" >/dev/null 2>&1; then
        echo -e "  ✓ Server $port: ${GREEN}RISPONDE${NC}"
    else
        echo -e "  ✗ Server $port: ${RED}NON RISPONDE${NC}"
    fi
done

echo ""
echo -e "${YELLOW}3. Test route admin specifiche:${NC}"

# Test route problematiche
echo -n "  Login (POST): "
login_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "http://localhost:3001/api/admin/auth/login" 2>/dev/null)

if [[ "$login_response" == *"200" ]]; then
    echo -e "${GREEN}✓ OK${NC}"
elif [[ "$login_response" == *"500" ]]; then
    echo -e "${RED}✗ ERRORE 500${NC}"
elif [[ "$login_response" == *"404" ]]; then
    echo -e "${RED}✗ ERRORE 404${NC}"
else
    echo -e "${RED}✗ ALTRO ERRORE ($login_response)${NC}"
fi

echo -n "  Verify (POST): "
verify_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"token":"test"}' \
    "http://localhost:3001/api/admin/auth/verify" 2>/dev/null)

if [[ "$verify_response" == *"200" ]] || [[ "$verify_response" == *"401" ]]; then
    echo -e "${GREEN}✓ OK${NC}"
elif [[ "$verify_response" == *"404" ]]; then
    echo -e "${RED}✗ ERRORE 404${NC}"
else
    echo -e "${RED}✗ ALTRO ERRORE ($verify_response)${NC}"
fi

echo ""
echo -e "${YELLOW}4. Test comunicazione tra server:${NC}"

# Test server 2 diretto
echo -n "  Server 2 diretto: "
if curl -s "http://localhost:3002/api/admin/stats" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ ERRORE${NC}"
fi

# Test server 3 diretto
echo -n "  Server 3 diretto: "
if curl -s "http://localhost:3003/api/admin/stats" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ ERRORE${NC}"
fi

echo ""
echo "🎯 Debug completato!"