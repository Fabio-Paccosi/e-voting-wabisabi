#!/bin/bash
# Script per pulire e resettare l'ambiente admin

echo "🧹 Cleanup ambiente admin..."

# Ferma tutti i container admin
docker compose -f docker-compose.admin.yml down

# Rimuovi immagini admin
docker rmi $(docker images | grep admin-dashboard | awk '{print $3}') 2>/dev/null || true

# Pulisci build cache
docker builder prune -f

# Rimuovi node_modules se esistono
rm -rf admin-dashboard/node_modules

echo "✅ Cleanup completato!"
