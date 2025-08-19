#!/usr/bin/env node

// scripts/generate-bitcoin-addresses.js
// Script per generare indirizzi Bitcoin per gli utenti

const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const { User, sequelize } = require('../database/models');
require('dotenv').config();

// ====================
// CONFIGURAZIONE
// ====================

const NETWORK = bitcoin.networks.testnet; // Usa testnet per lo sviluppo
const ENCRYPTION_KEY = process.env.BITCOIN_ENCRYPTION_KEY || 'default-key-change-in-production';

// ====================
// UTILITY FUNCTIONS
// ====================

// Crittografia semplice per le chiavi private (in produzione usare una soluzione più robusta)
function encryptPrivateKey(privateKey) {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptPrivateKey(encryptedKey) {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Genera un nuovo indirizzo Bitcoin testnet
function generateBitcoinAddress() {
    try {
        // Genera una nuova coppia di chiavi
        const keyPair = bitcoin.ECPair.makeRandom({ network: NETWORK });
        
        // Ottieni la chiave privata in formato WIF
        const privateKeyWIF = keyPair.toWIF();
        
        // Genera l'indirizzo P2WPKH (Bech32)
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: NETWORK
        });

        return {
            address,
            privateKey: privateKeyWIF,
            publicKey: keyPair.publicKey.toString('hex'),
            network: 'testnet'
        };
    } catch (error) {
        console.error('Errore generazione indirizzo Bitcoin:', error);
        throw error;
    }
}

// Valida un indirizzo Bitcoin
function isValidBitcoinAddress(address) {
    try {
        bitcoin.address.toOutputScript(address, NETWORK);
        return true;
    } catch (error) {
        return false;
    }
}

// ====================
// CLASSE PRINCIPALE
// ====================

class BitcoinAddressGenerator {
    constructor() {
        this.stats = {
            total: 0,
            generated: 0,
            skipped: 0,
            errors: 0
        };
    }

    // Connessione al database
    async connect() {
        try {
            await sequelize.authenticate();
            console.log(' Connesso al database');
        } catch (error) {
            console.error(' Errore connessione database:', error.message);
            throw error;
        }
    }

    // Genera indirizzi per tutti gli utenti che non ne hanno uno
    async generateForAllUsers() {
        try {
            console.log('🚀 Avvio generazione indirizzi Bitcoin...\n');

            await this.connect();

            // Trova tutti gli utenti senza indirizzo Bitcoin
            const users = await User.findAll({
                where: {
                    bitcoinAddress: null
                },
                attributes: ['id', 'email', 'firstName', 'lastName', 'bitcoinAddress']
            });

            this.stats.total = users.length;

            if (users.length === 0) {
                console.log('ℹ️  Tutti gli utenti hanno già un indirizzo Bitcoin');
                return;
            }

            console.log(` Trovati ${users.length} utenti senza indirizzo Bitcoin\n`);

            // Genera indirizzi per ogni utente
            for (const user of users) {
                try {
                    await this.generateForUser(user);
                    this.stats.generated++;
                } catch (error) {
                    console.error(` Errore per utente ${user.email}:`, error.message);
                    this.stats.errors++;
                }
            }

            console.log('\n🎉 GENERAZIONE COMPLETATA!');
            console.log(` Statistiche:`);
            console.log(`   • Utenti totali: ${this.stats.total}`);
            console.log(`   • Indirizzi generati: ${this.stats.generated}`);
            console.log(`   • Errori: ${this.stats.errors}`);

        } catch (error) {
            console.error('💥 Errore durante la generazione:', error.message);
            throw error;
        }
    }

    // Genera indirizzo per un singolo utente
    async generateForUser(user) {
        try {
            console.log(` Generando indirizzo per: ${user.email}`);

            // Genera nuovo indirizzo Bitcoin
            const bitcoinData = generateBitcoinAddress();

            // Critta la chiave privata
            const encryptedPrivateKey = encryptPrivateKey(bitcoinData.privateKey);

            // Aggiorna l'utente nel database
            await user.update({
                bitcoinAddress: bitcoinData.address,
                bitcoinPrivateKey: encryptedPrivateKey
            });

            console.log(` Indirizzo generato: ${bitcoinData.address}`);

            return bitcoinData;
        } catch (error) {
            console.error(` Errore generazione per ${user.email}:`, error.message);
            throw error;
        }
    }

    // Genera indirizzo per un utente specifico
    async generateForSpecificUser(email) {
        try {
            await this.connect();

            const user = await User.findOne({
                where: { email },
                attributes: ['id', 'email', 'firstName', 'lastName', 'bitcoinAddress']
            });

            if (!user) {
                throw new Error(`Utente non trovato: ${email}`);
            }

            if (user.bitcoinAddress) {
                console.log(`⚠️  L'utente ${email} ha già un indirizzo Bitcoin: ${user.bitcoinAddress}`);
                console.log('Vuoi sovrascriverlo? (questo script non sovrascrive automaticamente)');
                return;
            }

            const bitcoinData = await this.generateForUser(user);
            console.log(` Indirizzo generato per ${email}: ${bitcoinData.address}`);

        } catch (error) {
            console.error(' Errore:', error.message);
            throw error;
        }
    }

