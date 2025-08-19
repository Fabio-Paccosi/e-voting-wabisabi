// server3/services/BitcoinService.js
// Servizio per l'interazione con la blockchain Bitcoin - VERSIONE CORRETTA

const crypto = require('crypto');
const axios = require('axios');

class BitcoinService {
    constructor() {
        this.network = process.env.BITCOIN_NETWORK || 'testnet';
        
        // CORREZIONE: Configurazione RPC migliorata
        this.rpcConfig = {
            testnet: {
                host: process.env.BITCOIN_RPC_HOST || '127.0.0.1', // Forza IPv4
                port: process.env.BITCOIN_RPC_PORT || '18332',
                username: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
                password: process.env.BITCOIN_RPC_PASSWORD || 'rpcpassword', // CORRETTO
                protocol: 'http'
            },
            mainnet: {
                host: process.env.BITCOIN_RPC_HOST || '127.0.0.1', // Forza IPv4
                port: process.env.BITCOIN_RPC_PORT || '8332',
                username: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
                password: process.env.BITCOIN_RPC_PASSWORD || 'rpcpassword', // CORRETTO
                protocol: 'http'
            }
        };

        // API pubbliche con fallback multipli
        this.publicApis = {
            testnet: [
                'https://blockstream.info/testnet/api',
                'https://mempool.space/testnet/api'
            ],
            mainnet: [
                'https://blockstream.info/api',
                'https://mempool.space/api'
            ]
        };

        this.rpc = this.rpcConfig[this.network];
        this.publicApiList = this.publicApis[this.network];
        
        // Test di connessione iniziale
        this.isRpcAvailable = false;
        this.testRpcConnection();
        
        console.log(`[BITCOIN] 🚀 Inizializzato per rete: ${this.network}`);
        console.log(`[BITCOIN] 🔧 RPC: ${this.rpc.host}:${this.rpc.port}`);
    }

