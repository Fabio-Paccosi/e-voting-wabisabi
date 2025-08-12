-- Migration: Add Bitcoin Address to Users
-- Created: 2025-08-11T18:00:00.000Z
-- Description: Aggiunge campi Bitcoin agli utenti per permettere il voto su testnet

BEGIN;

-- Aggiungi colonne Bitcoin alla tabella users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bitcoin_address VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS bitcoin_private_key TEXT;

-- Crea indice per performance sugli indirizzi Bitcoin
CREATE INDEX IF NOT EXISTS idx_users_bitcoin_address 
ON users(bitcoin_address) 
WHERE bitcoin_address IS NOT NULL;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN users.bitcoin_address IS 'Indirizzo Bitcoin per il voto su testnet';
COMMENT ON COLUMN users.bitcoin_private_key IS 'Chiave privata Bitcoin crittografata';

-- Aggiorna le statistiche per l'ottimizzatore
ANALYZE users;

COMMIT;