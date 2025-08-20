#!/usr/bin/env node

// scripts/run-migrations.js
// Script automatico per eseguire tutte le migrazioni del database

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// ====================
// CONFIGURAZIONE
// ====================

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'evoting_wabisabi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password'
};

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

// ====================
// CLASSE MIGRATION RUNNER
// ====================

class MigrationRunner {
    constructor() {
        this.client = new Client(config);
        this.isConnected = false;
    }

    // Connessione al database
    async connect() {
        try {
            await this.client.connect();
            this.isConnected = true;
            console.log(' Connesso al database:', config.database);
        } catch (error) {
            console.error(' Errore connessione database:', error.message);
            throw error;
        }
    }

    // Disconnessione dal database
    async disconnect() {
        if (this.isConnected) {
            await this.client.end();
            this.isConnected = false;
            console.log(' Disconnesso dal database');
        }
    }

    // Crea la tabella per tracciare le migrazioni
    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                checksum VARCHAR(64) NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_migrations_filename 
            ON ${MIGRATIONS_TABLE}(filename);
        `;

        try {
            await this.client.query(query);
            console.log(' Tabella migrazioni creata/verificata');
        } catch (error) {
            console.error(' Errore creazione tabella migrazioni:', error.message);
            throw error;
        }
    }

    // Ottiene la lista dei file di migrazione
    getMigrationFiles() {
        try {
            if (!fs.existsSync(MIGRATIONS_DIR)) {
                console.log(' Cartella migrations non trovata:', MIGRATIONS_DIR);
                return [];
            }

            const files = fs.readdirSync(MIGRATIONS_DIR)
                .filter(file => file.endsWith('.sql'))
                .sort(); // Ordinamento alfabetico (importante per l'ordine)

            console.log(`📂 Trovati ${files.length} file di migrazione`);
            return files;
        } catch (error) {
            console.error(' Errore lettura cartella migrations:', error.message);
            throw error;
        }
    }

    // Calcola checksum per verificare l'integrità del file
    calculateChecksum(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    // Verifica se una migrazione è già stata eseguita
    async isMigrationExecuted(filename, checksum) {
        const query = `
            SELECT filename, checksum 
            FROM ${MIGRATIONS_TABLE} 
            WHERE filename = $1
        `;

        try {
            const result = await this.client.query(query, [filename]);
            
            if (result.rows.length === 0) {
                return false; // Non eseguita
            }

            const existingChecksum = result.rows[0].checksum;
            if (existingChecksum !== checksum) {
                throw new Error(
                    `Checksum non corrisponde per ${filename}. ` +
                    `Il file di migrazione è stato modificato dopo l'esecuzione!`
                );
            }

            return true; // Già eseguita
        } catch (error) {
            if (error.message.includes('Checksum non corrisponde')) {
                throw error;
            }
            console.error(' Errore verifica migrazione:', error.message);
            throw error;
        }
    }

    // Esegue una singola migrazione
    async executeMigration(filename) {
        const filePath = path.join(MIGRATIONS_DIR, filename);
        
        try {
            console.log(` Eseguendo migrazione: ${filename}`);
            
            // Legge il contenuto del file
            const content = fs.readFileSync(filePath, 'utf8');
            const checksum = this.calculateChecksum(content);

            // Verifica se già eseguita
            if (await this.isMigrationExecuted(filename, checksum)) {
                console.log(`⏭️  Migrazione ${filename} già eseguita, saltando`);
                return;
            }

            // Inizia transazione
            await this.client.query('BEGIN');

            try {
                // Esegue la migrazione
                await this.client.query(content);

                // Registra l'esecuzione
                await this.client.query(
                    `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES ($1, $2)`,
                    [filename, checksum]
                );

                // Conferma transazione
                await this.client.query('COMMIT');
                console.log(` Migrazione ${filename} eseguita con successo`);

            } catch (error) {
                // Rollback in caso di errore
                await this.client.query('ROLLBACK');
                throw error;
            }

        } catch (error) {
            console.error(` Errore esecuzione migrazione ${filename}:`, error.message);
            throw error;
        }
    }

    // Esegue tutte le migrazioni
    async runAllMigrations() {
        try {
            console.log('Avvio esecuzione migrazioni...\n');

            await this.connect();
            await this.createMigrationsTable();

            const migrationFiles = this.getMigrationFiles();

            if (migrationFiles.length === 0) {
                console.log('ℹ️  Nessuna migrazione da eseguire');
                return;
            }

            let executedCount = 0;
            let skippedCount = 0;

            for (const filename of migrationFiles) {
                try {
                    const filePath = path.join(MIGRATIONS_DIR, filename);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const checksum = this.calculateChecksum(content);

                    if (await this.isMigrationExecuted(filename, checksum)) {
                        skippedCount++;
                        continue;
                    }

                    await this.executeMigration(filename);
                    executedCount++;

                } catch (error) {
                    console.error(`\n ERRORE CRITICO nella migrazione ${filename}:`);
                    console.error(error.message);
                    console.error('\n🛑 Esecuzione interrotta per preservare l\'integrità del database');
                    throw error;
                }
            }

            console.log('\n🎉 TUTTE LE MIGRAZIONI COMPLETATE!');
            console.log(` Statistiche:`);
            console.log(`   • Migrazioni eseguite: ${executedCount}`);
            console.log(`   • Migrazioni saltate: ${skippedCount}`);
            console.log(`   • Totale file: ${migrationFiles.length}`);

        } catch (error) {
            console.error('\n💥 ERRORE DURANTE L\'ESECUZIONE DELLE MIGRAZIONI:');
            console.error(error.message);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }

    // Mostra lo stato delle migrazioni
    async showStatus() {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const migrationFiles = this.getMigrationFiles();
            const executedQuery = `SELECT filename, executed_at FROM ${MIGRATIONS_TABLE} ORDER BY filename`;
            const executedResult = await this.client.query(executedQuery);
            
            const executed = new Map(
                executedResult.rows.map(row => [row.filename, row.executed_at])
            );

            console.log('\nSTATO MIGRAZIONI:\n');
            console.log('File di migrazione | Stato | Data esecuzione');
            console.log(''.padEnd(70, '-'));

            for (const filename of migrationFiles) {
                const status = executed.has(filename) ? ' Eseguita' : '⏸️  Pendente';
                const date = executed.get(filename) || 'N/A';
                
                console.log(`${filename.padEnd(30)} | ${status.padEnd(10)} | ${date}`);
            }

            console.log(''.padEnd(70, '-'));
            console.log(`Totale: ${migrationFiles.length} | Eseguite: ${executed.size} | Pendenti: ${migrationFiles.length - executed.size}`);

        } catch (error) {
            console.error(' Errore visualizzazione stato:', error.message);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }

    // Crea una nuova migrazione
    async createMigration(name) {
        if (!name) {
            console.error(' Nome della migrazione richiesto');
            console.log('Uso: npm run migration:create <nome>');
            process.exit(1);
        }

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
        const filepath = path.join(MIGRATIONS_DIR, filename);

        const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: ${name}

-- UP Migration
BEGIN;

-- Aggiungi qui le modifiche al database
-- Esempio:
-- CREATE TABLE example (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

COMMIT;

-- Se necessario, aggiungi qui il rollback (commentato)
-- DOWN Migration (per riferimento, non eseguito automaticamente)
-- BEGIN;
-- DROP TABLE IF EXISTS example;
-- COMMIT;
`;

        try {
            // Crea la cartella se non esiste
            if (!fs.existsSync(MIGRATIONS_DIR)) {
                fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
            }

            fs.writeFileSync(filepath, template);
            console.log(` Migrazione creata: ${filename}`);
            console.log(`📁 Percorso: ${filepath}`);
        } catch (error) {
            console.error(' Errore creazione migrazione:', error.message);
            process.exit(1);
        }
    }
}

// ====================
// CLI HANDLER
// ====================

async function main() {
    const runner = new MigrationRunner();
    const command = process.argv[2];
    const arg = process.argv[3];

    console.log('🗄️  E-Voting WabiSabi - Migration Runner\n');

    switch (command) {
        case 'run':
        case undefined:
            await runner.runAllMigrations();
            break;

        case 'status':
            await runner.showStatus();
            break;

        case 'create':
            await runner.createMigration(arg);
            break;

        case 'help':
        case '--help':
        case '-h':
            console.log('Comandi disponibili:');
            console.log('  run (default)  - Esegue tutte le migrazioni pendenti');
            console.log('  status         - Mostra lo stato delle migrazioni');
            console.log('  create <nome>  - Crea una nuova migrazione');
            console.log('  help           - Mostra questo messaggio');
            break;

        default:
            console.error(` Comando sconosciuto: ${command}`);
            console.log('Usa "help" per vedere i comandi disponibili');
            process.exit(1);
    }
}

// Gestione errori non catturati
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Esegui solo se chiamato direttamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Errore fatale:', error.message);
        process.exit(1);
    });
}

module.exports = MigrationRunner;