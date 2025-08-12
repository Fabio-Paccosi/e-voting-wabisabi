-- Migration: Add status column to votes table
-- Esegui questo SQL per aggiungere la colonna status

BEGIN;

-- 1. Crea il tipo ENUM per lo status dei voti (se non esiste già)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_status_enum') THEN
        CREATE TYPE vote_status_enum AS ENUM ('pending', 'processed', 'confirmed', 'failed');
    END IF;
END $$;

-- 2. Aggiungi la colonna status alla tabella votes
ALTER TABLE votes 
ADD COLUMN IF NOT EXISTS status vote_status_enum DEFAULT 'pending';

-- 3. Crea un indice per la colonna status (per performance)
CREATE INDEX IF NOT EXISTS idx_votes_status ON votes(status);

-- 4. Aggiorna eventuali record esistenti (tutti a 'pending' di default)
UPDATE votes SET status = 'pending' WHERE status IS NULL;

-- 5. Aggiungi commento per documentazione
COMMENT ON COLUMN votes.status IS 'Stato del voto: pending, processed, confirmed, failed';

COMMIT;

-- Verifica che tutto sia andato bene
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'votes' 
ORDER BY ordinal_position;