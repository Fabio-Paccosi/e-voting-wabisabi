-- Aggiungi colonna totalVotesReceived alla tabella candidates se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidates' 
        AND column_name = 'totalVotesReceived'
    ) THEN
        ALTER TABLE candidates 
        ADD COLUMN "totalVotesReceived" INTEGER DEFAULT 0 NOT NULL;
        
        -- Aggiungi indice per performance
        CREATE INDEX IF NOT EXISTS idx_candidates_total_votes 
        ON candidates("totalVotesReceived");
        
        RAISE NOTICE 'Colonna totalVotesReceived aggiunta alla tabella candidates';
    ELSE
        RAISE NOTICE 'Colonna totalVotesReceived già esistente';
    END IF;
END $$;

-- Aggiungi colonna totalVotes alla tabella elections se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'elections' 
        AND column_name = 'totalVotes'
    ) THEN
        ALTER TABLE elections 
        ADD COLUMN "totalVotes" INTEGER DEFAULT 0 NOT NULL;
        
        RAISE NOTICE 'Colonna totalVotes aggiunta alla tabella elections';
    ELSE
        RAISE NOTICE 'Colonna totalVotes già esistente';
    END IF;
END $$;

-- Aggiungi colonna confirmations alla tabella votes se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' 
        AND column_name = 'confirmations'
    ) THEN
        ALTER TABLE votes 
        ADD COLUMN confirmations INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Colonna confirmations aggiunta alla tabella votes';
    ELSE
        RAISE NOTICE 'Colonna confirmations già esistente';
    END IF;
END $$;

-- Aggiungi colonna confirmedAt alla tabella votes se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' 
        AND column_name = 'confirmedAt'
    ) THEN
        ALTER TABLE votes 
        ADD COLUMN "confirmedAt" TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Colonna confirmedAt aggiunta alla tabella votes';
    ELSE
        RAISE NOTICE 'Colonna confirmedAt già esistente';
    END IF;
END $$;

-- Verifica che vote_encoding sia sempre numerico e non NULL
DO $$
BEGIN
    -- Aggiungi constraint per validare vote_encoding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_vote_encoding_valid'
    ) THEN
        ALTER TABLE candidates 
        ADD CONSTRAINT chk_vote_encoding_valid 
        CHECK ("vote_encoding" IS NOT NULL AND "vote_encoding" > 0);
        
        RAISE NOTICE 'Constraint vote_encoding aggiunto';
    END IF;
END $$;

-- Aggiorna valori NULL o invalidi in vote_encoding
UPDATE candidates 
SET "vote_encoding" = 1 
WHERE "vote_encoding" IS NULL OR "vote_encoding" <= 0;

-- Funzione helper per aggiornare conteggi voti
CREATE OR REPLACE FUNCTION update_candidate_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        -- Incrementa conteggio quando voto confermato
        UPDATE candidates 
        SET "totalVotesReceived" = "totalVotesReceived" + 1
        WHERE id = (
            SELECT c.id FROM candidates c 
            WHERE c."election_id" = NEW."election_id" 
            AND c."vote_encoding" = COALESCE(
                CAST(NEW.commitment->>'candidateEncoding' AS INTEGER),
                CAST(NEW.commitment->>'candidate' AS INTEGER),
                1
            )
            LIMIT 1
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per aggiornamento automatico
DROP TRIGGER IF EXISTS trg_update_vote_count ON votes;
CREATE TRIGGER trg_update_vote_count
    AFTER INSERT OR UPDATE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_candidate_vote_count();

-- Indici aggiuntivi per performance
CREATE INDEX IF NOT EXISTS idx_votes_status_election 
ON votes(status, "election_id");

CREATE INDEX IF NOT EXISTS idx_votes_commitment_gin 
ON votes USING gin(commitment);

COMMIT;