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
