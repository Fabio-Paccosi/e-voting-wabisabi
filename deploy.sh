#!/bin/bash
# Deploy semplificato E-Voting WabiSabi

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

print_msg() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ENVIRONMENT=${1:-production}

echo -e "${GREEN}=== Deploy E-Voting WabiSabi ===${NC}"

deploy() {
    print_msg "Deploy $ENVIRONMENT..."
    
    # Backup
    mkdir -p "backups/deploy_$(date +%Y%m%d_%H%M%S)"
    
    # Deploy
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    
    # Verifica
    sleep 10
    if curl -s http://localhost:3001/api/health >/dev/null; then
        print_msg "✓ Deploy completato"
        echo "Sistema: http://localhost:3001"
    else
        print_error "✗ Deploy fallito"
        exit 1
    fi
}

deploy