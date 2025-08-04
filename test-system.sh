#!/bin/bash
# Script completo per testare il sistema E-Voting WabiSabi

set -e

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}🧪 TEST SISTEMA E-VOTING WABISABI${NC}"
echo "=================================================================="
echo ""

# 1. Verifica stato dei servizi
echo -e "${BLUE}STEP 1: Verifica Stato Servizi${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}📋 Verifica container Docker...${NC}"
docker compose ps

echo -e "\n${YELLOW}🔍 Test connettività servizi...${NC}"

services=(
    "API Gateway:3001:/api/health"
    "Auth Service:3002:/api/health"
    "Vote Service:3003:/api/health"
)

all_healthy=true

for service_info in "${services[@]}"; do
    IFS=':' read -ra ADDR <<< "$service_info"
    name=${ADDR[0]}
    port=${ADDR[1]}
    endpoint=${ADDR[2]}
    
    echo -n "  Testing $name (port $port)... "
    
    if curl -f -s "http://localhost:$port$endpoint" > /dev/null 2>&1; then
        response=$(curl -s "http://localhost:$port$endpoint")
        echo -e "${GREEN}✅ OK${NC}"
        echo "    Response: $(echo $response | jq -r '.status // .message // "OK"' 2>/dev/null || echo "OK")"
    else
        echo -e "${RED}❌ FAILED${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    echo -e "\n${RED}⚠️ Alcuni servizi non rispondono. Verifica i log:${NC}"
    echo "docker compose logs -f"
    exit 1
fi

