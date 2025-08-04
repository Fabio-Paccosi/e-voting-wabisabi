#!/bin/bash
# create-missing-admin-scripts.sh
# Crea gli script mancanti per il dashboard amministratore

echo "📦 Creazione script amministratore mancanti..."

# 1. Crea install-admin-deps.sh
cat > install-admin-deps.sh << 'EOF'
#!/bin/bash
echo "📦 Installazione dipendenze dashboard amministratore..."

# Verifica Node.js
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trovato. Installa Node.js prima di continuare."
    echo "💡 Scarica da: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) trovato"

# Vai nella directory admin-dashboard
cd admin-dashboard

# Verifica se package.json esiste
if [ ! -f "package.json" ]; then
    echo "❌ package.json non trovato. Esegui prima setup-admin.sh"
    exit 1
fi

# Installa dipendenze
echo "⬇️ Download e installazione dipendenze React..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dipendenze installate con successo!"
    echo ""
    echo "📋 Dipendenze installate:"
    echo "   - React 18.x"
    echo "   - Tailwind CSS"
    echo "   - Lucide React (icone)"
    echo "   - Axios (HTTP client)"
    echo ""
    echo "🚀 Ora puoi avviare il dashboard con:"
    echo "   ./start-admin.sh dev"
    echo ""
else
    echo "❌ Errore durante l'installazione delle dipendenze"
    echo "💡 Prova a eliminare node_modules e riprovare:"
    echo "   rm -rf node_modules package-lock.json"
    echo "   npm install"
    exit 1
fi
EOF

# 2. Crea sync-whitelist.sh
cat > sync-whitelist.sh << 'EOF'
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
EOF

# 3. Crea script di verifica setup
cat > verify-admin-setup.sh << 'EOF'
#!/bin/bash
echo "🔍 Verifica setup dashboard amministratore..."

# Variabili per conteggi
missing_files=0
total_checks=0

# Funzione per verificare file
check_file() {
    local file=$1
    local description=$2
    total_checks=$((total_checks + 1))
    
    if [ -f "$file" ]; then
        echo "✅ $description: $file"
    else
        echo "❌ $description: $file (MANCANTE)"
        missing_files=$((missing_files + 1))
    fi
}

# Funzione per verificare directory
check_dir() {
    local dir=$1
    local description=$2
    total_checks=$((total_checks + 1))
    
    if [ -d "$dir" ]; then
        echo "✅ $description: $dir/"
    else
        echo "❌ $description: $dir/ (MANCANTE)"
        missing_files=$((missing_files + 1))
    fi
}

echo ""
echo "📁 Verifica struttura file..."

# Verifica directory principali
check_dir "admin-dashboard" "Directory dashboard"
check_dir "admin-dashboard/src" "Directory sorgenti React"
check_dir "admin-dashboard/public" "Directory file pubblici"
check_dir "admin-config" "Directory configurazione"

echo ""
echo "📄 Verifica file configurazione..."

# Verifica file di configurazione
check_file "admin-dashboard/package.json" "Package.json React"
check_file "admin-dashboard/tailwind.config.js" "Configurazione Tailwind"
check_file "admin-dashboard/Dockerfile" "Dockerfile"
check_file "admin-config/admin.env" "File ambiente admin"
check_file "admin-config/nginx.conf" "Configurazione Nginx"

echo ""
echo "⚛️ Verifica componenti React..."

# Verifica componenti React
check_file "admin-dashboard/src/index.js" "Entry point React"
check_file "admin-dashboard/src/App.js" "Componente App"
check_file "admin-dashboard/src/AdminDashboard.js" "Componente Dashboard"
check_file "admin-dashboard/src/index.css" "CSS principale"

echo ""
echo "🛠️ Verifica script..."

# Verifica script
check_file "start-admin.sh" "Script avvio dashboard"
check_file "install-admin-deps.sh" "Script installazione dipendenze"
check_file "sync-whitelist.sh" "Script sincronizzazione"
check_file "quick-test.sh" "Script test sistema"

echo ""
echo "🐳 Verifica configurazione Docker..."

# Verifica Docker
check_file "docker-compose.admin.yml" "Docker Compose admin"

