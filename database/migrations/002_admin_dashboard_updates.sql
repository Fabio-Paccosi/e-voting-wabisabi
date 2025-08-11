-- database/migrations/002_admin_dashboard_updates.sql

-- Aggiungi campi a elections
ALTER TABLE elections 
ADD COLUMN IF NOT EXISTS coinjoin_trigger INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS coinjoin_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS max_voters_allowed INTEGER,
ADD COLUMN IF NOT EXISTS voting_method VARCHAR(20) DEFAULT 'single',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS blockchain_network VARCHAR(10) DEFAULT 'testnet';

-- Aggiungi campi a candidates
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS party VARCHAR(100),
ADD COLUMN IF NOT EXISTS photo TEXT,
ADD COLUMN IF NOT EXISTS biography TEXT,
ADD COLUMN IF NOT EXISTS bitcoin_address VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS bitcoin_public_key VARCHAR(130),
ADD COLUMN IF NOT EXISTS total_votes_received INTEGER DEFAULT 0;

-- Crea tabella election_whitelist
CREATE TABLE IF NOT EXISTS election_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    authorized_by UUID,
    has_voted BOOLEAN DEFAULT false,
    voted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(election_id, user_id)
);

-- Estendi tabella users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_code VARCHAR(16) UNIQUE,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS address JSONB,
ADD COLUMN IF NOT EXISTS document_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS document_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Crea tabella per chiavi candidate (sicurezza)
CREATE TABLE IF NOT EXISTS candidate_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    encrypted_private_key TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_election_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_election_dates ON elections(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_whitelist_election ON election_whitelist(election_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_user ON election_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_users_tax_code ON users(tax_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_bitcoin ON candidates(bitcoin_address);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_election_whitelist_updated_at 
    BEFORE UPDATE ON election_whitelist 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();