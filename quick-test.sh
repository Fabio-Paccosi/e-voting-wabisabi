#!/bin/bash
# Script di test rapido del sistema

echo "===================================="
echo "Test Rapido Sistema E-Voting"
echo "===================================="
echo ""

# Funzione per test con output colorato
test_endpoint() {
    local name=$1
    local url=$2
    echo -n "Test $name: "
    
    if curl -f -s "$url" > /dev/null; then
        echo -e "\033[0;32m✓ OK\033[0m"
        return 0
    else
        echo -e "\033[0;31m✗ FAILED\033[0m"
        return 1
    fi
}

# Test health endpoints
test_endpoint "API Gateway Health" "http://localhost:3001/api/health"
test_endpoint "Auth Service Health" "http://localhost:3002/api/health"
test_endpoint "Vote Service Health" "http://localhost:3003/api/health"

echo ""
echo "Test registrazione utente..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "TestPass123!",
    "firstName": "Alice",
    "lastName": "Test",
    "taxCode": "RSSMRA85M01H501Z"
  }' 2>/dev/null)

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "\033[0;32m✓ Registrazione completata\033[0m"
else
    echo -e "\033[0;31m✗ Registrazione fallita\033[0m"
    echo "Risposta: $RESPONSE"
fi

echo ""
echo "Test completati!"
