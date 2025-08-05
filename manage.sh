#!/bin/bash
# Script di debug, test e reset per il sistema E-Voting WabiSabi

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_msg() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}================================================"
echo "   E-Voting WabiSabi - Gestione Sistema"
echo -e "================================================${NC}"

COMMAND=${1:-help}

# Test sistema completo
test_system() {
    print_msg "Test sistema completo..."
    
    # Verifica servizi Docker
    if ! docker compose ps | grep -q "Up"; then
        print_error "Sistema non in esecuzione. Avvia con: ./start.sh"
        exit 1
    fi
    
    # Test endpoints
    services=("3001:API Gateway" "3002:Auth Service" "3003:Vote Service")
    
    for service in "${services[@]}"; do
        port=$(echo $service | cut -d: -f1)
        name=$(echo $service | cut -d: -f2)
        
        if curl -s "http://localhost:$port/api/health" >/dev/null 2>&1; then
            print_msg "✓ $name: OK"
        else
            print_error "✗ $name: Errore"
        fi
    done
    
    # Test database
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        print_msg "✓ Database: OK"
    else
        print_error "✗ Database: Errore"
    fi
    
    print_msg "Test completato!"
}

# Debug Docker build
debug_build() {
    print_msg "Debug Docker build..."
    
    # Controllo file essenziali
    files=("docker-compose.yml" ".env" "server1/Dockerfile" "server2/Dockerfile" "server3/Dockerfile")
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            print_msg "✓ $file"
        else
            print_error "✗ $file MANCANTE"
        fi
    done
    
    # Test sintassi docker-compose
    if docker compose config >/dev/null 2>&1; then
        print_msg "✓ docker-compose.yml sintassi OK"
    else
        print_error "✗ docker-compose.yml errori sintassi"
        docker compose config
    fi
}

# Backup database
backup_db() {
    print_msg "Backup database..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backups/backup_${TIMESTAMP}.sql"
    
    mkdir -p backups
    
    if docker compose exec -T postgres pg_dump -U postgres evoting_wabisabi > "$BACKUP_FILE"; then
        print_msg "✓ Backup salvato: $BACKUP_FILE"
    else
        print_error "✗ Backup fallito"
    fi
}

# Reset database
reset_db() {
    read -p "Confermi reset database? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_msg "Reset database..."
        docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS evoting_wabisabi;"
        docker compose exec postgres psql -U postgres -c "CREATE DATABASE evoting_wabisabi;"
        print_msg "✓ Database resettato"
    else
        print_msg "Reset annullato"
    fi
}

# Status sistema
show_status() {
    print_msg "Status sistema:"
    docker compose ps
    echo ""
    
    print_msg "Utilizzo risorse:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# Help
show_help() {
    echo "Uso: $0 COMMAND"
    echo ""
    echo "Comandi:"
    echo "  test          - Test sistema completo"
    echo "  debug         - Debug Docker build"
    echo "  backup        - Backup database"
    echo "  reset         - Reset database"
    echo "  status        - Status sistema e risorse"
    echo "  logs          - Visualizza logs"
    echo "  help          - Questo help"
}

# Main
case "$COMMAND" in
    "test")
        test_system
        ;;
    "debug")
        debug_build
        ;;
    "backup")
        backup_db
        ;;
    "reset")
        reset_db
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker compose logs -f
        ;;
    "help"|*)
        show_help
        ;;
esac