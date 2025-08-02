#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.sql"
echo "Backup database in: $BACKUP_FILE"
docker compose exec -T postgres pg_dump -U postgres evoting_wabisabi > "$BACKUP_FILE"
echo "Backup completato!"
