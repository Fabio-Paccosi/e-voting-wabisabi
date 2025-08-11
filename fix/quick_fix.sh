#!/bin/bash
# Fix completo per route /auth/verify mancante

echo "🔧 Fix route /auth/verify mancante..."

# 1. VERIFICA se la route esiste nell'API Gateway
echo "🔍 Controllo route esistenti nell'API Gateway..."
if grep -q "auth/verify" server1/routes/admin.js; then
    echo "✅ Route verify già presente nell'API Gateway"
else
    echo "❌ Route verify MANCANTE nell'API Gateway - aggiungendo..."
    
    # Backup
    cp server1/routes/admin.js server1/routes/admin.js.backup.verify
    
    # Aggiungi la route verify dopo la route login
    sed -i '/\/auth\/login.*async (req, res)/,/});/{
        /});/a\
\
// POST /api/admin/auth/verify - Verifica token\
router.post("/auth/verify", async (req, res) => {\
    try {\
        console.log("[API GATEWAY] Richiesta verifica token");\
        const response = await callService("auth", "/api/admin/auth/verify", "POST", req.body);\
        console.log("[API GATEWAY] ✓ Token verificato");\
        res.json(response);\
    } catch (error) {\
        console.error("[API GATEWAY] ✗ Errore verifica token:", error.message);\
        res.status(error.status || 500).json({ \
            error: "Errore nella verifica autenticazione",\
            details: error.originalError || error.message,\
            service: "auth"\
        });\
    }\
});\
\
// GET /api/admin/auth/verify - Supporta anche GET\
router.get("/auth/verify", async (req, res) => {\
    try {\
        const token = req.headers.authorization?.replace("Bearer ", "");\
        \
        if (!token) {\
            return res.status(401).json({ \
                valid: false, \
                error: "Token mancante" \
            });\
        }\
\
        console.log("[API GATEWAY] Richiesta verifica token via GET");\
        const response = await callService("auth", "/api/admin/auth/verify", "POST", { token });\
        console.log("[API GATEWAY] ✓ Token verificato via GET");\
        res.json(response);\
    } catch (error) {\
        console.error("[API GATEWAY] ✗ Errore verifica token via GET:", error.message);\
        res.status(error.status || 500).json({ \
            valid: false,\
            error: "Token non valido",\
            details: error.originalError || error.message\
        });\
    }\
});
    }' server1/routes/admin.js
    
    echo "✅ Route verify aggiunta all'API Gateway"
fi

# 2. VERIFICA che l'Auth Service abbia la route verify senza auth
echo ""
echo "🔍 Controllo route verify nell'Auth Service..."
if grep -A 10 "auth/verify" server2/routes/admin.js | grep -q "const adminAuth"; then
    echo "⚠️ Auth Service usa ancora middleware autenticazione - fixing..."
    
    # Backup
    cp server2/routes/admin.js server2/routes/admin.js.backup.verify
    
    # Sostituisci adminAuth con adminAuthSimple per la route verify
    sed -i 's/router\.post.*auth\/verify.*adminAuth/router.post("\/auth\/verify", async/' server2/routes/admin.js
    
    echo "✅ Auth Service route verify semplificata"
fi

# 3. ASSICURATI che Auth Service abbia la route verify
if ! grep -q "auth/verify" server2/routes/admin.js; then
    echo "❌ Route verify mancante in Auth Service - aggiungendo..."
    
    # Aggiungi route verify semplice
    cat >> server2/routes/admin.js << 'EOF'

// POST /api/admin/auth/verify - Verifica token (per chiamate interne)
router.post('/auth/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token mancante' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.role === 'administrator') {
            res.json({
                valid: true,
                user: {
                    id: decoded.id,
                    username: decoded.username,
                    role: decoded.role
                }
            });
        } else {
            res.status(401).json({ 
                valid: false, 
                error: 'Ruolo non autorizzato' 
            });
        }
    } catch (error) {
        console.error('❌ [AUTH ADMIN] Errore verifica token:', error);
        res.status(401).json({ 
            valid: false, 
            error: 'Token non valido' 
        });
    }
});
EOF
    echo "✅ Route verify aggiunta all'Auth Service"
fi

# 4. RIAVVIA i servizi
echo ""
echo "🔄 Riavviando servizi..."
docker compose restart api-gateway auth-service

echo "⏱️ Attendendo riavvio..."
sleep 15

# 5. TEST completo
echo ""
echo "🧪 Test completo delle route verify..."

echo "1. Test route verify API Gateway (POST):"
verify_response=$(curl -s -X POST "http://localhost:3001/api/admin/auth/verify" \
    -H "Content-Type: application/json" \
    -d '{"token":"invalid_token"}' 2>/dev/null)

if echo "$verify_response" | grep -q "valid"; then
    echo "   ✅ Route POST verify risponde"
else
    echo "   ❌ Route POST verify non risponde"
    echo "   📝 Risposta: $verify_response"
fi

echo ""
echo "2. Test route verify API Gateway (GET):"
verify_get_response=$(curl -s -H "Authorization: Bearer invalid_token" \
    "http://localhost:3001/api/admin/auth/verify" 2>/dev/null)

if echo "$verify_get_response" | grep -q "valid"; then
    echo "   ✅ Route GET verify risponde"
else
    echo "   ❌ Route GET verify non risponde"  
    echo "   📝 Risposta: $verify_get_response"
fi

echo ""
echo "3. Test stats dopo fix:"
stats_response=$(curl -s -H "Authorization: Bearer test-token" \
    "http://localhost:3001/api/admin/stats" 2>/dev/null)

if echo "$stats_response" | grep -q "total.*0"; then
    echo "   ✅ Stats funzionano ora!"
else
    echo "   ⚠️ Stats potrebbero ancora avere problemi"
    echo "   📝 Risposta: $stats_response"
fi

echo ""
echo "🎯 RISULTATO:"
echo "✅ Route /auth/verify aggiunta"
echo "🌐 Ricarica il dashboard nel browser"
echo "📊 Dovresti vedere 0 invece di NaN"
echo "🔐 Navigazione Utenti/Impostazioni dovrebbe funzionare"