// Servizio per generare indirizzi Bitcoin reali e gestire UTXO

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// DEBUG IMPORT
let bitcoin;
try {
    bitcoin = require('bitcoinjs-lib');
    console.log('[BITCOIN-WALLET] BitcoinJS-lib caricato:', !!bitcoin);
    console.log('[BITCOIN-WALLET] ECPair disponibile:', !!bitcoin?.ECPair);
} catch (error) {
    console.error('[BITCOIN-WALLET] Errore import:', error.message);
    bitcoin = null;
}

class BitcoinWalletService {
    constructor() {
        if (!bitcoin || !bitcoin.ECPair) {
            console.warn('[BITCOIN-WALLET] BitcoinJS-lib non disponibile, usando modalità simulazione');
            this.simulationMode = true;
        } else {
            this.simulationMode = false;
        }
        
        this.network = process.env.BITCOIN_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        this.encryptionKey = process.env.BITCOIN_ENCRYPTION_KEY || 'default-key-change-in-production';
        this.blockchainAPI = this.network === 'mainnet'
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api';
    }

    async generateWalletForUser(electionId, userId) {
        if (this.simulationMode) {
            return this.generateSimulatedWallet(electionId, userId);
        }
        
        try {
            const network = this.network === 'mainnet' 
                ? bitcoin.networks.bitcoin 
                : bitcoin.networks.testnet;

            const keyPair = bitcoin.ECPair.makeRandom({ network });
            const privateKeyWIF = keyPair.toWIF();
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network
            });
            const publicKeyHex = keyPair.publicKey.toString('hex');
            const encryptedPrivateKey = privateKeyWIF; //this.encryptPrivateKey(privateKeyWIF);

            return {
                address,
                publicKey: publicKeyHex,
                encryptedPrivateKey,
                utxo: [],
                network: this.network
            };
        } catch (error) {
            console.error('[BITCOIN-WALLET] Errore, fallback a simulazione:', error.message);
            return this.generateSimulatedWallet(electionId, userId);
        }
    }

    generateSimulatedWallet(electionId, userId) {
        const seed = crypto.createHash('sha256')
            .update(`${electionId}-${userId}-${Date.now()}`)
            .digest();
        
        const prefix = this.network === 'mainnet' ? 'bc1q' : 'tb1q';
        const addressHash = crypto.createHash('sha256')
            .update(seed)
            .digest('hex')
            .substring(0, 32);
        const address = `${prefix}${addressHash}`;
        
        const publicKey = crypto.createHash('sha256')
            .update(`pubkey-${seed.toString('hex')}`)
            .digest('hex');
        
        const simulatedPrivateKey = `${crypto.randomBytes(32).toString('hex')}`;
        const encryptedPrivateKey = simulatedPrivateKey;//this.encryptPrivateKey(simulatedPrivateKey);
        
        console.log(`[BITCOIN-WALLET] Wallet simulato generato: ${address}`);
        
        return {
            address,
            publicKey,
            encryptedPrivateKey,
            utxo: [],
            network: this.network,
            simulated: true
        };
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
     * Cripta una chiave privata usando AES-256-CBC
     * @param {string} privateKey - Chiave privata in formato WIF
     * @returns {Object} Dati della chiave crittografata
     */
    encryptPrivateKey(privateKey) {
        try {
            const algorithm = 'aes-256-cbc';
            const salt = crypto.randomBytes(32);
            const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
            const iv = crypto.randomBytes(16);
            
            // FIX: Usa createCipheriv invece di createCipherGCM
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            
            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return {
                encrypted,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                algorithm: algorithm
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
            const { encrypted, salt, iv, algorithm = 'aes-256-cbc' } = encryptedData;
            
            const key = crypto.pbkdf2Sync(this.encryptionKey, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
            
            // FIX: Usa createDecipheriv invece di createDecipherGCM
            const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
            
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