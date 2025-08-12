# 🗳️ E-Voting WabiSabi

Sistema di **Voto Elettronico Anonimo e Sicuro** basato sul protocollo WabiSabi e tecnologia blockchain Bitcoin.

## Avvio

# Terminale 1: Avvia solo i backend services
docker compose up

oppure per rebuildare

docker compose up --build

# Terminale 2: Admin Dashboard  (user: admin@example.com  psw: admin123)
cd admin && npm start

# Terminale 3: Client Frontend
cd client && npm start

## Tests
# Test health check
curl http://localhost:3001/api/health

# Test connessione admin
curl http://localhost:3001/api/admin/test-connection

# Test admin login
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'


## Comandi utili

# Esegui tutte le migrazione sospese
node database/migrations/run-migrations.js run

# Log servizi database 
 docker compose logs vote-service | grep -i "error\|database"

# Rebuild completo backend
- Stop tutti i container (se attivi)
docker compose down

- Rimuovi tutte le immagini del progetto
docker rmi $(docker images "evoting*" -q) 2>/dev/null || true

- Rebuild con --no-cache
docker compose build --no-cache

- Riavvia
docker compose up -d