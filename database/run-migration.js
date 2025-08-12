// Script di migrazione e inizializzazione del database
//TODO RIMUOVER EMOTICONS

const { 
    sequelize, 
    User, 
    Credential, 
    Election, 
    Candidate, 
    VotingSession, 
    Vote, 
    Transaction,
    syncDatabase,
    seedDatabase 
} = require('./models');

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// ====================
// SCRIPT DI MIGRAZIONE
// ====================

class DatabaseMigration {
    constructor() {
        this.migrations = [];
    }

    // Inizializza il database con tabelle e indici
    async initialize() {
        try {
            console.log('🔄 Inizializzazione database...');
            
            // Test connessione
            await sequelize.authenticate();
            console.log('✅ Connessione al database stabilita');

            // Sincronizza modelli (crea tabelle)
            await syncDatabase(false); // false = non elimina tabelle esistenti
            console.log('✅ Tabelle sincronizzate');

            // Crea indici personalizzati
            await this.createCustomIndexes();
            console.log('✅ Indici creati');

            // Crea viste materializzate per performance
            await this.createMaterializedViews();
            console.log('✅ Viste materializzate create');

            // Crea trigger e stored procedures
            await this.createTriggersAndProcedures();
            console.log('✅ Trigger e procedure create');

            console.log('🎉 Database inizializzato con successo!');
        } catch (error) {
            console.error('❌ Errore inizializzazione database:', error);
            throw error;
        }
    }

    // Crea indici personalizzati per ottimizzare le query
    async createCustomIndexes() {
        const queries = [
            // Indice composito per ricerca voti per sessione e stato
            `CREATE INDEX IF NOT EXISTS idx_votes_session_status 
             ON votes(session_id, status) 
             WHERE status = 'pending'`,

            // Indice per ricerca credenziali non utilizzate
            `CREATE INDEX IF NOT EXISTS idx_credentials_unused 
             ON credentials(user_id) 
             WHERE is_used = false`,

            // Indice per transazioni non confermate
            `CREATE INDEX IF NOT EXISTS idx_transactions_unconfirmed 
             ON transactions(type, confirmations) 
             WHERE confirmations < 6`,

            // Indice full-text per ricerca elezioni
            `CREATE INDEX IF NOT EXISTS idx_elections_search 
             ON elections USING gin(to_tsvector('italian', title || ' ' || coalesce(description, '')))`
        ];

        for (const query of queries) {
            await sequelize.query(query);
        }
    }