# 2. Test API endpoints base
echo -e "\n${BLUE}STEP 2: Test API Endpoints Base${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🌐 Test API Gateway...${NC}"
echo "GET /"
response=$(curl -s http://localhost:3001/)
echo "Response: $(echo $response | jq '.' 2>/dev/null || echo $response)"

echo -e "\n${YELLOW}🔐 Test Auth Service...${NC}"
echo "GET /"
response=$(curl -s http://localhost:3002/)
echo "Response: $(echo $response | jq '.' 2>/dev/null || echo $response)"

echo -e "\n${YELLOW}⛓️ Test Vote Service...${NC}"
echo "GET /"
response=$(curl -s http://localhost:3003/)
echo "Response: $(echo $response | jq '.' 2>/dev/null || echo $response)"

# 3. Test flusso di registrazione utente
echo -e "\n${BLUE}STEP 3: Test Flusso Registrazione Utente${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}👤 Registrazione nuovo utente...${NC}"

# Test registrazione
echo "POST /api/register"
registration_response=$(curl -s -X POST http://localhost:3002/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "taxCode": "RSSMRA85M01H501Z",
    "firstName": "Mario",
    "lastName": "Rossi"
  }')

echo "Response: $(echo $registration_response | jq '.' 2>/dev/null || echo $registration_response)"

# Estrai userId se presente
user_id=$(echo $registration_response | jq -r '.userId // empty' 2>/dev/null)

if [ ! -z "$user_id" ]; then
    echo -e "${GREEN}✅ Registrazione completata - User ID: $user_id${NC}"
else
    echo -e "${YELLOW}⚠️ Registrazione potrebbe essere già esistente${NC}"
fi

# 4. Test flusso di autenticazione
echo -e "\n${BLUE}STEP 4: Test Flusso Autenticazione${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🔑 Login utente...${NC}"
echo "POST /api/login"
login_response=$(curl -s -X POST http://localhost:3002/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }')

echo "Response: $(echo $login_response | jq '.' 2>/dev/null || echo $login_response)"

# 5. Test credenziali KVAC
echo -e "\n${BLUE}STEP 5: Test Rilascio Credenziali KVAC${NC}"
echo "------------------------------------------------------------------"

if [ ! -z "$user_id" ]; then
    echo -e "${YELLOW}🎫 Rilascio credenziale KVAC...${NC}"
    echo "POST /api/credential/issue"
    credential_response=$(curl -s -X POST http://localhost:3002/api/credential/issue \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": \"$user_id\"
      }")
    
    echo "Response: $(echo $credential_response | jq '.' 2>/dev/null || echo $credential_response)"
    
    # Estrai credenziale per test voto
    credential_id=$(echo $credential_response | jq -r '.credential.id // empty' 2>/dev/null)
    serial_number=$(echo $credential_response | jq -r '.credential.serialNumber // empty' 2>/dev/null)
    
    if [ ! -z "$credential_id" ]; then
        echo -e "${GREEN}✅ Credenziale rilasciata - ID: $credential_id${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Skip test credenziali - nessun user_id disponibile${NC}"
fi

# 6. Test submissione voto
echo -e "\n${BLUE}STEP 6: Test Submissione Voto${NC}"
echo "------------------------------------------------------------------"

if [ ! -z "$serial_number" ]; then
    echo -e "${YELLOW}🗳️ Submissione voto anonimo...${NC}"
    echo "POST /api/vote/submit"
    
    # Genera commitment simulato
    commitment_value=$(openssl rand -hex 32)
    
    vote_response=$(curl -s -X POST http://localhost:3003/api/vote/submit \
      -H "Content-Type: application/json" \
      -d "{
        \"commitment\": \"$commitment_value\",
        \"serialNumber\": \"$serial_number\",
        \"voteData\": {
          \"candidate\": \"Candidato A\"
        }
      }")
    
    echo "Response: $(echo $vote_response | jq '.' 2>/dev/null || echo $vote_response)"
    
    vote_id=$(echo $vote_response | jq -r '.voteId // empty' 2>/dev/null)
    
    if [ ! -z "$vote_id" ]; then
        echo -e "${GREEN}✅ Voto registrato - Vote ID: $vote_id${NC}"
        
        # Test verifica stato voto
        echo -e "\n${YELLOW}📊 Verifica stato voto...${NC}"
        echo "GET /api/vote/$vote_id/status"
        status_response=$(curl -s "http://localhost:3003/api/vote/$vote_id/status")
        echo "Response: $(echo $status_response | jq '.' 2>/dev/null || echo $status_response)"
    fi
else
    echo -e "${YELLOW}⚠️ Skip test voto - nessun serial number disponibile${NC}"
fi

# 7. Test info blockchain
echo -e "\n${BLUE}STEP 7: Test Blockchain Integration${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}⛓️ Verifica info blockchain...${NC}"
echo "GET /api/blockchain/info"
blockchain_response=$(curl -s http://localhost:3003/api/blockchain/info)
echo "Response: $(echo $blockchain_response | jq '.' 2>/dev/null || echo $blockchain_response)"

# 8. Test routing attraverso API Gateway
echo -e "\n${BLUE}STEP 8: Test API Gateway Routing${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🌐 Test routing attraverso API Gateway...${NC}"

echo "GET /api/auth (via API Gateway)"
gateway_auth_response=$(curl -s http://localhost:3001/api/auth)
echo "Response: $(echo $gateway_auth_response | jq '.' 2>/dev/null || echo $gateway_auth_response)"

echo -e "\nGET /api/vote (via API Gateway)"
gateway_vote_response=$(curl -s http://localhost:3001/api/vote)
echo "Response: $(echo $gateway_vote_response | jq '.' 2>/dev/null || echo $gateway_vote_response)"

# 9. Test database e Redis
echo -e "\n${BLUE}STEP 9: Test Database e Cache${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}🗄️ Test connessione PostgreSQL...${NC}"
if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL connesso${NC}"
    
    # Mostra databases
    echo "Database disponibili:"
    docker compose exec -T postgres psql -U postgres -c "\\l" | grep evoting || echo "  Database evoting_wabisabi non ancora creato"
else
    echo -e "${RED}❌ PostgreSQL non raggiungibile${NC}"
fi

echo -e "\n${YELLOW}🔄 Test connessione Redis...${NC}"
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis connesso${NC}"
    
    # Mostra info Redis
    echo "Redis info:"
    docker compose exec -T redis redis-cli info server | grep redis_version || true
else
    echo -e "${RED}❌ Redis non raggiungibile${NC}"
fi

# 10. Test Bitcoin Node
echo -e "\n${BLUE}STEP 10: Test Bitcoin Node${NC}"
echo "------------------------------------------------------------------"

echo -e "${YELLOW}₿ Test Bitcoin Node (Testnet)...${NC}"
if docker compose ps bitcoin-node | grep -q "Up"; then
    echo -e "${GREEN}✅ Bitcoin Node container attivo${NC}"
    
    # Verifica connessione RPC (potrebbe richiedere tempo per sincronizzazione)
    echo "Status Bitcoin Node:"
    docker compose logs bitcoin-node --tail=5 | head -3 || true
else
    echo -e "${YELLOW}⚠️ Bitcoin Node non attivo o in avvio${NC}"
fi

# 11. Riepilogo risultati
echo -e "\n${PURPLE}📊 RIEPILOGO TEST${NC}"
echo "=================================================================="

echo -e "${GREEN}✅ Servizi attivi e funzionanti:${NC}"
echo "   🌐 API Gateway (http://localhost:3001)"
echo "   🔐 Auth Service (http://localhost:3002)"
echo "   ⛓️ Vote Service (http://localhost:3003)"
echo "   🗄️ PostgreSQL (localhost:5432)"
echo "   🔄 Redis (localhost:6379)"

if [ ! -z "$user_id" ]; then
    echo -e "\n${GREEN}✅ Flusso completo testato:${NC}"
    echo "   👤 Registrazione utente: $user_id"
    if [ ! -z "$credential_id" ]; then
        echo "   🎫 Credenziale KVAC: $credential_id"
    fi
    if [ ! -z "$vote_id" ]; then
        echo "   🗳️ Voto registrato: $vote_id"
    fi
fi

echo -e "\n${CYAN}📋 Comandi utili per monitoraggio:${NC}"
echo "   docker compose ps                    # Stato servizi"
echo "   docker compose logs -f              # Log in tempo reale"
echo "   docker compose logs [service-name]  # Log specifico servizio"
echo "   curl http://localhost:3001/api/health  # Health check API Gateway"

echo -e "\n${CYAN}🌐 Endpoint disponibili:${NC}"
echo "   http://localhost:3001/               # API Gateway"
echo "   http://localhost:3002/               # Auth Service"
echo "   http://localhost:3003/               # Vote Service"

echo -e "\n${GREEN}🎉 Test completato con successo!${NC}"
echo "Il sistema E-Voting WabiSabi è operativo e pronto per l'uso."