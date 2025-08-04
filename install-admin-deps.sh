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
