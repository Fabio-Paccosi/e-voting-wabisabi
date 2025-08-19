const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class MigrationRunner {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'SecurePass123!',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'evoting_wabisabi'
        });
    }

    async createMigrationsTable() {
        const client = await this.pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) UNIQUE NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✓ Tabella migrations creata');
        } finally {
            client.release();
        }
    }

    async getExecutedMigrations() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT filename FROM schema_migrations ORDER BY executed_at'
            );
            return result.rows.map(row => row.filename);
        } finally {
            client.release();
        }
    }

    async executeMigration(filename, content) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Esegui il contenuto del file migration
            await client.query(content);
            
            // Registra la migration come eseguita
            await client.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1)',
                [filename]
            );
            
            await client.query('COMMIT');
            console.log(`✓ Migration ${filename} eseguita`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Errore esecuzione ${filename}: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async runMigrations() {
        try {
            console.log(' Avvio migrations...');
            
            // Crea tabella migrations se non exists
            await this.createMigrationsTable();
            
            // Ottieni migrations già eseguite
            const executedMigrations = await this.getExecutedMigrations();
            console.log(`📋 Migrations eseguite: ${executedMigrations.length}`);
            
            // Leggi file migrations dalla directory
            const migrationsDir = __dirname;
            const files = await fs.readdir(migrationsDir);
            const migrationFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort(); // Ordine alfabetico
            
            console.log(`📁 Migrations trovate: ${migrationFiles.length}`);
            
            // Esegui migrations non ancora eseguite
            for (const filename of migrationFiles) {
                if (!executedMigrations.includes(filename)) {
                    console.log(` Eseguendo ${filename}...`);
                    
                    const filePath = path.join(migrationsDir, filename);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    await this.executeMigration(filename, content);
                } else {
                    console.log(`⏭️ ${filename} già eseguita`);
                }
            }
            
            console.log(' Tutte le migrations completate');
            
        } catch (error) {
            console.error(' Errore migrations:', error.message);
            process.exit(1);
        }
    }

    async rollback(steps = 1) {
        try {
            console.log(` Rollback ultime ${steps} migrations...`);
            
            const client = await this.pool.connect();
            try {
                const result = await client.query(`
                    SELECT filename FROM schema_migrations 
                    ORDER BY executed_at DESC 
                    LIMIT $1
                `, [steps]);
                
                for (const row of result.rows) {
                    await client.query(
                        'DELETE FROM schema_migrations WHERE filename = $1',
                        [row.filename]
                    );
                    console.log(`↩️ Rollback ${row.filename}`);
                }
                
                console.log(' Rollback completato');
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error(' Errore rollback:', error.message);
            process.exit(1);
        }
    }

    async status() {
        try {
            const executedMigrations = await this.getExecutedMigrations();
            
            const migrationsDir = __dirname;
            const files = await fs.readdir(migrationsDir);
            const migrationFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort();
            
            console.log('\n Status Migrations:');
            console.log('='.repeat(50));
            
            for (const filename of migrationFiles) {
                const status = executedMigrations.includes(filename) ? '' : '⏳';
                console.log(`${status} ${filename}`);
            }
            
            const pending = migrationFiles.filter(f => !executedMigrations.includes(f));
            console.log('\n📋 Riepilogo:');
            console.log(`  Eseguite: ${executedMigrations.length}`);
            console.log(`  In attesa: ${pending.length}`);
            console.log(`  Totali: ${migrationFiles.length}`);
            
        } catch (error) {
            console.error(' Errore status:', error.message);
            process.exit(1);
        }
    }

    async close() {
        await this.pool.end();
    }
}

// CLI Interface
async function main() {
    const command = process.argv[2] || 'run';
    const migrationRunner = new MigrationRunner();
    
    try {
        switch (command) {
            case 'run':
            case 'migrate':
                await migrationRunner.runMigrations();
                break;
                
            case 'rollback':
                const steps = parseInt(process.argv[3]) || 1;
                await migrationRunner.rollback(steps);
                break;
                
            case 'status':
                await migrationRunner.status();
                break;
                
            default:
                console.log('Uso: node run-migrations.js [run|rollback|status]');
                console.log('  run      - Esegue tutte le migrations pending');
                console.log('  rollback - Rollback ultima migration (o N specificate)');
                console.log('  status   - Mostra status migrations');
                process.exit(1);
        }
    } finally {
        await migrationRunner.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MigrationRunner;