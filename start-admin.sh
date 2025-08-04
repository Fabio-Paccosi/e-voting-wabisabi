#!/bin/bash
# Script per avviare il dashboard amministratore

echo "🚀 Avvio Dashboard Amministratore E-Voting..."

# Verifica se il sistema principale è in esecuzione
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "⚠️ Sistema principale non in esecuzione. Avvio..."
    docker compose up -d
    echo "⏳ Attesa avvio servizi..."
    sleep 10
fi

# Avvia admin dashboard in modalità sviluppo
if [ "$1" = "dev" ]; then
    echo "🔧 Modalità sviluppo..."
    cd admin-dashboard
    npm start &
    ADMIN_PID=$!
    
    echo "📊 Dashboard admin disponibile su: http://localhost:3006"
    echo "🛑 Premi Ctrl+C per fermare"
    
    # Trap per cleanup
    trap "kill $ADMIN_PID; exit" INT TERM
    wait $ADMIN_PID
else
    # Modalità produzione con Docker
    echo "🐳 Modalità produzione..."
    docker compose -f docker-compose.yml -f docker-compose.admin.yml up -d
    
    echo "✅ Dashboard admin avviato!"
    echo "📊 Accesso: http://localhost:8080"
fi
