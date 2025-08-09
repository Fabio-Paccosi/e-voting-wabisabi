-- Creazione tabelle per sistema admin

-- Tabella admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella admin sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella system settings
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    updated_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella backup records
CREATE TABLE IF NOT EXISTS backup_records (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    backup_type VARCHAR(20) DEFAULT 'full',
    status VARCHAR(20) DEFAULT 'completed',
    created_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Inserimento admin default
INSERT INTO admin_users (username, password_hash, email, role) 
VALUES (
    'admin', 
    '$2b$10$xyz...', -- Password: admin123 (da hashare)
    'admin@evoting.local',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Impostazioni di sistema default
INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES
('app_name', '"E-Voting WabiSabi"', 'general', 'Nome applicazione'),
('environment', '"development"', 'general', 'Ambiente di esecuzione'),
('jwt_expiration_hours', '24', 'security', 'Durata token JWT in ore'),
('rate_limit', '100', 'security', 'Limite richieste per minuto'),
('require_2fa', 'false', 'security', 'Richiedi autenticazione 2FA'),
('enable_ip_whitelist', 'false', 'security', 'Abilita whitelist IP'),
('db_pool_max', '20', 'database', 'Max connessioni pool DB'),
('db_query_timeout', '30000', 'database', 'Timeout query in ms'),
('enable_query_logging', 'false', 'database', 'Abilita log query SQL')
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();