#!/bin/bash
# Script per testare il dashboard amministratore

echo "🧪 Test Dashboard Amministratore..."

# Verifica servizi attivi
echo "1. Verifica servizi base..."
curl -s http://localhost:3001/api/health || echo "❌ API Gateway non raggiungibile"
curl -s http://localhost:3002/api/health || echo "❌ Auth Service non raggiungibile"
curl -s http://localhost:3003/api/health || echo "❌ Vote Service non raggiungibile"

# Test login admin
echo "2. Test login amministratore..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
    echo "✅ Login admin funzionante"
    
    # Estrai token
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    # Test statistiche
    echo "3. Test recupero statistiche..."
    STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3001/api/admin/stats)
    
    if echo "$STATS_RESPONSE" | grep -q "totalElections"; then
        echo "✅ Statistiche recuperate correttamente"
    else
        echo "❌ Errore recupero statistiche"
    fi
    
    # Test whitelist
    echo "4. Test gestione whitelist..."
    WHITELIST_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3001/api/admin/whitelist)
    
    if echo "$WHITELIST_RESPONSE" | grep -q "whitelist"; then
        echo "✅ Whitelist accessibile"
    else
        echo "❌ Errore accesso whitelist"
    fi
    
else
    echo "❌ Login admin fallito"
fi

echo "🏁 Test completati!"
