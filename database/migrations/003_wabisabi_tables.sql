-- Migrazione 003: Tabelle WabiSabi E-Voting
-- Aggiunge tabelle per credenziali KVAC e sessioni di voto

-- Tabella per indirizzi Bitcoin degli utenti
CREATE TABLE IF NOT EXISTS user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    bitcoin_address VARCHAR(100) NOT NULL,
    public_key TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per monitoraggio delle sessioni CoinJoin attive
CREATE TABLE IF NOT EXISTS coinjoin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voting_sessions(id),
    status VARCHAR(50) DEFAULT 'preparing',
    participants_count INTEGER DEFAULT 0,
    round INTEGER DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    tx_id VARCHAR(100) NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per tracciare i commitment dei voti
CREATE TABLE IF NOT EXISTS vote_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id UUID NOT NULL REFERENCES votes(id),
    commitment_hash VARCHAR(128) NOT NULL,
    randomness VARCHAR(128),
    candidate_encoding INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_session ON user_addresses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_bitcoin ON user_addresses(bitcoin_address);

CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_session ON coinjoin_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_status ON coinjoin_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coinjoin_sessions_tx ON coinjoin_sessions(tx_id);

CREATE INDEX IF NOT EXISTS idx_vote_commitments_vote ON vote_commitments(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_commitments_hash ON vote_commitments(commitment_hash);

-- Trigger per aggiornamento automatico updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coinjoin_sessions_updated_at BEFORE UPDATE ON coinjoin_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Aggiungi campi mancanti alle tabelle esistenti se non presenti
DO $$ 
BEGIN
    -- Aggiungi zkProof alla tabella votes se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='votes' AND column_name='zk_proof') THEN
        ALTER TABLE votes ADD COLUMN zk_proof JSONB;
    END IF;
    
    -- Aggiungi bitcoin_address alla tabella votes se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='votes' AND column_name='bitcoin_address') THEN
        ALTER TABLE votes ADD COLUMN bitcoin_address VARCHAR(100);
    END IF;
    
    -- Aggiungi election_id alla tabella credentials se non esiste
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credentials' AND column_name='election_id') THEN
        ALTER TABLE credentials ADD COLUMN election_id UUID;
    END IF;
END $$;

COMMIT;
