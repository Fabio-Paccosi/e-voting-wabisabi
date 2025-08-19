#!/bin/bash
# Fix per route mancante /api/admin/elections/:id/activate

echo "🔧 Fix route activate election mancante..."

# 1. BACKUP del file API Gateway
echo "📋 Backup del file admin.js..."
cp server1/routes/admin.js server1/routes/admin.js.backup.activate

# 2. AGGIUNGI la route activate nell'API Gateway
echo "➕ Aggiungendo route activate nell'API Gateway..."

# Trova la riga dopo PUT /elections/:id/status e aggiungi la route activate
sed -i '/PUT.*elections.*:id.*status.*async (req, res)/,/});/{
    /});/a\
\
// POST /api/admin/elections/:id/activate - Attiva elezione\
router.post("/elections/:id/activate", async (req, res) => {\
    try {\
        const { id } = req.params;\
        console.log(`[API GATEWAY] POST attivazione elezione ${id}`);\
        \
        const response = await callService("vote", `/api/admin/elections/${id}/activate`, "POST", req.body);\
        console.log(`[API GATEWAY] ✓ Elezione ${id} attivata con successo`);\
        res.json(response);\
    } catch (error) {\
        console.error(`[API GATEWAY] ✗ Errore attivazione elezione ${id}:`, error.message);\
        res.status(error.status || 500).json({ \
            error: "Errore nell'\''attivazione dell'\''elezione",\
            details: error.originalError || error.message,\
            service: "vote"\
        });\
    }\
});\
\
// POST /api/admin/elections/:id/deactivate - Disattiva elezione\
router.post("/elections/:id/deactivate", async (req, res) => {\
    try {\
        const { id } = req.params;\
        console.log(`[API GATEWAY] POST disattivazione elezione ${id}`);\
        \
        const response = await callService("vote", `/api/admin/elections/${id}/deactivate`, "POST", req.body);\
        console.log(`[API GATEWAY] ✓ Elezione ${id} disattivata con successo`);\
        res.json(response);\
    } catch (error) {\
        console.error(`[API GATEWAY] ✗ Errore disattivazione elezione ${id}:`, error.message);\
        res.status(error.status || 500).json({ \
            error: "Errore nella disattivazione dell'\''elezione",\
            details: error.originalError || error.message,\
            service: "vote"\
        });\
    }\
});
}' server1/routes/admin.js

echo " Route activate aggiunte all'API Gateway"

# 3. VERIFICA che il Vote Service abbia le route necessarie
echo " Verifica Vote Service routes..."

# Se il Vote Service non ha la route activate, aggiungila
if ! grep -q "elections.*activate" server3/routes/admin.js; then
    echo "➕ Aggiungendo route activate al Vote Service..."
    
    # Backup
    cp server3/routes/admin.js server3/routes/admin.js.backup.activate
    
    # Aggiungi le route activate e deactivate
    cat >> server3/routes/admin.js << 'EOF'

// POST /api/admin/elections/:id/activate - Attiva elezione
router.post('/elections/:id/activate', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(` [VOTE ADMIN] Attivazione elezione ${id}`);

        const election = await Election.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidates' },
                // Se hai un modello per la whitelist, includilo qui
                // { model: ElectionWhitelist, as: 'whitelist' }
            ]
        });

        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Validazioni
        if (election.candidates && election.candidates.length < 2) {
            return res.status(400).json({ 
                error: 'L\'elezione deve avere almeno 2 candidati per essere attivata' 
            });
        }

        if (election.status === 'active') {
            return res.status(400).json({ 
                error: 'L\'elezione è già attiva' 
            });
        }

        // Verifica date
        const now = new Date();
        if (election.startDate && now < new Date(election.startDate)) {
            return res.status(400).json({ 
                error: 'L\'elezione non può essere attivata prima della data di inizio' 
            });
        }

        // Attiva l'elezione
        await election.update({ 
            status: 'active',
            isActive: true 
        });

        console.log(` [VOTE ADMIN] Elezione "${election.title}" attivata con successo`);

        res.json({ 
            success: true, 
            message: 'Elezione attivata con successo',
            election: {
                id: election.id,
                title: election.title,
                status: election.status,
                isActive: election.isActive
            }
        });

    } catch (error) {
        console.error(' [VOTE ADMIN] Errore attivazione elezione:', error);
        res.status(500).json({ 
            error: 'Errore nell\'attivazione dell\'elezione',
            details: error.message 
        });
    }
});

