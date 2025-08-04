#!/bin/bash
echo "🔄 Sincronizzazione whitelist dashboard admin -> servizio auth..."

# Controlla se il servizio auth è attivo
if ! curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "⚠️ Servizio autenticazione non attivo. Avvio servizi..."
    docker compose up -d
    echo "⏳ Attesa avvio servizi (10 secondi)..."
    sleep 10
fi

# Aggiorna server2/app.js con gli utenti della whitelist admin
echo "📝 Aggiornamento whitelist nel servizio di autenticazione..."

# Backup del file originale se non esiste già
if [ -f "server2/app.js" ] && [ ! -f "server2/app.js.backup" ]; then
    cp server2/app.js server2/app.js.backup
    echo "✅ Backup creato: server2/app.js.backup"
fi

# Aggiorna la whitelist di test nel servizio auth
if [ -f "server2/app.js" ]; then
    # Usa sed per aggiornare la sezione testVoters
    # Questo è un approccio semplificato - in produzione useresti API
    
    echo "🔧 Aggiornamento utenti autorizzati..."
    
    # Crea un file temporaneo con la nuova whitelist
    cat > temp_whitelist.js << 'INNER_EOF'
        const testVoters = [
            { email: 'alice@example.com', taxCode: 'RSSMRA85M01H501Z' },
            { email: 'bob@example.com', taxCode: 'VRDGPP90L15H501A' },
            { email: 'charlie@example.com', taxCode: 'BNCLRA88S20H501B' },
            { email: 'test@example.com', taxCode: 'RSSMRA85M01H501Z' },
            { email: 'mario.rossi@example.com', taxCode: 'RSSMRA80A01H501X' },
            { email: 'admin@evoting.local', taxCode: 'ADMINTEST001234' }
        ];
INNER_EOF
    
    # Sostituisce la sezione testVoters nel file
    if grep -q "testVoters = \[" server2/app.js; then
        # Trova le righe e sostituisce
        sed -i.tmp '/const testVoters = \[/,/\];/{
            /const testVoters = \[/r temp_whitelist.js
            /const testVoters = \[/,/\];/d
        }' server2/app.js && rm server2/app.js.tmp
        
        echo "✅ Whitelist aggiornata nel servizio auth"
    else
        echo "⚠️ Pattern testVoters non trovato in server2/app.js"
    fi
    
    rm temp_whitelist.js
fi

# Riavvia il servizio auth per applicare le modifiche
if docker compose ps | grep -q "auth-service"; then
    echo "🔄 Riavvio servizio autenticazione per applicare modifiche..."
    docker compose restart auth-service
    
    # Attendi che il servizio sia pronto
    echo "⏳ Attesa riavvio servizio..."
    sleep 8
    
    # Verifica che il servizio sia attivo
    if curl -s http://localhost:3002/api/health > /dev/null; then
        echo "✅ Servizio autenticazione riavviato correttamente"
    else
        echo "⚠️ Il servizio potrebbe non essere ancora pronto"
    fi
fi

echo ""
echo "📊 Utenti ora autorizzati a registrarsi:"
echo "   ✅ alice@example.com (RSSMRA85M01H501Z)"
echo "   ✅ bob@example.com (VRDGPP90L15H501A)"
echo "   ✅ charlie@example.com (BNCLRA88S20H501B)"
echo "   ✅ test@example.com (RSSMRA85M01H501Z) ← Per i test"
echo "   ✅ mario.rossi@example.com (RSSMRA80A01H501X)"
echo "   ✅ admin@evoting.local (ADMINTEST001234)"
echo ""
echo "🧪 Ora puoi testare con: ./quick-test.sh"
echo "🎯 O accedere al dashboard admin: http://localhost:3006"
