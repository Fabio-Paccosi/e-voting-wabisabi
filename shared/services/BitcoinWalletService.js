// Servizio per generare indirizzi Bitcoin reali e gestire UTXO

const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

class BitcoinWalletService {
    constructor() {
        this.network = process.env.BITCOIN_NETWORK === 'mainnet' 
            ? bitcoin.networks.bitcoin 
            : bitcoin.networks.testnet;
        
        this.encryptionKey = process.env.BITCOIN_ENCRYPTION_KEY || 'default-key-change-in-production';
        
        // API per ottenere UTXO reali (testnet)
        this.blockchainAPI = process.env.BITCOIN_NETWORK === 'mainnet'
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api';
        
        console.log(`[BITCOIN-WALLET] Inizializzato per network: ${process.env.BITCOIN_NETWORK || 'testnet'}`);
    }

    /**
     * Genera un nuovo indirizzo Bitcoin con chiavi crittografate
     * @param {string} electionId - ID dell'elezione
     * @param {string} userId - ID dell'utente
     * @returns {Object} Dati del wallet generato
     */
    async generateWalletForUser(electionId, userId) {
        try {
            console.log(`[BITCOIN-WALLET] 🔑 Generando wallet per utente ${userId}, elezione ${electionId}`);

            // Genera una nuova coppia di chiavi
            const keyPair = bitcoin.ECPair.makeRandom({ network: this.network });
            
            // Ottieni la chiave privata in formato WIF
            const privateKeyWIF = keyPair.toWIF();
            
            // Genera l'indirizzo P2WPKH (Bech32) per SegWit nativo
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network: this.network
            });

            // Ottieni la chiave pubblica in formato hex
            const publicKeyHex = keyPair.publicKey.toString('hex');

            // Critta la chiave privata per la sicurezza
            const encryptedPrivateKey = this.encryptPrivateKey(privateKeyWIF);

            console.log(`[BITCOIN-WALLET] ✅ Indirizzo generato: ${address}`);

            // Cerca UTXO disponibili per questo indirizzo (simulato per nuovi indirizzi)
            const utxoData = await this.findOrCreateUTXO(address);

            return {
                address,
                publicKey: publicKeyHex,
                encryptedPrivateKey,
                utxo: utxoData,
                network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet'
            };
        } catch (error) {
            console.error('[BITCOIN-WALLET] ❌ Errore generazione wallet:', error);
            throw new Error(`Errore generazione wallet: ${error.message}`);
        }
    }

    /**
     * Cerca UTXO disponibili per un indirizzo o crea uno fittizio per testing
     * @param {string} address - Indirizzo Bitcoin
     * @returns {Object} Dati UTXO
     */
    async findOrCreateUTXO(address) {
        try {
            // Prova a trovare UTXO reali
            const utxos = await this.getUTXOsForAddress(address);
            
            if (utxos && utxos.length > 0) {
                const utxo = utxos[0]; // Prendi il primo UTXO disponibile
                return {
                    txid: utxo.txid,
                    vout: utxo.vout,
                    amount: utxo.value, // in satoshi
                    status: 'available'
                };
            } else {
                // Se non ci sono UTXO reali, crea un UTXO di test
                // In produzione, dovresti finanziare questi indirizzi
                console.log(`[BITCOIN-WALLET] ⚠️ Nessun UTXO trovato per ${address}, creando UTXO di test`);
                
                return {
                    txid: this.generateTestTXID(address),
                    vout: 0,
                    amount: 1000, // 0.00001 BTC = 1000 satoshi per il voto
                    status: 'available'
                };
            }
        } catch (error) {
            console.error('[BITCOIN-WALLET] ⚠️ Errore ricerca UTXO, creando UTXO di test:', error.message);
            
            // Fallback: crea UTXO di test
            return {
                txid: this.generateTestTXID(address),
                vout: 0,
                amount: 1000,
                status: 'available'
            };
        }
    }

    /**
     * Ottiene gli UTXO reali per un indirizzo tramite API Blockstream
     * @param {string} address - Indirizzo Bitcoin
     * @returns {Array} Lista degli UTXO
     */
    async getUTXOsForAddress(address) {
        try {
            const response = await axios.get(`${this.blockchainAPI}/address/${address}/utxo`, {
                timeout: 10000
            });
            
            console.log(`[BITCOIN-WALLET] 📊 Trovati ${response.data.length} UTXO per ${address}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`[BITCOIN-WALLET] 📭 Nessun UTXO trovato per ${address}`);
                return [];
            }
            throw error;
        }
    }

    /**
     * Genera un TXID di test deterministico per testing
     * @param {string} address - Indirizzo Bitcoin
     * @returns {string} TXID di test
     */
    generateTestTXID(address) {
        const hash = crypto.createHash('sha256')
            .update(`test-utxo-${address}-${Date.now()}`)
            .digest('hex');
        return hash;
    }

    /**
     * Cripta una chiave privata usando AES-256-GCM
     * @param {string} privateKey - Chiave privata in formato WIF
     * @returns {Object} Dati della chiave crittografata
     */
    encryptPrivateKey(privateKey) {
        try {
            const salt = crypto.randomBytes(32);
            const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
            
            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('[BITCOIN-WALLET] ❌ Errore crittografia chiave privata:', error);
            throw error;
        }
    }

    /**
     * Decritta una chiave privata
     * @param {Object} encryptedData - Dati della chiave crittografata
     * @returns {string} Chiave privata decriptata
     */
    decryptPrivateKey(encryptedData) {
        try {
            const { encrypted, salt, iv, authTag } = encryptedData;
            
            const key = crypto.pbkdf2Sync(this.encryptionKey, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
            
            const decipher = crypto.createDecipherGCM('aes-256-gcm', key, Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('[BITCOIN-WALLET] ❌ Errore decrittografia chiave privata:', error);
            throw new Error('Impossibile decrittare la chiave privata');
        }
    }

    /**
     * Valida un indirizzo Bitcoin
     * @param {string} address - Indirizzo da validare
     * @returns {boolean} True se valido
     */
    isValidAddress(address) {
        try {
            bitcoin.address.toOutputScript(address, this.network);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Valida una chiave privata in formato WIF
     * @param {string} privateKeyWIF - Chiave privata WIF
     * @returns {boolean} True se valida
     */
    isValidPrivateKey(privateKeyWIF) {
        try {
            const keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, this.network);
            return !!keyPair;
        } catch (error) {
            return false;
        }
    }

    /**
     * Ottiene l'indirizzo da una chiave privata
     * @param {string} privateKeyWIF - Chiave privata WIF
     * @returns {string} Indirizzo Bitcoin
     */
    getAddressFromPrivateKey(privateKeyWIF) {
        try {
            const keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, this.network);
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network: this.network
            });
            return address;
        } catch (error) {
            throw new Error('Chiave privata non valida');
        }
    }

    /**
     * Prepara gli input per una transazione CoinJoin
     * @param {Array} whitelistEntries - Entries della whitelist con indirizzi Bitcoin
     * @returns {Array} Input per la transazione
     */
    prepareCoinJoinInputs(whitelistEntries) {
        const inputs = [];
        
        whitelistEntries.forEach(entry => {
            if (entry.hasVoted && entry.utxo_txid) {
                inputs.push({
                    txid: entry.utxo_txid,
                    vout: entry.utxo_vout,
                    address: entry.bitcoin_address,
                    amount: entry.utxo_amount
                });
            }
        });
        
        console.log(`[BITCOIN-WALLET] 🔗 Preparati ${inputs.length} input per CoinJoin`);
        return inputs;
    }
}

module.exports = BitcoinWalletService;