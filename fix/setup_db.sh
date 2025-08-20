#!/bin/bash
# Script di diagnosi per problemi dashboard admin

echo " DIAGNOSI PROBLEMI DASHBOARD ADMIN"
echo "====================================="
echo ""

# 1. Stato container
echo "1.  STATO CONTAINER:"
docker compose ps
echo ""

# 2. Test connessione database
echo "2. 🗄️ TEST CONNESSIONE DATABASE:"
if docker compose exec -T postgres psql -U postgres -d evoting_wabisabi -c "SELECT 'Database OK' as status;" 2>/dev/null; then
    echo " Database connessione OK"
else
    echo " Database connessione FALLITA"
fi
echo ""

# 3. Verifica variabili ambiente nei container
echo "3. VARIABILI AMBIENTE AUTH SERVICE:"
docker compose exec -T auth-service printenv | grep -E "^DB_|^NODE_ENV" || echo " Variabili DB mancanti"
echo ""

echo "4. VARIABILI AMBIENTE VOTE SERVICE:"
docker compose exec -T vote-service printenv | grep -E "^DB_|^NODE_ENV" || echo " Variabili DB mancanti"
echo ""

# 5. Test API Health  
echo "5. TEST API HEALTH:"
for service in 3001:api-gateway 3002:auth-service 3003:vote-service; do
    port=$(echo $service | cut -d: -f1)
    name=$(echo $service | cut -d: -f2)
    
    if curl -s "http://localhost:$port/api/health" > /dev/null; then
        echo " $name: OK"
    else
        echo " $name: ERRORE"
    fi
done
echo ""

# 6. Test API Stats (senza autenticazione)
echo "6. 📈 TEST API STATS:"
stats_response=$(curl -s "http://localhost:3001/api/admin/stats" 2>/dev/null)
if echo "$stats_response" | grep -q "total\|count\|users"; then
    echo " API Stats funziona"
    echo " Risposta: $stats_response" | head -c 200
    echo "..."
else
    echo " API Stats non funziona"
    echo "📝 Risposta: $stats_response"
fi
echo ""

# 7. Logs recenti per errori database
echo "7. 📝 ERRORI DATABASE RECENTI:"
echo "Auth Service:"
docker compose logs auth-service 2>/dev/null | grep -E "(Error|errore||database)" | tail -3
echo ""
echo "Vote Service:"  
docker compose logs vote-service 2>/dev/null | grep -E "(Error|errore||database)" | tail -3
echo ""

# 8. Test login admin
echo "8. 🔐 TEST LOGIN ADMIN:"
login_response=$(curl -s -X POST "http://localhost:3001/api/admin/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin@example.com","password":"admin123"}' 2>/dev/null)

if echo "$login_response" | grep -q "token"; then
    echo " Login admin funziona"
    token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "🎫 Token ottenuto: ${token:0:20}..."
    
    # Test API con token
    echo ""
    echo "9. 🔑 TEST API CON TOKEN:"
    stats_with_token=$(curl -s -H "Authorization: Bearer $token" "http://localhost:3001/api/admin/stats" 2>/dev/null)
    if echo "$stats_with_token" | grep -q "total\|count"; then
        echo " API con token funziona"
    else
        echo " API con token non funziona"
        echo "📝 Risposta: $stats_with_token"
    fi
else
    echo " Login admin fallito"
    echo "📝 Risposta: $login_response"
fi

echo ""
echo "🏁 DIAGNOSI COMPLETATA"
echo "====================="