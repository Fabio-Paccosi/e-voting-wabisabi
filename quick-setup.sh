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