echo ""
echo "📊 RIEPILOGO VERIFICA:"
if [ $missing_files -eq 0 ]; then
    echo "✅ Setup completo! Tutti i file sono presenti ($total_checks/$total_checks)"
    echo ""
    echo "🚀 Prossimi passi:"
    echo "   1. ./install-admin-deps.sh"
    echo "   2. ./sync-whitelist.sh"
    echo "   3. ./start-admin.sh dev"
else
    echo "⚠️ Setup incompleto: $missing_files/$total_checks file mancanti"
    echo ""
    echo "🔧 Per completare il setup:"
    echo "   ./setup-admin.sh  # Riesegui setup principale"
fi

# Verifica servizi Docker se disponibili
echo ""
echo "🐳 Verifica servizi Docker..."
if command -v docker &> /dev/null; then
    if docker compose ps &> /dev/null; then
        echo "✅ Docker Compose disponibile"
        docker compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}"
    else
        echo "⚠️ Docker Compose non configurato o servizi non avviati"
    fi
else
    echo "⚠️ Docker non installato"
fi

# Verifica porte
echo ""
echo "📡 Verifica porte..."
for port in 3001 3002 3003; do
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ Porta $port: OCCUPATA (servizio attivo)"
    else
        echo "⚠️ Porta $port: LIBERA (servizio non attivo)"
    fi
done
EOF

# 4. Crea script di reset completo
cat > reset-admin.sh << 'EOF'
#!/bin/bash
echo "🔄 Reset completo dashboard amministratore..."

read -p "Sei sicuro di voler resettare tutto il setup admin? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset annullato"
    exit 1
fi

echo "🛑 Stop container admin..."
docker compose -f docker-compose.admin.yml down 2>/dev/null || true

echo "🗑️ Rimozione immagini Docker admin..."
docker rmi wabisabi_evoting-admin-dashboard 2>/dev/null || true

echo "🧹 Pulizia file build..."
rm -rf admin-dashboard/node_modules
rm -rf admin-dashboard/build
rm -rf admin-dashboard/package-lock.json

echo "📁 Rimozione directory temporanee..."
rm -rf admin-logs

echo "🔄 Ripristino backup server2/app.js..."
if [ -f "server2/app.js.backup" ]; then
    cp server2/app.js.backup server2/app.js
    echo "✅ server2/app.js ripristinato"
fi

echo ""
echo "✅ Reset completato!"
echo ""
echo "🔄 Per rifare il setup completo:"
echo "   1. ./setup-admin.sh"
echo "   2. ./install-admin-deps.sh" 
echo "   3. ./sync-whitelist.sh"
echo "   4. ./start-admin.sh dev"
EOF

# 5. Crea quick-setup.sh per setup veloce
cat > quick-setup.sh << 'EOF'
#!/bin/bash
echo "⚡ Setup veloce dashboard amministratore..."

# Esegui tutti gli step in sequenza
echo "1/4 - Verifica setup esistente..."
if [ ! -f "verify-admin-setup.sh" ]; then
    echo "❌ Script di verifica non trovato. Esegui prima setup-admin.sh"
    exit 1
fi

echo "2/4 - Installazione dipendenze..."
./install-admin-deps.sh

echo "3/4 - Sincronizzazione whitelist..."
./sync-whitelist.sh

echo "4/4 - Avvio dashboard..."
echo "🚀 Avvio dashboard in modalità sviluppo..."
echo "📱 Dashboard disponibile su: http://localhost:3006"
echo "🔐 Credenziali: admin / admin123"
echo ""

./start-admin.sh dev
EOF

# Rendi tutti gli script eseguibili
chmod +x install-admin-deps.sh
chmod +x sync-whitelist.sh  
chmod +x verify-admin-setup.sh
chmod +x reset-admin.sh
chmod +x quick-setup.sh

echo "✅ Script amministratore creati:"
echo "   📦 install-admin-deps.sh - Installa dipendenze React"
echo "   🔄 sync-whitelist.sh - Sincronizza utenti autorizzati"
echo "   🔍 verify-admin-setup.sh - Verifica setup completo"
echo "   🔄 reset-admin.sh - Reset completo setup"
echo "   ⚡ quick-setup.sh - Setup veloce tutto-in-uno"
echo ""
echo "🚀 Ora puoi eseguire:"
echo "   ./install-admin-deps.sh"
echo "   ./sync-whitelist.sh"
echo "   ./start-admin.sh dev"
echo ""
echo "💡 Oppure setup veloce: ./quick-setup.sh"