    // Mostra tutti gli indirizzi generati
    async showAllAddresses() {
        try {
            await this.connect();

            const users = await User.findAll({
                where: {
                    bitcoinAddress: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                },
                attributes: ['email', 'firstName', 'lastName', 'bitcoinAddress', 'createdAt'],
                order: [['createdAt', 'ASC']]
            });

            console.log('\n📋 INDIRIZZI BITCOIN UTENTI:\n');
            console.log('Email'.padEnd(30) + ' | Nome'.padEnd(20) + ' | Indirizzo Bitcoin');
            console.log(''.padEnd(80, '-'));

            for (const user of users) {
                const name = `${user.firstName} ${user.lastName}`;
                console.log(
                    user.email.padEnd(30) + ' | ' + 
                    name.padEnd(20) + ' | ' + 
                    user.bitcoinAddress
                );
            }

            console.log(''.padEnd(80, '-'));
            console.log(`Totale utenti con indirizzo Bitcoin: ${users.length}`);

        } catch (error) {
            console.error(' Errore visualizzazione indirizzi:', error.message);
            throw error;
        }
    }

    // Verifica la validità di tutti gli indirizzi
    async verifyAllAddresses() {
        try {
            await this.connect();

            const users = await User.findAll({
                where: {
                    bitcoinAddress: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                },
                attributes: ['email', 'bitcoinAddress']
            });

            console.log(' Verifica validità indirizzi Bitcoin...\n');

            let validCount = 0;
            let invalidCount = 0;

            for (const user of users) {
                const isValid = isValidBitcoinAddress(user.bitcoinAddress);
                
                if (isValid) {
                    console.log(` ${user.email}: ${user.bitcoinAddress}`);
                    validCount++;
                } else {
                    console.log(` ${user.email}: ${user.bitcoinAddress} (INVALIDO)`);
                    invalidCount++;
                }
            }

            console.log(`\n Risultati verifica:`);
            console.log(`   • Indirizzi validi: ${validCount}`);
            console.log(`   • Indirizzi invalidi: ${invalidCount}`);

        } catch (error) {
            console.error(' Errore verifica indirizzi:', error.message);
            throw error;
        }
    }

    // Esporta indirizzi in formato CSV
    async exportToCSV(filename = 'bitcoin_addresses.csv') {
        try {
            await this.connect();

            const users = await User.findAll({
                where: {
                    bitcoinAddress: {
                        [sequelize.Sequelize.Op.ne]: null
                    }
                },
                attributes: ['email', 'firstName', 'lastName', 'bitcoinAddress', 'createdAt']
            });

            const fs = require('fs');
            const csvContent = [
                'Email,Nome,Cognome,Indirizzo Bitcoin,Data Creazione',
                ...users.map(user => 
                    `${user.email},${user.firstName},${user.lastName},${user.bitcoinAddress},${user.createdAt.toISOString()}`
                )
            ].join('\n');

            fs.writeFileSync(filename, csvContent);
            console.log(` Indirizzi esportati in: ${filename}`);

        } catch (error) {
            console.error(' Errore esportazione:', error.message);
            throw error;
        }
    }
}

// ====================
// CLI HANDLER
// ====================

async function main() {
    const generator = new BitcoinAddressGenerator();
    const command = process.argv[2];
    const arg = process.argv[3];

    console.log('₿  E-Voting WabiSabi - Bitcoin Address Generator\n');

    try {
        switch (command) {
            case 'generate':
            case undefined:
                await generator.generateForAllUsers();
                break;

            case 'user':
                if (!arg) {
                    console.error(' Email utente richiesta');
                    console.log('Uso: npm run bitcoin:generate-addresses user <email>');
                    process.exit(1);
                }
                await generator.generateForSpecificUser(arg);
                break;

            case 'list':
                await generator.showAllAddresses();
                break;

            case 'verify':
                await generator.verifyAllAddresses();
                break;

            case 'export':
                await generator.exportToCSV(arg);
                break;

            case 'help':
            case '--help':
            case '-h':
                console.log('Comandi disponibili:');
                console.log('  generate (default) - Genera indirizzi per tutti gli utenti');
                console.log('  user <email>       - Genera indirizzo per un utente specifico');
                console.log('  list               - Mostra tutti gli indirizzi generati');
                console.log('  verify             - Verifica la validità di tutti gli indirizzi');
                console.log('  export [file.csv]  - Esporta indirizzi in CSV');
                console.log('  help               - Mostra questo messaggio');
                break;

            default:
                console.error(` Comando sconosciuto: ${command}`);
                console.log('Usa "help" per vedere i comandi disponibili');
                process.exit(1);
        }
    } catch (error) {
        console.error('💥 Errore fatale:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Errore fatale:', error.message);
        process.exit(1);
    });
}

module.exports = BitcoinAddressGenerator;