    /**
     * Test connessione RPC
     */
    async testRpcConnection() {
        try {
            const rpcUrl = `${this.rpc.protocol}://${this.rpc.host}:${this.rpc.port}`;
            
            const response = await axios.post(rpcUrl, {
                jsonrpc: '2.0',
                id: 'test',
                method: 'getblockchaininfo',
                params: []
            }, {
                auth: {
                    username: this.rpc.username,
                    password: this.rpc.password
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (!response.data.error) {
                this.isRpcAvailable = true;
                console.log(`[BITCOIN] ✅ RPC connesso: blocco ${response.data.result.blocks}`);
            }
        } catch (error) {
            this.isRpcAvailable = false;
            console.log(`[BITCOIN] ⚠️ RPC non disponibile: ${error.message}`);
            console.log(`[BITCOIN] 🔄 Userò API pubbliche come fallback`);
        }
    }

    /**
     * Esegue chiamata RPC al nodo Bitcoin
     */
    async rpcCall(method, params = []) {
        if (!this.isRpcAvailable) {
            throw new Error('RPC non disponibile');
        }

        try {
            const rpcUrl = `${this.rpc.protocol}://${this.rpc.host}:${this.rpc.port}`;
            
            const response = await axios.post(rpcUrl, {
                jsonrpc: '2.0',
                id: Date.now(),
                method: method,
                params: params
            }, {
                auth: {
                    username: this.rpc.username,
                    password: this.rpc.password
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.error) {
                throw new Error(`RPC Error: ${response.data.error.message}`);
            }

            return response.data.result;

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore RPC ${method}:`, error.message);
            
            // Segna RPC come non disponibile se c'è errore di connessione
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                this.isRpcAvailable = false;
            }
            
            throw error;
        }
    }

    /**
     * Broadcast transazione alla blockchain - METODO MIGLIORATO
     */
    async broadcastTransaction(rawTx) {
        try {
            console.log(`[BITCOIN] 📡 Broadcasting transazione...`);
            console.log(`[BITCOIN] 📊 RawTx length: ${rawTx.length} chars`);
            
            // Validazione base della raw transaction
            if (!this.isValidRawTransaction(rawTx)) {
                throw new Error('Raw transaction non valida');
            }

            let txId = null;
            let broadcastMethod = 'unknown';

            // Tentativo 1: RPC locale
            if (this.isRpcAvailable) {
                try {
                    txId = await this.rpcCall('sendrawtransaction', [rawTx]);
                    broadcastMethod = 'rpc';
                    console.log(`[BITCOIN] ✅ Broadcast RPC riuscito: ${txId}`);
                } catch (rpcError) {
                    console.log(`[BITCOIN] 🔄 RPC fallito: ${rpcError.message}`);
                }
            }

            // Tentativo 2: API pubbliche (con retry)
            if (!txId) {
                txId = await this.broadcastViaPublicApis(rawTx);
                broadcastMethod = 'api';
            }

            return {
                success: true,
                txId: txId,
                network: this.network,
                method: broadcastMethod,
                broadcastedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore broadcast:`, error);
            
            // Fallback per ambiente di sviluppo
            if (process.env.NODE_ENV === 'development') {
                return this.mockBroadcast(rawTx);
            }
            
            throw error;
        }
    }

    /**
     * Broadcast tramite API pubbliche con retry
     */
    async broadcastViaPublicApis(rawTx) {
        let lastError;

        for (const apiUrl of this.publicApiList) {
            try {
                console.log(`[BITCOIN] 📡 Tentativo broadcast via ${apiUrl}`);
                
                const response = await axios.post(`${apiUrl}/tx`, rawTx, {
                    headers: { 
                        'Content-Type': 'text/plain',
                        'User-Agent': 'BitcoinService/1.0'
                    },
                    timeout: 30000
                });
                
                // Gestisci diverse risposte API
                let txId;
                if (typeof response.data === 'string') {
                    txId = response.data.trim();
                } else if (response.data.txid) {
                    txId = response.data.txid;
                } else {
                    throw new Error('Formato risposta API non riconosciuto');
                }
                
                console.log(`[BITCOIN] ✅ Broadcast API riuscito: ${txId}`);
                return txId;
                
            } catch (error) {
                lastError = error;
                console.log(`[BITCOIN] ❌ Errore ${apiUrl}: ${error.message}`);
                
                // Se è errore 400, la transazione è probabilmente invalida
                if (error.response?.status === 400) {
                    const errorDetail = error.response.data || 'Bad Request';
                    throw new Error(`Transaction invalida: ${errorDetail}`);
                }
                
                // Continua con la prossima API
                continue;
            }
        }

        throw new Error(`Broadcast fallito su tutte le API: ${lastError?.message}`);
    }

    /**
     * Validazione base raw transaction
     */
    isValidRawTransaction(rawTx) {
        try {
            // Controlli base
            if (!rawTx || typeof rawTx !== 'string') {
                return false;
            }

            // Deve essere hex valido
            if (!/^[0-9a-fA-F]+$/.test(rawTx)) {
                return false;
            }

            // Lunghezza minima ragionevole (~ 100 bytes = 200 hex chars)
            if (rawTx.length < 200) {
                console.log(`[BITCOIN] ⚠️ RawTx molto corta: ${rawTx.length} chars`);
                return false;
            }

            // Lunghezza massima ragionevole (~ 100KB = 200K hex chars)
            if (rawTx.length > 200000) {
                console.log(`[BITCOIN] ⚠️ RawTx molto lunga: ${rawTx.length} chars`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore validazione rawTx:', error);
            return false;
        }
    }

    /**
     * Mock broadcast per sviluppo
     */
    mockBroadcast(rawTx) {
        const mockTxId = crypto.createHash('sha256')
            .update(`mock:${rawTx.substring(0, 32)}:${Date.now()}`)
            .digest('hex');
        
        console.log(`[BITCOIN] 🧪 Broadcast simulato: ${mockTxId}`);
        
        return {
            success: true,
            txId: mockTxId,
            network: this.network,
            method: 'mock',
            broadcastedAt: new Date().toISOString(),
            simulated: true
        };
    }

    /**
     * Ottiene numero di conferme per una transazione
     */
    async getTransactionConfirmations(txId) {
        try {
            console.log(`[BITCOIN] 🔍 Controllo conferme per ${txId}`);
            
            // Tentativo RPC
            if (this.isRpcAvailable) {
                try {
                    const txInfo = await this.rpcCall('getrawtransaction', [txId, true]);
                    const currentBlock = await this.rpcCall('getblockcount');
                    
                    if (txInfo.blockhash) {
                        const blockInfo = await this.rpcCall('getblock', [txInfo.blockhash]);
                        const confirmations = currentBlock - blockInfo.height + 1;
                        console.log(`[BITCOIN] ✅ Conferme RPC: ${confirmations}`);
                        return confirmations;
                    } else {
                        return 0; // Mempool
                    }
                } catch (rpcError) {
                    console.log(`[BITCOIN] 🔄 RPC conferme fallito: ${rpcError.message}`);
                }
            }

            // Fallback API pubbliche
            return await this.getConfirmationsViaApi(txId);

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore controllo conferme:`, error);
            
            // Mock per sviluppo
            if (process.env.NODE_ENV === 'development') {
                const mockConfirmations = Math.floor(Math.random() * 7);
                console.log(`[BITCOIN] 🧪 Conferme simulate: ${mockConfirmations}`);
                return mockConfirmations;
            }
            
            return 0;
        }
    }

    /**
     * Ottiene conferme tramite API
     */
    async getConfirmationsViaApi(txId) {
        for (const apiUrl of this.publicApiList) {
            try {
                const response = await axios.get(`${apiUrl}/tx/${txId}`, {
                    timeout: 10000
                });
                
                const txData = response.data;
                
                if (txData.status && txData.status.confirmed) {
                    const tipResponse = await axios.get(`${apiUrl}/blocks/tip/height`);
                    const currentHeight = tipResponse.data;
                    const confirmations = currentHeight - txData.status.block_height + 1;
                    console.log(`[BITCOIN] ✅ Conferme API: ${confirmations}`);
                    return confirmations;
                } else {
                    return 0; // Non confermata
                }
            } catch (error) {
                console.log(`[BITCOIN] ❌ Errore conferme ${apiUrl}: ${error.message}`);
                continue;
            }
        }
        
        throw new Error('Impossibile ottenere conferme da tutte le API');
    }

    /**
     * Verifica se un indirizzo Bitcoin è valido
     */
    isValidAddress(address, network = this.network) {
        try {
            if (!address || typeof address !== 'string') {
                return false;
            }

            if (network === 'testnet') {
                return /^(tb1[a-zA-HJ-NP-Z0-9]{25,87}|[mn][a-km-zA-HJ-NP-Z1-9]{25,34}|2[a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
            } else {
                return /^(bc1[a-zA-HJ-NP-Z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
            }
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore validazione indirizzo:', error);
            return false;
        }
    }

    /**
     * Test connessione completo
     */
    async testConnection() {
        try {
            console.log(`[BITCOIN] 🧪 Test connessione rete ${this.network}...`);
            
            const results = {
                network: this.network,
                rpcAvailable: false,
                apiAvailable: false,
                blockHeight: null,
                rpcUrl: `${this.rpc.host}:${this.rpc.port}`,
                apis: this.publicApiList,
                timestamp: new Date().toISOString()
            };

            // Test RPC
            try {
                await this.testRpcConnection();
                if (this.isRpcAvailable) {
                    const chainInfo = await this.rpcCall('getblockchaininfo');
                    results.rpcAvailable = true;
                    results.blockHeight = chainInfo.blocks;
                    console.log(`[BITCOIN] ✅ RPC connesso: blocco ${chainInfo.blocks}`);
                }
            } catch (rpcError) {
                console.log(`[BITCOIN] ❌ RPC non disponibile: ${rpcError.message}`);
            }

            // Test API pubbliche
            for (const apiUrl of this.publicApiList) {
                try {
                    const response = await axios.get(`${apiUrl}/blocks/tip/height`, {
                        timeout: 10000
                    });
                    results.apiAvailable = true;
                    results.blockHeight = results.blockHeight || response.data;
                    console.log(`[BITCOIN] ✅ API ${apiUrl} connessa: blocco ${response.data}`);
                    break; // Una API che funziona è sufficiente
                } catch (apiError) {
                    console.log(`[BITCOIN] ❌ API ${apiUrl} non disponibile: ${apiError.message}`);
                }
            }

            return results;

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore test connessione:`, error);
            return {
                network: this.network,
                rpcAvailable: false,
                apiAvailable: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Ottiene bilancio di un indirizzo
     */
    async getAddressBalance(address) {
        for (const apiUrl of this.publicApiList) {
            try {
                const response = await axios.get(`${apiUrl}/address/${address}`, {
                    timeout: 10000
                });
                
                return {
                    confirmed: response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum,
                    unconfirmed: response.data.mempool_stats.funded_txo_sum - response.data.mempool_stats.spent_txo_sum,
                    total: (response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum) +
                           (response.data.mempool_stats.funded_txo_sum - response.data.mempool_stats.spent_txo_sum)
                };
            } catch (error) {
                console.error(`[BITCOIN] ❌ Errore bilancio ${address} con ${apiUrl}:`, error.message);
                continue;
            }
        }
        
        return { confirmed: 0, unconfirmed: 0, total: 0 };
    }

    /**
     * Converte indirizzo a scriptPubKey (simulazione per compatibilità)
     */
    addressToScriptPubKey(address) {
        try {
            if (!address || typeof address !== 'string') {
                throw new Error('Indirizzo non valido');
            }
            
            // Simulazione scriptPubKey - in produzione usare bitcoinjs-lib
            const hash = crypto.createHash('sha256').update(address).digest('hex');
            return `OP_DUP OP_HASH160 ${hash.substring(0, 40)} OP_EQUALVERIFY OP_CHECKSIG`;
        } catch (error) {
            console.error('[BITCOIN] Errore addressToScriptPubKey:', error);
            return `scriptPubKey_fallback_${Date.now()}`;
        }
    }

    /**
     * Ottiene informazioni di stato
     */
    getStatusInfo() {
        return {
            network: this.network,
            rpcAvailable: this.isRpcAvailable,
            rpcConfig: {
                host: this.rpc.host,
                port: this.rpc.port,
                url: `${this.rpc.protocol}://${this.rpc.host}:${this.rpc.port}`
            },
            publicApis: this.publicApiList,
            initialized: true
        };
    }
}

module.exports = new BitcoinService();