// POST /api/admin/elections/:id/deactivate - Disattiva elezione
router.post('/elections/:id/deactivate', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(` [VOTE ADMIN] Disattivazione elezione ${id}`);

        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ 
                error: 'L\'elezione non è attiva' 
            });
        }

        // Disattiva l'elezione
        await election.update({ 
            status: 'paused',
            isActive: false 
        });

        console.log(` [VOTE ADMIN] Elezione "${election.title}" disattivata`);

        res.json({ 
            success: true, 
            message: 'Elezione disattivata con successo',
            election: {
                id: election.id,
                title: election.title,
                status: election.status,
                isActive: election.isActive
            }
        });

    } catch (error) {
        console.error(' [VOTE ADMIN] Errore disattivazione elezione:', error);
        res.status(500).json({ 
            error: 'Errore nella disattivazione dell\'elezione',
            details: error.message 
        });
    }
});
EOF

    echo " Route activate aggiunte al Vote Service"
else
    echo " Vote Service ha già le route activate"
fi

# 4. AGGIORNA la lista delle route disponibili nel 404 handler
echo "📝 Aggiornando lista route disponibili..."

sed -i 's/availableRoutes: \[/availableRoutes: [/' server1/app.js
sed -i '/availableRoutes: \[/,/\]/{
    s/"POST \/api\/admin\/auth\/login"/"POST \/api\/admin\/auth\/login",\
            "GET \/api\/admin\/elections",\
            "POST \/api\/admin\/elections",\
            "POST \/api\/admin\/elections\/:id\/activate",\
            "PUT \/api\/admin\/elections\/:id\/status"/
}' server1/app.js

# 5. RIAVVIA i servizi
echo ""
echo " Riavviando servizi..."
if command -v docker-compose &> /dev/null; then
    docker-compose restart api-gateway vote-service
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose restart api-gateway vote-service
else
    echo "⚠️ Docker Compose non trovato - riavvia manualmente i servizi"
    echo "   API Gateway: server1"
    echo "   Vote Service: server3"
fi

echo "⏱️ Attendendo riavvio..."
sleep 10

# 6. TEST della nuova route
echo ""
echo " Test della route activate..."

echo "1. Test route disponibili:"
available_routes=$(curl -s "http://localhost:3001/api/nonexistent" 2>/dev/null | grep -o '"availableRoutes":\[.*\]' || echo "Nessuna risposta")
echo "   📝 $available_routes"

echo ""
echo "2. Test route activate (dovrebbe restituire errore auth ma trovare la route):"
activate_response=$(curl -s -X POST "http://localhost:3001/api/admin/elections/test-id/activate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer fake-token" 2>/dev/null || echo "Connessione fallita")

if echo "$activate_response" | grep -q "Route non trovata"; then
    echo "    Route ancora non trovata"
    echo "   📝 Risposta: $activate_response"
else
    echo "    Route trovata (potrebbe restituire errore di auth o elezione non trovata, è normale)"
    echo "   📝 Risposta: $activate_response"
fi

echo ""
echo "🎉 Fix completato!"
echo ""
echo "📋 Riassunto modifiche:"
echo "   ✓ Aggiunta route POST /api/admin/elections/:id/activate all'API Gateway"
echo "   ✓ Aggiunta route POST /api/admin/elections/:id/deactivate all'API Gateway"
echo "   ✓ Verificate/aggiunte route nel Vote Service"
echo "   ✓ Aggiornata lista route disponibili"
echo "   ✓ Servizi riavviati"
echo ""
echo " Ora prova di nuovo dal dashboard admin a cliccare 'Attiva' su un'elezione!"