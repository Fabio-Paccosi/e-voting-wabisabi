-- Migration: Create Voting System Tables
-- Created: 2025-08-11T20:00:00.000Z
-- Description: Crea tutte le tabelle principali per il sistema di E-Voting WabiSabi

BEGIN;

-- ====================
-- TABELLA USERS (se non esiste già)
-- ====================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    tax_code VARCHAR(16) UNIQUE NOT NULL,
    date_of_birth DATE,
    phone_number VARCHAR(20),
    address JSONB,
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    is_authorized BOOLEAN DEFAULT false,
    authorization_proof TEXT,
    has_voted BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA ELECTIONS
-- ====================
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    final_tally_transaction_id VARCHAR(255),
    coinjoin_trigger INTEGER DEFAULT 10,
    coinjoin_enabled BOOLEAN DEFAULT true,
    max_voters_allowed INTEGER,
    voting_method VARCHAR(20) DEFAULT 'single',
    blockchain_network VARCHAR(10) DEFAULT 'testnet',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA CANDIDATES
-- ====================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    description TEXT,
    biography TEXT,
    party VARCHAR(100),
    photo TEXT,
    bitcoin_address VARCHAR(255) UNIQUE NOT NULL,
    bitcoin_public_key VARCHAR(130),
    vote_encoding INTEGER NOT NULL,
    total_votes_received INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA VOTING_SESSIONS
-- ====================
CREATE TABLE IF NOT EXISTS voting_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'preparing' CHECK (status IN ('preparing', 'active', 'completed', 'failed')),
    transaction_count INTEGER DEFAULT 0,
    final_tally_transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA CREDENTIALS
-- ====================
CREATE TABLE IF NOT EXISTS credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    signature TEXT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA VOTES
-- ====================
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    commitment TEXT NOT NULL,
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA TRANSACTIONS
-- ====================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES elections(id),
    session_id UUID REFERENCES voting_sessions(id),
    tx_id VARCHAR(255) UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('coinjoin', 'tally', 'funding')),
    raw_data TEXT,
    metadata JSONB,
    confirmations INTEGER DEFAULT 0,
    block_height INTEGER,
    block_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TABELLA ELECTION_WHITELIST
-- ====================
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

-- ====================
-- TABELLA CANDIDATE_KEYS (per sicurezza)
-- ====================
CREATE TABLE IF NOT EXISTS candidate_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    encrypted_private_key TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id)
);

-- ====================
-- INDICI PER PERFORMANCE
-- ====================

-- Indici per Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tax_code ON users(tax_code);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_authorized ON users(is_authorized);

-- Indici per Elections
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_dates ON elections(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_elections_is_active ON elections(is_active);

-- Indici per Candidates
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_bitcoin ON candidates(bitcoin_address);
CREATE INDEX IF NOT EXISTS idx_candidates_encoding ON candidates(vote_encoding);

-- Indici per Voting Sessions
CREATE INDEX IF NOT EXISTS idx_voting_sessions_election ON voting_sessions(election_id);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_status ON voting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_times ON voting_sessions(start_time, end_time);

-- Indici per Credentials
CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_serial ON credentials(serial_number);
CREATE INDEX IF NOT EXISTS idx_credentials_is_used ON credentials(is_used);

-- Indici per Votes
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_serial ON votes(serial_number);
CREATE INDEX IF NOT EXISTS idx_votes_transaction ON votes(transaction_id);

-- Indici per Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_election ON transactions(election_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_txid ON transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_confirmations ON transactions(confirmations);

-- Indici per Election Whitelist
CREATE INDEX IF NOT EXISTS idx_whitelist_election ON election_whitelist(election_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_user ON election_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_has_voted ON election_whitelist(has_voted);

-- Indici per Candidate Keys
CREATE INDEX IF NOT EXISTS idx_candidate_keys_candidate ON candidate_keys(candidate_id);

-- ====================
-- TRIGGER FUNCTIONS
-- ====================

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================
-- TRIGGERS PER UPDATED_AT
-- ====================

-- Trigger per users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per elections
DROP TRIGGER IF EXISTS update_elections_updated_at ON elections;
CREATE TRIGGER update_elections_updated_at 
    BEFORE UPDATE ON elections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per candidates
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at 
    BEFORE UPDATE ON candidates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per voting_sessions
DROP TRIGGER IF EXISTS update_voting_sessions_updated_at ON voting_sessions;
CREATE TRIGGER update_voting_sessions_updated_at 
    BEFORE UPDATE ON voting_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per credentials
DROP TRIGGER IF EXISTS update_credentials_updated_at ON credentials;
CREATE TRIGGER update_credentials_updated_at 
    BEFORE UPDATE ON credentials 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per votes
DROP TRIGGER IF EXISTS update_votes_updated_at ON votes;
CREATE TRIGGER update_votes_updated_at 
    BEFORE UPDATE ON votes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per transactions
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger per election_whitelist
DROP TRIGGER IF EXISTS update_election_whitelist_updated_at ON election_whitelist;
CREATE TRIGGER update_election_whitelist_updated_at 
    BEFORE UPDATE ON election_whitelist 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- TRIGGER BUSINESS LOGIC
-- ====================

-- Trigger per aggiornare hasVoted quando una credenziale viene usata
CREATE OR REPLACE FUNCTION update_user_voted_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_used = true AND OLD.is_used = false THEN
        UPDATE users 
        SET has_voted = true, updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_voted ON credentials;
CREATE TRIGGER trigger_update_user_voted
    AFTER UPDATE OF is_used ON credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_user_voted_status();

-- ====================
-- COMMENTI PER DOCUMENTAZIONE
-- ====================

-- Commenti tabelle
COMMENT ON TABLE users IS 'Utenti registrati nel sistema di E-Voting';
COMMENT ON TABLE elections IS 'Elezioni configurate nel sistema';
COMMENT ON TABLE candidates IS 'Candidati per ciascuna elezione';
COMMENT ON TABLE voting_sessions IS 'Sessioni di voto attive';
COMMENT ON TABLE credentials IS 'Credenziali anonime KVAC per il voto';
COMMENT ON TABLE votes IS 'Voti espressi con commitment crittografico';
COMMENT ON TABLE transactions IS 'Transazioni Bitcoin del sistema';
COMMENT ON TABLE election_whitelist IS 'Utenti autorizzati per ciascuna elezione';
COMMENT ON TABLE candidate_keys IS 'Chiavi private crittografate dei candidati';

-- Commenti colonne critiche
COMMENT ON COLUMN users.tax_code IS 'Codice fiscale per verifica identità';
COMMENT ON COLUMN candidates.bitcoin_address IS 'Indirizzo Bitcoin per ricevere i voti';
COMMENT ON COLUMN candidates.vote_encoding IS 'Encoding numerico del voto per questo candidato';
COMMENT ON COLUMN credentials.serial_number IS 'Serial number univoco per anti double-spending';
COMMENT ON COLUMN votes.commitment IS 'Commitment crittografico del voto (Pedersen)';
COMMENT ON COLUMN transactions.type IS 'Tipo di transazione: coinjoin, tally, funding';

-- Aggiorna statistiche per l'ottimizzatore
ANALYZE;

COMMIT;