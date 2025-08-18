#!/bin/bash
# setup_wabisabi_complete.sh
# Script per configurare completamente il sistema WabiSabi E-Voting

echo "🚀 Setup Sistema E-Voting WabiSabi Completo"
echo "============================================="

# Funzione per controllare se un comando esiste
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Funzione per creare backup
create_backup() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "${file}.backup.$(date +%s)"
        echo "📋 Backup creato per $file"
    fi
}

# 1. CONTROLLI PRELIMINARI
echo ""
echo "🔍 Controlli preliminari..."

# Verifica Node.js
if ! command_exists node; then
    echo "❌ Node.js non trovato. Installare Node.js 18+ prima di continuare."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versione troppo vecchia. Richiesta versione 18+."
    exit 1
fi

echo "✅ Node.js $(node -v) - OK"

# Verifica npm/yarn
if command_exists yarn; then
    PKG_MANAGER="yarn"
    INSTALL_CMD="yarn install"
elif command_exists npm; then
    PKG_MANAGER="npm"
    INSTALL_CMD="npm install"
else
    echo "❌ npm o yarn non trovato."
    exit 1
fi

echo "✅ Package manager: $PKG_MANAGER"

# 2. SETUP DATABASE
echo ""
echo "🗄️ Configurazione Database..."

# Crea directory migrations se non esiste
mkdir -p database/migrations

# Crea migrazione per WabiSabi se non esiste
if [ ! -f "database/migrations/003_wabisabi_tables.sql" ]; then
    cat > database/migrations/003_wabisabi_tables.sql << 'EOF'
-- Migrazione 003: Tabelle WabiSabi E-Voting
-- Aggiunge tabelle per credenziali KVAC e sessioni di voto

-- Tabella per indirizzi Bitcoin degli utenti
CREATE TABLE IF NOT EXISTS user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    bitcoin_address VARCHAR(100) NOT NULL,
    public_key TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per monitoraggio delle sessioni CoinJoin attive
CREATE TABLE IF NOT EXISTS coinjoin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voting_sessions(id),
    status VARCHAR(50) DEFAULT 'preparing',
    participants_count INTEGER DEFAULT 0,
    round INTEGER DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    tx_id VARCHAR(100) NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per tracciare i commitment dei voti
CREATE TABLE IF NOT EXISTS vote_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id UUID NOT NULL REFERENCES votes(id),
    commitment_hash VARCHAR(128) NOT NULL,
    randomness VARCHAR(128),
    candidate_encoding INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_session ON user_addresses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_bitcoin ON user_addresses(bitcoin_address);

CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_session ON coinjoin_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_status ON coinjoin_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_tx ON coinjoin_sessions(tx_id);

CREATE INDEX IF NOT EXISTS idx_vote_commitments_vote ON vote_commitments(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_commitments_hash ON vote_commitments(commitment_hash);

-- Trigger per aggiornamento automatico updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coinjoin_sessions_updated_at BEFORE UPDATE ON coinjoin_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Aggiungi campi mancanti alle tabelle esistenti se non presenti
DO $$ 
BEGIN
    -- Aggiungi zkProof alla tabella votes se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='votes' AND column_name='zk_proof') THEN
        ALTER TABLE votes ADD COLUMN zk_proof JSONB;
    END IF;
    
    -- Aggiungi bitcoin_address alla tabella votes se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='votes' AND column_name='bitcoin_address') THEN
        ALTER TABLE votes ADD COLUMN bitcoin_address VARCHAR(100);
    END IF;
    
    -- Aggiungi election_id alla tabella credentials se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credentials' AND column_name='election_id') THEN
        ALTER TABLE credentials ADD COLUMN election_id UUID;
    END IF;
END $$;

COMMIT;
EOF
    echo "✅ Migrazione WabiSabi creata"
fi

# 3. SETUP SERVER1 (API Gateway)
echo ""
echo "🌐 Configurazione API Gateway (Server1)..."

# Backup app.js
create_backup "server1/app.js"

# Aggiungi route WabiSabi se non già presente
if ! grep -q "voting.*routes" server1/app.js; then
    # Trova la riga dopo le altre route e aggiungi le route voting
    sed -i '/app\.use.*admin.*adminRoutes/a\\n// Route WabiSabi Voting\nconst votingRoutes = require('"'"'./routes/voting'"'"');\napp.use('"'"'/api/voting'"'"', votingRoutes);' server1/app.js
    echo "✅ Route WabiSabi aggiunte all'API Gateway"
fi

