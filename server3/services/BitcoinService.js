// server3/services/BitcoinService.js
// Servizio per l'interazione con la blockchain Bitcoin

const crypto = require('crypto');
const axios = require('axios');

class BitcoinService {
    constructor() {
        this.network = process.env.BITCOIN_NETWORK || 'testnet';
        this.rpcConfig = {
            testnet: {
                host: process.env.BITCOIN_RPC_HOST || 'localhost',
                port: process.env.BITCOIN_RPC_PORT || '18332',
                username: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
                password: process.env.BITCOIN_RPC_PASS || 'rpcpassword',
                protocol: 'http'
            },
            mainnet: {
                host: process.env.BITCOIN_RPC_HOST || 'localhost', 
                port: process.env.BITCOIN_RPC_PORT || '8332',
                username: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
                password: process.env.BITCOIN_RPC_PASS || 'rpcpassword',
                protocol: 'http'
            }
        };

        // Fallback API pubbliche per testnet
        this.publicApis = {
            testnet: 'https://blockstream.info/testnet/api',
            mainnet: 'https://blockstream.info/api'
        };

        this.rpc = this.rpcConfig[this.network];
        this.publicApi = this.publicApis[this.network];
        
        console.log(`[BITCOIN] 🚀 Inizializzato per rete: ${this.network}`);
    }

    /**
     * Esegue chiamata RPC al nodo Bitcoin
     */
    async rpcCall(method, params = []) {
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
            
            // Fallback a API pubblica se RPC non disponibile
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                console.log(`[BITCOIN] 🔄 Fallback a API pubblica per ${method}`);
                return await this.fallbackApiCall(method, params);
            }
            
