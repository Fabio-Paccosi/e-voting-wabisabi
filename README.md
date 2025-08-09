# 🗳️ E-Voting WabiSabi

Sistema di **Voto Elettronico Anonimo e Sicuro** basato sul protocollo WabiSabi e tecnologia blockchain Bitcoin.

## Avvio

# Terminale 1: Avvia solo i backend services
./start.sh
docker compose up

# Terminale 2: Admin Dashboard  (user: admin  psw: admin123)
cd admin && npm start

# Terminale 3: Client Frontend
cd client && npm start


## Comandi utili

# Rebuild completo backend
- Stop tutti i container (se attivi)
docker compose down

- Rimuovi tutte le immagini del progetto
docker rmi $(docker images "evoting*" -q) 2>/dev/null || true

- Rebuild con --no-cache
docker compose build --no-cache

- Riavvia
docker compose up -d