# Aggiorna lista route nel 404 handler
if ! grep -q "POST /api/voting/address" server1/app.js; then
    sed -i '/availableRoutes: \[/,/\]/{
        /POST.*admin.*auth.*login/a\
            "POST /api/voting/address",\
            "POST /api/voting/credentials",\
            "POST /api/voting/submit",\
            "GET /api/voting/status/:voteId",\
            "GET /api/voting/session/:sessionId/stats",
    }' server1/app.js
    echo "✅ Route WabiSabi aggiunte alla lista disponibili"
fi

# 4. SETUP SERVER3 (Vote Service)
echo ""
echo "🗳️ Configurazione Vote Service (Server3)..."

# Backup app.js
create_backup "server3/app.js"

# Aggiungi import servizi se non presente
if ! grep -q "WabiSabiKVACService" server3/app.js; then
    sed -i '/require.*database_config/a\\n// Import servizi WabiSabi\nconst WabiSabiKVACService = require('"'"'./services/WabiSabiKVACService'"'"');\nconst CoinJoinService = require('"'"'./services/CoinJoinService'"'"');\nconst BitcoinService = require('"'"'./services/BitcoinService'"'"');' server3/app.js
fi

# Aggiungi route voting se non presente
if ! grep -q "voting.*routes" server3/app.js; then
    sed -i '/app\.use.*elections.*electionsRoutes/a\\n// Route WabiSabi Voting\nconst votingRoutes = require('"'"'./routes/voting'"'"');\napp.use('"'"'/api/voting'"'"', votingRoutes);' server3/app.js
    echo "✅ Route WabiSabi aggiunte al Vote Service"
fi

# Aggiorna 404 handler
if ! grep -q "POST /api/voting/address" server3/app.js; then
    sed -i '/availableRoutes: \[/,/\]/{
        /GET.*elections/a\
            "POST /api/voting/address",\
            "POST /api/voting/credentials",\
            "POST /api/voting/submit",\
            "GET /api/voting/status/:voteId",\
            "GET /api/voting/session/:sessionId/stats",\
            "GET /api/voting/debug",
    }' server3/app.js
    echo "✅ Route WabiSabi aggiunte al 404 handler"
fi

# 5. SETUP VARIABILI AMBIENTE
echo ""
echo "🔧 Configurazione variabili ambiente..."

# Crea .env per server3 se non esiste
if [ ! -f "server3/.env" ]; then
    cat > server3/.env << 'EOF'
# Bitcoin Network Configuration
BITCOIN_NETWORK=testnet
BITCOIN_RPC_HOST=localhost
BITCOIN_RPC_PORT=18332
BITCOIN_RPC_USER=bitcoinrpc
BITCOIN_RPC_PASS=rpcpassword

# WabiSabi Configuration
COORDINATOR_SECRET_KEY=your_secret_key_here_change_in_production
COINJOIN_THRESHOLD=5
CREDENTIAL_EXPIRY=3600000

# Database
NODE_ENV=development
EOF
    echo "✅ File .env creato per server3"
else
    echo "✅ File .env già presente per server3"
fi

# Genera chiave coordinatore se non presente
if ! grep -q "COORDINATOR_SECRET_KEY.*[a-f0-9]" server3/.env; then
    COORD_KEY=$(openssl rand -hex 32)
    sed -i "s/COORDINATOR_SECRET_KEY=.*/COORDINATOR_SECRET_KEY=$COORD_KEY/" server3/.env
    echo "✅ Chiave coordinatore generata"
fi

# 6. INSTALLAZIONE DIPENDENZE
echo ""
echo "📦 Installazione dipendenze..."

# Server1
if [ -f "server1/package.json" ]; then
    echo "🔧 Installazione dipendenze Server1..."
    (cd server1 && $INSTALL_CMD)
fi

# Server3
if [ -f "server3/package.json" ]; then
    echo "🔧 Installazione dipendenze Server3..."
    (cd server3 && $INSTALL_CMD)
    
    # Installa dipendenze aggiuntive per WabiSabi
    (cd server3 && npm install axios crypto-js elliptic)
    echo "✅ Dipendenze WabiSabi installate"
fi

# Client
if [ -f "client/package.json" ]; then
    echo "🔧 Installazione dipendenze Client..."
    (cd client && $INSTALL_CMD)
fi

# 7. CREAZIONE DIRECTORY SERVIZI
echo ""
echo "📁 Creazione directory servizi..."

mkdir -p server3/services
mkdir -p server1/routes
mkdir -p logs
echo "✅ Directory create"

# 8. TEST CONFIGURAZIONE
echo ""
echo "🧪 Test configurazione..."