    // Crea viste materializzate per report e statistiche
    async createMaterializedViews() {
        // Vista per statistiche elezioni
        await sequelize.query(`
            CREATE MATERIALIZED VIEW IF NOT EXISTS election_stats AS
            SELECT 
                e.id as election_id,
                e.title,
                COUNT(DISTINCT vs.id) as total_sessions,
                COUNT(DISTINCT v.id) as total_votes,
                COUNT(DISTINCT v.serial_number) as unique_voters,
                MIN(vs."startTime") as first_vote_time,
                MAX(vs."endTime") as last_vote_time
            FROM elections e
            LEFT JOIN voting_sessions vs ON e.id = vs.election_id
            LEFT JOIN votes v ON vs.id = v.session_id
            GROUP BY e.id, e.title
        `);

        // Vista per monitoraggio transazioni
        await sequelize.query(`
            CREATE MATERIALIZED VIEW IF NOT EXISTS transaction_summary AS
            SELECT 
                t.type,
                DATE(t."createdAt") as date,
                COUNT(*) as count,
                AVG(t.confirmations) as avg_confirmations,
                COUNT(CASE WHEN t.confirmations >= 6 THEN 1 END) as confirmed_count
            FROM transactions t
            GROUP BY t.type, DATE(t."createdAt")
        `);

        // Crea indici sulle viste materializzate
        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_election_stats_id 
            ON election_stats(election_id)
        `);

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_transaction_summary_date 
            ON transaction_summary(date DESC)
        `);
    }

    // Crea trigger per automazioni
    async createTriggersAndProcedures() {
        // Trigger per aggiornare hasVoted quando una credenziale viene usata
        await sequelize.query(`
            CREATE OR REPLACE FUNCTION update_user_voted_status()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.is_used = true AND OLD.is_used = false THEN
                    UPDATE users 
                    SET "hasVoted" = true, "updatedAt" = NOW()
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
        `);

        // Trigger per chiudere automaticamente sessioni scadute
        await sequelize.query(`
            CREATE OR REPLACE FUNCTION close_expired_sessions()
            RETURNS void AS $$
            BEGIN
                UPDATE voting_sessions
                SET status = 'closed', "endTime" = NOW(), "updatedAt" = NOW()
                WHERE status = 'active' 
                AND "startTime" < NOW() - INTERVAL '30 minutes';
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Stored procedure per conteggio voti aggregato
        await sequelize.query(`
            CREATE OR REPLACE FUNCTION count_votes_by_election(election_uuid UUID)
            RETURNS TABLE(
                candidate_id UUID,
                candidate_name VARCHAR,
                vote_count BIGINT,
                percentage NUMERIC(5,2)
            ) AS $$
            DECLARE
                total_votes BIGINT;
            BEGIN
                -- Conta voti totali
                SELECT COUNT(DISTINCT v.id) INTO total_votes
                FROM votes v
                JOIN voting_sessions vs ON v.session_id = vs.id
                WHERE vs.election_id = election_uuid
                AND v.status = 'confirmed';

                -- Ritorna risultati per candidato
                RETURN QUERY
                SELECT 
                    c.id,
                    c.name,
                    COUNT(v.id) as vote_count,
                    CASE 
                        WHEN total_votes > 0 
                        THEN ROUND((COUNT(v.id)::NUMERIC / total_votes) * 100, 2)
                        ELSE 0
                    END as percentage
                FROM candidates c
                LEFT JOIN votes v ON 
                    -- Qui dovremmo decifrare il commitment per determinare il candidato
                    -- Per ora simuliamo con modulo sul serial number
                    MOD(('x' || substr(v.serial_number, 4, 8))::bit(32)::int, 
                        (SELECT COUNT(*) FROM candidates WHERE election_id = election_uuid)) = c.value_encoding
                    AND v.status = 'confirmed'
                LEFT JOIN voting_sessions vs ON v.session_id = vs.id
                WHERE c.election_id = election_uuid
                GROUP BY c.id, c.name
                ORDER BY vote_count DESC;
            END;
            $$ LANGUAGE plpgsql;
        `);
    }

    // Popola il database con dati di test
    async seedTestData() {
        try {
            console.log('🌱 Popolamento database con dati di test...');

            // Crea utenti di test
            const testUsers = [
                {
                    email: 'alice@example.com',
                    password: await bcrypt.hash('password123', 10),
                    firstName: 'Alice',
                    lastName: 'Rossi',
                    taxCode: 'RSSMRA85M01H501Z',
                    isAuthorized: true,
                    authorizationProof: 'whitelist_verified'
                },
                {
                    email: 'bob@example.com',
                    password: await bcrypt.hash('password123', 10),
                    firstName: 'Bob',
                    lastName: 'Verdi',
                    taxCode: 'VRDGPP90L15H501A',
                    isAuthorized: true,
                    authorizationProof: 'whitelist_verified'
                },
                {
                    email: 'charlie@example.com',
                    password: await bcrypt.hash('password123', 10),
                    firstName: 'Charlie',
                    lastName: 'Bianchi',
                    taxCode: 'BNCLRA88S20H501B',
                    isAuthorized: true,
                    authorizationProof: 'whitelist_verified'
                }
            ];

            const users = await User.bulkCreate(testUsers, { 
                ignoreDuplicates: true 
            });
            console.log(`✅ ${users.length} utenti creati`);

            // Crea un'elezione di test
            const election = await Election.findOrCreate({
                where: { title: 'Elezione Comunale 2025' },
                defaults: {
                    description: 'Elezione del sindaco e consiglio comunale',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 giorni
                    isActive: true,
                    metadata: {
                        type: 'municipal',
                        location: 'Bari',
                        eligibleVoters: 150000
                    }
                }
            });
            console.log('✅ Elezione creata');

            // Crea candidati
            const candidates = [
                {
                    electionId: election[0].id,
                    name: 'Giovanni Rossi',
                    description: 'Candidato del Partito Democratico',
                    valueEncoding: 0
                },
                {
                    electionId: election[0].id,
                    name: 'Maria Bianchi',
                    description: 'Candidata di Forza Italia',
                    valueEncoding: 1
                },
                {
                    electionId: election[0].id,
                    name: 'Luigi Verdi',
                    description: 'Candidato del Movimento 5 Stelle',
                    valueEncoding: 2
                }
            ];

            await Candidate.bulkCreate(candidates, { 
                ignoreDuplicates: true 
            });
            console.log(`✅ ${candidates.length} candidati creati`);

            // Crea una sessione di voto attiva
            const session = await VotingSession.findOrCreate({
                where: { 
                    electionId: election[0].id,
                    status: 'active'
                },
                defaults: {
                    status: 'active',
                    metadata: {
                        seggio: 'Seggio 1 - Centro',
                        responsabile: 'Mario Neri'
                    }
                }
            });
            console.log('✅ Sessione di voto creata');

            console.log('🎉 Database popolato con successo!');
        } catch (error) {
            console.error('❌ Errore nel seed:', error);
            throw error;
        }
    }

    // Crea job schedulati per manutenzione
    async setupMaintenanceJobs() {
        console.log('⏰ Configurazione job di manutenzione...');

        // Job per chiudere sessioni scadute (ogni 5 minuti)
        setInterval(async () => {
            try {
                await sequelize.query('SELECT close_expired_sessions()');
            } catch (error) {
                console.error('Errore chiusura sessioni:', error);
            }
        }, 5 * 60 * 1000);

        // Job per aggiornare viste materializzate (ogni ora)
        setInterval(async () => {
            try {
                await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY election_stats');
                await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY transaction_summary');
            } catch (error) {
                console.error('Errore refresh viste:', error);
            }
        }, 60 * 60 * 1000);

        console.log('✅ Job di manutenzione configurati');
    }

    // Backup del database
    async backup(filename) {
        const { exec } = require('child_process');
        const path = require('path');

        const backupPath = path.join(__dirname, '..', 'backups', filename || `backup_${Date.now()}.sql`);

        return new Promise((resolve, reject) => {
            exec(
                `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -f ${backupPath}`,
                { env: { ...process.env, PGPASSWORD: process.env.DB_PASS } },
                (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(backupPath);
                    }
                }
            );
        });
    }

    // Restore del database
    async restore(filename) {
        const { exec } = require('child_process');
        const path = require('path');

        const backupPath = path.join(__dirname, '..', 'backups', filename);

        return new Promise((resolve, reject) => {
            exec(
                `psql -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -f ${backupPath}`,
                { env: { ...process.env, PGPASSWORD: process.env.DB_PASS } },
                (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }
}

// ====================
// ESECUZIONE SCRIPT
// ====================

if (require.main === module) {
    const migration = new DatabaseMigration();

    const command = process.argv[2];

    switch (command) {
        case 'init':
            migration.initialize()
                .then(() => process.exit(0))
                .catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            break;

        case 'seed':
            migration.seedTestData()
                .then(() => process.exit(0))
                .catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            break;

        case 'backup':
            migration.backup(process.argv[3])
                .then(path => {
                    console.log('✅ Backup salvato:', path);
                    process.exit(0);
                })
                .catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            break;

        case 'restore':
            if (!process.argv[3]) {
                console.error('❌ Specifica il file di backup');
                process.exit(1);
            }
            migration.restore(process.argv[3])
                .then(() => {
                    console.log('✅ Restore completato');
                    process.exit(0);
                })
                .catch(err => {
                    console.error(err);
                    process.exit(1);
                });
            break;

        default:
            console.log(`
Utilizzo: node migrate.js [comando]

Comandi disponibili:
  init     - Inizializza il database con tabelle e indici
  seed     - Popola il database con dati di test
  backup   - Crea un backup del database
  restore  - Ripristina da un backup

Esempi:
  node migrate.js init
  node migrate.js seed
  node migrate.js backup backup_20240101.sql
  node migrate.js restore backup_20240101.sql
            `);
            process.exit(0);
    }
}

module.exports = DatabaseMigration;