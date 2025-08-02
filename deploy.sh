# Script principale di deployment per il sistema E-Voting WabiSabi

set -e  # Exit on error

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurazione
DEPLOY_ENV=${1:-production}
DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_HOST=${DEPLOY_HOST:-evoting.example.com}
DEPLOY_PATH=${DEPLOY_PATH:-/opt/evoting}

echo -e "${GREEN}=== E-Voting WabiSabi Deployment Script ===${NC}"
echo -e "Environment: ${YELLOW}$DEPLOY_ENV${NC}"

# Funzione per verificare prerequisiti
check_prerequisites() {
    echo -e "\n${YELLOW}Verifica prerequisiti...${NC}"
    
    # Verifica Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker non installato!${NC}"
        exit 1
    fi
    
    # Verifica Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose non installato!${NC}"
        exit 1
    fi
    
    # Verifica Git
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Git non installato!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Tutti i prerequisiti soddisfatti${NC}"
}

# Funzione per setup environment
setup_environment() {
    echo -e "\n${YELLOW}Setup environment...${NC}"
    
    # Copia file environment se non esiste
    if [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ File .env creato da template. Configura le variabili!${NC}"
        exit 1
    fi
    
    # Genera chiavi se non esistono
    if grep -q "your-secret-key" .env; then
        echo -e "${YELLOW}Generazione chiavi sicure...${NC}"
        JWT_SECRET=$(openssl rand -base64 32)
        DB_PASSWORD=$(openssl rand -base64 24)
        REDIS_PASSWORD=$(openssl rand -base64 24)
        
        # Sostituisci nel file .env
        sed -i.bak "s/your-secret-key-change-in-production/$JWT_SECRET/g" .env
        sed -i.bak "s/password/$DB_PASSWORD/g" .env
        sed -i.bak "s/redis123/$REDIS_PASSWORD/g" .env
        
        echo -e "${GREEN}✓ Chiavi generate e salvate${NC}"
    fi
}

# Funzione per build containers
build_containers() {
    echo -e "\n${YELLOW}Build dei container...${NC}"
    
    docker-compose build --no-cache
    
    echo -e "${GREEN}✓ Build completato${NC}"
}

# Funzione per deploy locale
deploy_local() {
    echo -e "\n${YELLOW}Deploy locale...${NC}"
    
    # Stop vecchi container
    docker-compose down
    
    # Start nuovi container
    docker-compose up -d
    
    # Attendi che i servizi siano pronti
    echo -e "${YELLOW}Attesa avvio servizi...${NC}"
    sleep 10
    
    # Inizializza database
    echo -e "${YELLOW}Inizializzazione database...${NC}"
    docker-compose exec -T auth-service node /app/database/migrate.js init
    
    # Seed dati di test in development
    if [ "$DEPLOY_ENV" = "development" ]; then
        docker-compose exec -T auth-service node /app/database/migrate.js seed
    fi
    
    echo -e "${GREEN}✓ Deploy locale completato${NC}"
}

# Funzione per deploy remoto
deploy_remote() {
    echo -e "\n${YELLOW}Deploy remoto su $DEPLOY_HOST...${NC}"
    
    # Build locale
    build_containers
    
    # Tag images per registry
    docker tag evoting-api-gateway:latest $DEPLOY_HOST:5000/evoting-api-gateway:latest
    docker tag evoting-auth-service:latest $DEPLOY_HOST:5000/evoting-auth-service:latest
    docker tag evoting-vote-service:latest $DEPLOY_HOST:5000/evoting-vote-service:latest
    
    # Push to registry
    docker push $DEPLOY_HOST:5000/evoting-api-gateway:latest
    docker push $DEPLOY_HOST:5000/evoting-auth-service:latest
    docker push $DEPLOY_HOST:5000/evoting-vote-service:latest
    
    # Deploy su host remoto
    ssh $DEPLOY_USER@$DEPLOY_HOST << 'ENDSSH'
        cd $DEPLOY_PATH
        git pull origin main
        docker-compose pull
        docker-compose down
        docker-compose up -d
        docker-compose exec -T auth-service node /app/database/migrate.js init
ENDSSH
    
    echo -e "${GREEN}✓ Deploy remoto completato${NC}"
}

# Funzione per health check
health_check() {
    echo -e "\n${YELLOW}Health check servizi...${NC}"
    
    # Array di servizi da controllare
    services=("api-gateway:3001" "auth-service:3002" "vote-service:3003")
    
    for service in "${services[@]}"; do
        IFS=':' read -ra ADDR <<< "$service"
        name=${ADDR[0]}
        port=${ADDR[1]}
        
        if curl -f -s http://localhost:$port/api/health > /dev/null; then
            echo -e "${GREEN}✓ $name OK${NC}"
        else
            echo -e "${RED}✗ $name FAILED${NC}"
        fi
    done
}

# Funzione per backup
backup() {
    echo -e "\n${YELLOW}Backup del sistema...${NC}"
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup database
    docker-compose exec -T postgres pg_dump -U postgres evoting_wabisabi > $BACKUP_DIR/database.sql
    
    # Backup volumi Docker
    docker run --rm -v evoting_postgres_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
    
    # Backup configurazioni
    cp .env $BACKUP_DIR/
    cp docker-compose.yml $BACKUP_DIR/
    
    echo -e "${GREEN}✓ Backup salvato in $BACKUP_DIR${NC}"
}

# Funzione principale
main() {
    check_prerequisites
    setup_environment
    
    case "$DEPLOY_ENV" in
        "development")
            deploy_local
            health_check
            echo -e "\n${GREEN}Deploy development completato!${NC}"
            echo -e "API Gateway: http://localhost:3001"
            echo -e "Grafana: http://localhost:3000"
            echo -e "Prometheus: http://localhost:9090"
            ;;
        "production")
            deploy_remote
            echo -e "\n${GREEN}Deploy production completato!${NC}"
            ;;
        "backup")
            backup
            ;;
        *)
            echo -e "${RED}Environment non valido: $DEPLOY_ENV${NC}"
            echo "Usa: ./deploy.sh [development|production|backup]"
            exit 1
            ;;
    esac
}

# Esegui
main