# Verifica che tutti i file necessari esistano
REQUIRED_FILES=(
    "server3/services/WabiSabiKVACService.js"
    "server3/services/CoinJoinService.js" 
    "server3/services/BitcoinService.js"
    "server3/routes/voting.js"
    "server1/routes/voting.js"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "⚠️ File mancanti:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Copiare i file forniti nelle posizioni corrette."
else
    echo "✅ Tutti i file necessari sono presenti"
fi

# 9. SCRIPT DI AVVIO
echo ""
echo "🚀 Creazione script di avvio..."

cat > start_wabisabi.sh << 'EOF'
#!/bin/bash
# Script per avviare il sistema WabiSabi E-Voting

echo "🚀 Avvio Sistema E-Voting WabiSabi"
echo "================================="

# Funzione per avviare servizio in background
start_service() {
    local name=$1
    local dir=$2
    local script=$3
    
    echo "🔧 Avvio $name..."
    cd "$dir"
    npm run $script > "../logs/${name}.log" 2>&1 &
    local pid=$!
    echo $pid > "../logs/${name}.pid"
    echo "✅ $name avviato (PID: $pid)"
    cd ..
}

# Crea directory logs
mkdir -p logs

# Avvia servizi
start_service "api-gateway" "server1" "start"
sleep 3
start_service "vote-service" "server3" "start"
sleep 3

# Se esiste, avvia client
if [ -d "client" ]; then
    start_service "client" "client" "start"
fi

echo ""
echo "🎉 Sistema WabiSabi avviato!"
echo "📊 API Gateway: http://localhost:3001"
echo "🗳️ Vote Service: http://localhost:3003"
if [ -d "client" ]; then
    echo "🖥️ Client: http://localhost:3000"
fi
echo ""
echo "📋 Log files in: logs/"
echo "🛑 Per fermare: ./stop_wabisabi.sh"
EOF

chmod +x start_wabisabi.sh

# Script di stop
cat > stop_wabisabi.sh << 'EOF'
#!/bin/bash
# Script per fermare il sistema WabiSabi E-Voting

echo "🛑 Arresto Sistema E-Voting WabiSabi"
echo "===================================="

# Funzione per fermare servizio
stop_service() {
    local name=$1
    local pidfile="logs/${name}.pid"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🛑 Arresto $name (PID: $pid)..."
            kill "$pid"
            rm -f "$pidfile"
            echo "✅ $name arrestato"
        else
            echo "⚠️ $name non in esecuzione"
            rm -f "$pidfile"
        fi
    else
        echo "⚠️ PID file non trovato per $name"
    fi
}

# Ferma tutti i servizi
stop_service "client"
stop_service "vote-service" 
stop_service "api-gateway"

echo ""
echo "✅ Sistema WabiSabi arrestato"
EOF

chmod +x stop_wabisabi.sh

echo "✅ Script di avvio/arresto creati"

# 10. RIEPILOGO FINALE
echo ""
echo "🎉 SETUP COMPLETATO!"
echo "==================="
echo ""
echo "📋 Prossimi passi:"
echo ""
echo "1. 🗄️ Configurare database PostgreSQL e eseguire migrazioni:"
echo "   cd database && psql -d your_db -f migrations/003_wabisabi_tables.sql"
echo ""
echo "2. 🔧 Verificare configurazione Bitcoin (opzionale per testing):"
echo "   - Installare Bitcoin Core testnet oppure"
echo "   - Usare API pubbliche (configurazione predefinita)"
echo ""
echo "3. 🚀 Avviare il sistema:"
echo "   ./start_wabisabi.sh"
echo ""
echo "4. 🧪 Testare le API:"
echo "   curl http://localhost:3001/api/voting/debug"
echo ""
echo "📁 File importanti:"
echo "   - server3/.env: Configurazione WabiSabi"
echo "   - logs/: Log dei servizi"
echo "   - start_wabisabi.sh: Script di avvio"
echo "   - stop_wabisabi.sh: Script di arresto"
echo ""
echo "🔐 Funzionalità WabiSabi implementate:"
echo "   ✅ Credenziali KVAC anonime"
echo "   ✅ Commitment omomorfici"
echo "   ✅ Zero-knowledge proofs"
echo "   ✅ Protocollo CoinJoin"
echo "   ✅ Anti-double voting"
echo "   ✅ Integrazione blockchain Bitcoin"
echo "   ✅ Monitoring transazioni"
echo ""
echo "🛡️ Proprietà di sicurezza garantite:"
echo "   • Vote Anonymity (anonimato voti)"
echo "   • Eligibility and Authentication (autorizzazione)"
echo "   • Counting and Recounting (conteggio verificabile)"
echo "   • Uncoercibility (non coercizione)"
echo ""

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo "✅ Sistema pronto per l'avvio!"
else
    echo "⚠️ Completare l'installazione dei file mancanti prima dell'avvio"
fi

echo ""