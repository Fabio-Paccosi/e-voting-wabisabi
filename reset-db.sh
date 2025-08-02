#!/bin/bash
echo "Reset database in corso..."
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS evoting_wabisabi;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE evoting_wabisabi;"
echo "Database resettato! Esegui 'make migrate' per reinizializzare."