            throw error;
        }
    }

    /**
     * Fallback a API pubbliche quando RPC non disponibile
     */
    async fallbackApiCall(method, params) {
        try {
            switch (method) {
                case 'getblockchaininfo':
                    return await this.getChainInfoFromApi();
                case 'getrawtransaction':
                    return await this.getRawTransactionFromApi(params[0]);
                case 'sendrawtransaction':
                    return await this.broadcastTransactionToApi(params[0]);
                case 'getblockcount':
                    return await this.getBlockHeightFromApi();
                default:
                    throw new Error(`Metodo ${method} non supportato via API pubblica`);
            }
        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore API pubblica:`, error.message);
            throw error;
        }
    }

    /**
     * Ottiene informazioni sulla blockchain
     */
    async getChainInfo() {
        try {
            const info = await this.rpcCall('getblockchaininfo');
            
            return {
                network: this.network,
                blocks: info.blocks,
                bestblockhash: info.bestblockhash,
                difficulty: info.difficulty,
                verificationprogress: info.verificationprogress,
                chainwork: info.chainwork
            };
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore getChainInfo:', error);
            throw error;
        }
    }

    /**
     * Ottiene info blockchain da API pubblica
     */
    async getChainInfoFromApi() {
        try {
            const response = await axios.get(`${this.publicApi}/blocks/tip/height`, {
                timeout: 10000
            });
            
            return {
                network: this.network,
                blocks: response.data,
                bestblockhash: null,
                difficulty: null,
                verificationprogress: 1.0,
                chainwork: null
            };
        } catch (error) {
            throw new Error(`Errore API pubblica getChainInfo: ${error.message}`);
        }
    }

    /**
     * Verifica se un indirizzo Bitcoin è valido
     */
    isValidAddress(address, network = this.network) {
        try {
            if (!address || typeof address !== 'string') {
                return false;
            }

            // Controlli base per formato indirizzo
            if (network === 'testnet') {
                // Testnet: tb1... (bech32), m/n... (legacy), 2... (segwit)
                return /^(tb1[a-zA-HJ-NP-Z0-9]{25,87}|[mn][a-km-zA-HJ-NP-Z1-9]{25,34}|2[a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
            } else {
                // Mainnet: bc1... (bech32), 1... (legacy), 3... (segwit)
                return /^(bc1[a-zA-HJ-NP-Z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
            }
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore validazione indirizzo:', error);
            return false;
        }
    }

    /**
     * Converte indirizzo a scriptPubKey (simulazione)
     */
    addressToScriptPubKey(address) {
        // Simulazione - in un sistema reale userebbe bitcoinjs-lib
        const hash = crypto.createHash('sha256').update(address).digest('hex');
        return `OP_DUP OP_HASH160 ${hash.substring(0, 40)} OP_EQUALVERIFY OP_CHECKSIG`;
    }

    /**
     * Broadcast transazione alla blockchain
     */
    async broadcastTransaction(rawTx) {
        try {
            console.log(`[BITCOIN] 📡 Broadcasting transazione...`);
            
            // Prima tenta RPC, poi fallback ad API pubblica
            let txId;
            try {
                txId = await this.rpcCall('sendrawtransaction', [rawTx]);
            } catch (rpcError) {
                console.log(`[BITCOIN] 🔄 RPC fallito, provo API pubblica...`);
                txId = await this.broadcastTransactionToApi(rawTx);
            }

            console.log(`[BITCOIN] ✅ Transazione trasmessa: ${txId}`);
            
            return {
                success: true,
                txId: txId,
                network: this.network,
                broadcastedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore broadcast:`, error);
            
            // Per testing, simula successo con txId mock
            if (process.env.NODE_ENV === 'development') {
                const mockTxId = crypto.createHash('sha256')
                    .update(`mock:${rawTx}:${Date.now()}`)
                    .digest('hex');
                
                console.log(`[BITCOIN] 🧪 Broadcast simulato: ${mockTxId}`);
                
                return {
                    success: true,
                    txId: mockTxId,
                    network: this.network,
                    broadcastedAt: new Date().toISOString(),
                    simulated: true
                };
            }
            
            throw error;
        }
    }

    /**
     * Broadcast via API pubblica
     */
    async broadcastTransactionToApi(rawTx) {
        try {
            const response = await axios.post(`${this.publicApi}/tx`, rawTx, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 30000
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`Errore broadcast API: ${error.message}`);
        }
    }

    /**
     * Ottiene numero di conferme per una transazione
     */
    async getTransactionConfirmations(txId) {
        try {
            console.log(`[BITCOIN] 🔍 Controllo conferme per ${txId}`);
            
            // Prima tenta RPC
            try {
                const txInfo = await this.rpcCall('getrawtransaction', [txId, true]);
                const currentBlock = await this.rpcCall('getblockcount');
                
                if (txInfo.blockhash) {
                    const blockInfo = await this.rpcCall('getblock', [txInfo.blockhash]);
                    return currentBlock - blockInfo.height + 1;
                } else {
                    return 0; // Non ancora in un blocco
                }
            } catch (rpcError) {
                // Fallback ad API pubblica
                return await this.getTransactionConfirmationsFromApi(txId);
            }

        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore controllo conferme:`, error);
            
            // Per testing, simula conferme progressive
            if (process.env.NODE_ENV === 'development') {
                const mockConfirmations = Math.floor(Math.random() * 7); // 0-6 conferme
                console.log(`[BITCOIN] 🧪 Conferme simulate per ${txId}: ${mockConfirmations}`);
                return mockConfirmations;
            }
            
            return 0;
        }
    }

    /**
     * Ottiene conferme da API pubblica
     */
    async getTransactionConfirmationsFromApi(txId) {
        try {
            const response = await axios.get(`${this.publicApi}/tx/${txId}`, {
                timeout: 10000
            });
            
            const txData = response.data;
            
            if (txData.status && txData.status.confirmed) {
                const tipResponse = await axios.get(`${this.publicApi}/blocks/tip/height`);
                const currentHeight = tipResponse.data;
                return currentHeight - txData.status.block_height + 1;
            }
            
            return 0;
        } catch (error) {
            throw new Error(`Errore API conferme: ${error.message}`);
        }
    }

    /**
     * Ottiene transazione raw da API
     */
    async getRawTransactionFromApi(txId) {
        try {
            const response = await axios.get(`${this.publicApi}/tx/${txId}/hex`, {
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            throw new Error(`Errore API getRawTransaction: ${error.message}`);
        }
    }

    /**
     * Ottiene altezza blocco da API
     */
    async getBlockHeightFromApi() {
        try {
            const response = await axios.get(`${this.publicApi}/blocks/tip/height`, {
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            throw new Error(`Errore API getBlockHeight: ${error.message}`);
        }
    }

    /**
     * Crea indirizzo Bitcoin (simulazione per testing)
     */
    generateAddress(type = 'bech32') {
        try {
            const randomBytes = crypto.randomBytes(20);
            const hash160 = crypto.createHash('ripemd160').update(randomBytes).digest('hex');
            
            if (this.network === 'testnet') {
                switch (type) {
                    case 'bech32':
                        return `tb1q${hash160}`;
                    case 'legacy':
                        return `m${hash160.substring(0, 30)}`;
                    case 'segwit':
                        return `2${hash160.substring(0, 30)}`;
                    default:
                        return `tb1q${hash160}`;
                }
            } else {
                switch (type) {
                    case 'bech32':
                        return `bc1q${hash160}`;
                    case 'legacy':
                        return `1${hash160.substring(0, 30)}`;
                    case 'segwit':
                        return `3${hash160.substring(0, 30)}`;
                    default:
                        return `bc1q${hash160}`;
                }
            }
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore generazione indirizzo:', error);
            throw error;
        }
    }

    /**
     * Stima fee per transazione
     */
    async estimateFee(targetBlocks = 6) {
        try {
            // Prima tenta RPC
            try {
                const feeRate = await this.rpcCall('estimatesmartfee', [targetBlocks]);
                return feeRate.feerate ? Math.ceil(feeRate.feerate * 100000000) : 1000; // Converte a sat/byte
            } catch (rpcError) {
                // Fallback a fee fissa per testing
                console.log(`[BITCOIN] 🔄 Fee estimation fallback`);
                return 1000; // 1000 sat/byte default
            }
        } catch (error) {
            console.error('[BITCOIN] ❌ Errore stima fee:', error);
            return 1000; // Fee di sicurezza
        }
    }

    /**
     * Monitora indirizzo per transazioni in entrata
     */
    async monitorAddress(address, callback) {
        console.log(`[BITCOIN] 👀 Avvio monitoring per indirizzo ${address}`);
        
        let lastTxCount = 0;
        
        const checkAddress = async () => {
            try {
                const response = await axios.get(`${this.publicApi}/address/${address}/txs`, {
                    timeout: 10000
                });
                
                const transactions = response.data;
                
                if (transactions.length > lastTxCount) {
                    const newTxs = transactions.slice(lastTxCount);
                    lastTxCount = transactions.length;
                    
                    for (const tx of newTxs) {
                        callback({
                            txId: tx.txid,
                            address: address,
                            value: tx.vout.find(out => out.scriptpubkey_address === address)?.value || 0,
                            confirmations: tx.status.confirmed ? 1 : 0
                        });
                    }
                }
                
                // Continua monitoring ogni 30 secondi
                setTimeout(checkAddress, 30000);
                
            } catch (error) {
                console.error(`[BITCOIN] ❌ Errore monitoring ${address}:`, error.message);
                // Retry dopo errore
                setTimeout(checkAddress, 60000);
            }
        };
        
        // Avvia monitoring
        setTimeout(checkAddress, 5000);
    }

    /**
     * Ottiene bilancio di un indirizzo
     */
    async getAddressBalance(address) {
        try {
            const response = await axios.get(`${this.publicApi}/address/${address}`, {
                timeout: 10000
            });
            
            return {
                confirmed: response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum,
                unconfirmed: response.data.mempool_stats.funded_txo_sum - response.data.mempool_stats.spent_txo_sum,
                total: (response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum) +
                       (response.data.mempool_stats.funded_txo_sum - response.data.mempool_stats.spent_txo_sum)
            };
        } catch (error) {
            console.error(`[BITCOIN] ❌ Errore bilancio ${address}:`, error);
            return { confirmed: 0, unconfirmed: 0, total: 0 };
        }
    }

    /**
     * Test connessione ai servizi Bitcoin
     */
    async testConnection() {
        try {
            console.log(`[BITCOIN] 🧪 Test connessione rete ${this.network}...`);
            
            const results = {
                network: this.network,
                rpcAvailable: false,
                apiAvailable: false,
                blockHeight: null,
                timestamp: new Date().toISOString()
            };

            // Test RPC
            try {
                const chainInfo = await this.rpcCall('getblockchaininfo');
                results.rpcAvailable = true;
                results.blockHeight = chainInfo.blocks;
                console.log(`[BITCOIN] ✅ RPC connesso: blocco ${chainInfo.blocks}`);
            } catch (rpcError) {
                console.log(`[BITCOIN] ❌ RPC non disponibile: ${rpcError.message}`);
            }

            // Test API pubblica
            try {
                const height = await this.getBlockHeightFromApi();
                results.apiAvailable = true;
                results.blockHeight = results.blockHeight || height;
                console.log(`[BITCOIN] ✅ API pubblica connessa: blocco ${height}`);
            } catch (apiError) {
                console.log(`[BITCOIN] ❌ API pubblica non disponibile: ${apiError.message}`);
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
}

module.exports = new BitcoinService();