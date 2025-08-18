// server3/config/bitcoin.config.js - Configurazione Bitcoin migliorata
const axios = require('axios');

class BitcoinConfig {
    constructor() {
        this.network = process.env.BITCOIN_NETWORK || 'testnet';
        this.rpcConfig = {
            url: process.env.BITCOIN_RPC_URL || 'http://localhost:18332',
            username: process.env.BITCOIN_RPC_USER || 'bitcoin',
            password: process.env.BITCOIN_RPC_PASS || 'password',
            timeout: 10000
        };
        
        // API pubbliche di fallback per testnet
        this.fallbackApis = {
            testnet: [
                'https://blockstream.info/testnet/api',
                'https://api.blockcypher.com/v1/btc/test3'
            ],
            mainnet: [
                'https://blockstream.info/api',
                'https://api.blockcypher.com/v1/btc/main'
            ]
        };
        
        this.isRpcAvailable = false;
        this.lastRpcCheck = 0;
        this.rpcCheckInterval = 60000; // Check ogni minuto
    }

    async checkRpcConnection() {
        const now = Date.now();
        if (now - this.lastRpcCheck < this.rpcCheckInterval) {
            return this.isRpcAvailable;
        }

        try {
            const response = await axios.post(this.rpcConfig.url, {
                jsonrpc: '1.0',
                id: 'health_check',
                method: 'getblockchaininfo',
                params: []
            }, {
                timeout: 5000,
                auth: {
                    username: this.rpcConfig.username,
                    password: this.rpcConfig.password
                }
            });

            this.isRpcAvailable = response.status === 200;
            console.log('✅ [BITCOIN] Connessione RPC attiva');
        } catch (error) {
            this.isRpcAvailable = false;
            console.log('⚠️ [BITCOIN] RPC non disponibile, userò API pubbliche');
        }

        this.lastRpcCheck = now;
        return this.isRpcAvailable;
    }

    async broadcastTransaction(rawTx) {
        // Prova prima RPC se disponibile
        if (await this.checkRpcConnection()) {
            try {
                return await this.broadcastViaRpc(rawTx);
            } catch (error) {
                console.log('🔄 [BITCOIN] RPC fallito, provo API pubblica...');
            }
        }

        // Fallback a API pubbliche
        return await this.broadcastViaPublicApi(rawTx);
    }

    async broadcastViaRpc(rawTx) {
        const response = await axios.post(this.rpcConfig.url, {
            jsonrpc: '1.0',
            id: 'broadcast',
            method: 'sendrawtransaction',
            params: [rawTx]
        }, {
            timeout: this.rpcConfig.timeout,
            auth: {
                username: this.rpcConfig.username,
                password: this.rpcConfig.password
            }
        });

        if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }

        return response.data.result;
    }

    async broadcastViaPublicApi(rawTx) {
        const apis = this.fallbackApis[this.network] || this.fallbackApis.testnet;
        
        for (const apiUrl of apis) {
            try {
                console.log(`📡 [BITCOIN] Tentativo broadcast via ${apiUrl}`);
                
                let response;
                if (apiUrl.includes('blockstream.info')) {
                    response = await axios.post(`${apiUrl}/tx`, rawTx, {
                        headers: { 'Content-Type': 'text/plain' },
                        timeout: 10000
                    });
                    return response.data; // Blockstream restituisce direttamente il txid
                } else if (apiUrl.includes('blockcypher.com')) {
                    response = await axios.post(`${apiUrl}/txs/push`, {
                        tx: rawTx
                    }, {
                        timeout: 10000
                    });
                    return response.data.tx.hash;
                }
            } catch (error) {
                console.log(`❌ [BITCOIN] Errore con ${apiUrl}: ${error.message}`);
                continue;
            }
        }

        throw new Error('Tutti i servizi di broadcast sono falliti');
    }

    // Metodo per simulare broadcast (per sviluppo)
    async mockBroadcast(rawTx) {
        console.log('🧪 [BITCOIN] Simulazione broadcast (development mode)');
        
        // Simula delay network
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Genera txid mockato ma realistico
        const crypto = require('crypto');
        const txid = crypto.createHash('sha256')
            .update(rawTx + Date.now().toString())
            .digest('hex');
            
        console.log(`✅ [BITCOIN] Mock Transaction ID: ${txid}`);
        return txid;
    }

    async getTransactionInfo(txid) {
        if (await this.checkRpcConnection()) {
            try {
                return await this.getTxViaRpc(txid);
            } catch (error) {
                console.log('🔄 [BITCOIN] RPC fallito per getTx, provo API pubblica...');
            }
        }

        return await this.getTxViaPublicApi(txid);
    }

    async getTxViaRpc(txid) {
        const response = await axios.post(this.rpcConfig.url, {
            jsonrpc: '1.0',
            id: 'gettx',
            method: 'getrawtransaction',
            params: [txid, true]
        }, {
            timeout: this.rpcConfig.timeout,
            auth: {
                username: this.rpcConfig.username,
                password: this.rpcConfig.password
            }
        });

        if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }

        return response.data.result;
    }

    async getTxViaPublicApi(txid) {
        const apis = this.fallbackApis[this.network] || this.fallbackApis.testnet;
        
        for (const apiUrl of apis) {
            try {
                const response = await axios.get(`${apiUrl}/tx/${txid}`, {
                    timeout: 10000
                });
                return response.data;
            } catch (error) {
                console.log(`❌ [BITCOIN] Errore getTx con ${apiUrl}: ${error.message}`);
                continue;
            }
        }

        throw new Error('Impossibile recuperare informazioni transazione');
    }

    getNetworkInfo() {
        return {
            network: this.network,
            rpcAvailable: this.isRpcAvailable,
            rpcUrl: this.rpcConfig.url,
            fallbackApis: this.fallbackApis[this.network] || []
        };
    }
}

// Export singleton
module.exports = new BitcoinConfig();