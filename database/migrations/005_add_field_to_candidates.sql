BEGIN;
DO $$ 
BEGIN
   ALTER TABLE candidates 
    ADD COLUMN IF NOT EXISTS total_votes_received INTEGER DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_candidates_total_votes 
    ON candidates(total_votes_received);
END $$;