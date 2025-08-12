#!/bin/bash
# Script per reset completo database E-Voting WabiSabi

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_msg() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo -e "${BLUE}================================================"
echo "   E-Voting WabiSabi - Reset Database"
echo -e "================================================${NC}"

# Verifica se Docker è in esecuzione
if ! docker info >/dev/null 2>&1; then
    print_error "Docker non è in esecuzione!"
    exit 1
fi

# Backup opzionale prima del reset
backup_database() {
    print_msg "Creazione backup di sicurezza..."
    
    mkdir -p backups
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backups/backup_before_reset_${TIMESTAMP}.sql"
    
    if docker compose ps postgres | grep -q "Up"; then
        if docker compose exec -T postgres pg_dump -U postgres evoting_wabisabi > "$BACKUP_FILE" 2>/dev/null; then
            print_msg "✅ Backup salvato: $BACKUP_FILE"
            return 0
        else
            print_warning "⚠️  Backup fallito (database potrebbe essere vuoto o corrotto)"
            return 1
        fi
    else
        print_warning "⚠️  Container postgres non in esecuzione, skip backup"
        return 1
    fi
}

# Reset completo database
reset_database() {
    print_msg "Iniziando reset database..."
    
    # 1. Ferma tutti i container
    print_msg "1. Fermando container..."
    docker compose down
    
    # 2. Rimuovi il volume del database (QUESTO CANCELLA TUTTI I DATI!)
    print_msg "2. Rimuovendo volume database..."
    docker volume rm $(docker compose config --services | head -1)_postgres_data 2>/dev/null || \
    docker volume rm evoting-wabisabi_postgres_data 2>/dev/null || \
    docker volume rm postgres_data 2>/dev/null || \
    print_warning "⚠️  Volume database non trovato o già rimosso"
    
    # 3. Rimuovi anche volume Redis se presente
    print_msg "3. Rimuovendo volume Redis..."
    docker volume rm $(docker compose config --services | head -1)_redis_data 2>/dev/null || \
    docker volume rm evoting-wabisabi_redis_data 2>/dev/null || \
    docker volume rm redis_data 2>/dev/null || \
    print_warning "⚠️  Volume Redis non trovato o già rimosso"
    
    # 4. Rimuovi immagini vecchie (opzionale, per rebuild completo)
    print_msg "4. Rimuovendo immagini container..."
    docker compose down --rmi local 2>/dev/null || true
    
    # 5. Rebuild e avvia sistema
    print_msg "5. Rebuild e avvio sistema..."
    docker compose build --no-cache
    docker compose up -d
    
    # 6. Attendi che i servizi siano pronti
    print_msg "6. Attesa avvio servizi..."
    sleep 10
    
    # Controllo PostgreSQL
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            print_msg "✅ PostgreSQL pronto"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    # 7. Verifica database pulito
    print_msg "7. Verifica database..."
    DB_TABLES=$(docker compose exec -T postgres psql -U postgres -d evoting_wabisabi -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$DB_TABLES" = "0" ]; then
        print_msg "✅ Database completamente pulito (0 tabelle)"
    else
        print_warning "⚠️  Database contiene ancora $DB_TABLES tabelle"
    fi
}

# Verifica setup post-reset
verify_setup() {
    print_msg "Verifica setup post-reset..."
    
    # Controlla stato container
    print_msg "Stato container:"
    docker compose ps
    echo ""
    
    # Test connessioni
    services=("3001:API Gateway" "3002:Auth Service" "3003:Vote Service")
    
    for service in "${services[@]}"; do
        port=$(echo $service | cut -d: -f1)
        name=$(echo $service | cut -d: -f2)
        
        sleep 2
        if curl -s "http://localhost:$port/api/health" >/dev/null 2>&1; then
            print_msg "✅ $name: Risponde"
        else
            print_warning "⚠️  $name: Non risponde ancora (potrebbe servire più tempo)"
        fi
    done
    
    echo ""
    print_msg "🎉 Reset completato!"
    echo ""
    echo "Prossimi passi:"
    echo "1. I servizi dovrebbero creare automaticamente le tabelle al primo avvio"
    echo "2. Controlla i log con: docker compose logs -f"
    echo "3. Accedi all'admin dashboard: cd admin && npm start"
    echo "4. Accedi al client: cd client && npm start"
}

# Funzione principale
main() {
    # Chiedi conferma
    echo ""
    print_warning "⚠️  ATTENZIONE: Questo cancellerà TUTTI I DATI del database!"
    echo ""
    read -p "Vuoi continuare? (scrivi 'RESET' per confermare): " -r
    
    if [ "$REPLY" != "RESET" ]; then
        print_msg "Reset annullato"
        exit 0
    fi
    
    echo ""
    read -p "Vuoi creare un backup prima del reset? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        backup_database
    fi
    
    echo ""
    reset_database
    echo ""
    verify_setup
}

# Esegui se chiamato direttamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi