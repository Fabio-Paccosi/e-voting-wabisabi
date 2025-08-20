#!/bin/bash
# test-server1-proxy.sh - Test proxy Server 1 verso Server 2

echo "🔗 Test Proxy Server 1 → Server 2"
echo "================================="

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1. Test comunicazione diretta Server 1 → Server 2:${NC}"

# Test se il Server 1 può raggiungere il Server 2
echo -n "  Server 1 può raggiungere Server 2: "
if curl -s "http://localhost:3002/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ ERRORE${NC}"
fi

echo ""
echo -e "${YELLOW}2. Test route problematiche via Server 1:${NC}"

# Test login via Server 1 (questo dovrebbe restituire 500)
echo "  Login via Server 1:"
echo -n "    Status: "
response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "http://localhost:3001/api/admin/auth/login" 2>/dev/null)

echo "$response"

echo "    Response body:"
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' \
    "http://localhost:3001/api/admin/auth/login" 2>/dev/null | jq . 2>/dev/null || echo "    (Non-JSON response)"

echo ""
echo "  Stats via Server 1:"
echo -n "    Status: "
response=$(curl -s -w "%{http_code}" \
    "http://localhost:3001/api/admin/stats" 2>/dev/null)
echo "$response"

echo "    Response body:"
curl -s "http://localhost:3001/api/admin/stats" 2>/dev/null | jq . 2>/dev/null || echo "    (Non-JSON response)"

echo ""
echo -e "${YELLOW}3. Test variabili ambiente Server 1:${NC}"
echo "  Checking environment variables..."
curl -s "http://localhost:3001/api/health" | jq .env 2>/dev/null || echo "  No env info available"

echo ""
echo "🎯 Test Proxy completato!"