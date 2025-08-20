#!/bin/bash
# test-server2-direct.sh - Test diretto del Server 2

echo "🧪 Test Diretto Server 2 (Auth Service)"
echo "========================================"

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1. Test route admin dirette sul Server 2:${NC}"

# Test login diretto su server 2
echo -n "  POST /api/admin/auth/login: "
response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "http://localhost:3002/api/admin/auth/login" 2>/dev/null)

if [[ "$response" == *"200"* ]]; then
    echo -e "${GREEN}✓ OK (200)${NC}"
elif [[ "$response" == *"404"* ]]; then
    echo -e "${RED}✗ NOT FOUND (404)${NC}"
elif [[ "$response" == *"500"* ]]; then
    echo -e "${RED}✗ SERVER ERROR (500)${NC}"
else
    echo -e "${RED}✗ OTHER ($response)${NC}"
fi

# Test verify diretto su server 2
echo -n "  POST /api/admin/auth/verify: "
response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"token":"test-token"}' \
    "http://localhost:3002/api/admin/auth/verify" 2>/dev/null)

if [[ "$response" == *"200"* ]] || [[ "$response" == *"401"* ]]; then
    echo -e "${GREEN}✓ OK ($response)${NC}"
elif [[ "$response" == *"404"* ]]; then
    echo -e "${RED}✗ NOT FOUND (404)${NC}"
else
    echo -e "${RED}✗ OTHER ($response)${NC}"
fi

# Test stats diretto su server 2
echo -n "  GET /api/admin/stats: "
response=$(curl -s -w "%{http_code}" \
    "http://localhost:3002/api/admin/stats" 2>/dev/null)

if [[ "$response" == *"200"* ]]; then
    echo -e "${GREEN}✓ OK (200)${NC}"
elif [[ "$response" == *"404"* ]]; then
    echo -e "${RED}✗ NOT FOUND (404)${NC}"
else
    echo -e "${RED}✗ OTHER ($response)${NC}"
fi

echo ""
echo -e "${YELLOW}2. Test dettagliato con output completo:${NC}"

echo "  Login response:"
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "http://localhost:3002/api/admin/auth/login" | jq . 2>/dev/null || echo "  (Response non-JSON o errore)"

echo ""
echo "  Stats response:"
curl -s "http://localhost:3002/api/admin/stats" | jq . 2>/dev/null || echo "  (Response non-JSON o errore)"

echo ""
echo "🎯 Test Server 2 completato!"