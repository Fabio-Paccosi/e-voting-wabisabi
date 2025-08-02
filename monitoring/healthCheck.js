// Sistema di health check per i servizi

class HealthChecker {
    constructor() {
        this.checks = new Map();
    }

    // Registra un nuovo health check
    register(name, checkFunction) {
        this.checks.set(name, {
            name,
            check: checkFunction,
            lastStatus: null,
            lastCheck: null
        });
    }

    // Esegui tutti i check
    async runAll() {
        const results = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {}
        };

        for (const [name, check] of this.checks) {
            try {
                const startTime = Date.now();
                const result = await check.check();
                const duration = Date.now() - startTime;

                results.checks[name] = {
                    status: result.healthy ? 'healthy' : 'unhealthy',
                    message: result.message,
                    duration: `${duration}ms`,
                    lastCheck: new Date().toISOString()
                };

                check.lastStatus = result.healthy;
                check.lastCheck = new Date();

                if (!result.healthy) {
                    results.status = 'unhealthy';
                }
            } catch (error) {
                results.checks[name] = {
                    status: 'unhealthy',
                    error: error.message,
                    lastCheck: new Date().toISOString()
                };
                results.status = 'unhealthy';
            }
        }

        return results;
    }

    // Check singolo
    async runCheck(name) {
        const check = this.checks.get(name);
        if (!check) {
            throw new Error(`Health check '${name}' non trovato`);
        }

        try {
            const result = await check.check();
            return {
                name,
                status: result.healthy ? 'healthy' : 'unhealthy',
                message: result.message,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                name,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Health check predefiniti
const commonHealthChecks = {
    // Check database
    database: async (sequelize) => {
        try {
            await sequelize.authenticate();
            return { healthy: true, message: 'Database connesso' };
        } catch (error) {
            return { healthy: false, message: `Database error: ${error.message}` };
        }
    },

    // Check Redis
    redis: async (redisClient) => {
        try {
            await redisClient.ping();
            return { healthy: true, message: 'Redis connesso' };
        } catch (error) {
            return { healthy: false, message: `Redis error: ${error.message}` };
        }
    },

    // Check Bitcoin node
    bitcoinNode: async (nodeUrl) => {
        try {
            const axios = require('axios');
            const response = await axios.post(nodeUrl, {
                jsonrpc: '2.0',
                method: 'getblockchaininfo',
                params: [],
                id: 1
            }, { timeout: 5000 });
            
            return { 
                healthy: true, 
                message: `Bitcoin node connesso. Blocchi: ${response.data.result.blocks}` 
            };
        } catch (error) {
            return { healthy: false, message: `Bitcoin node error: ${error.message}` };
        }
    },

    // Check spazio disco
    diskSpace: async () => {
        const checkDiskSpace = require('check-disk-space').default;
        try {
            const diskSpace = await checkDiskSpace('/');
            const freePercentage = (diskSpace.free / diskSpace.size) * 100;
            
            if (freePercentage < 10) {
                return { 
                    healthy: false, 
                    message: `Spazio disco insufficiente: ${freePercentage.toFixed(2)}% libero` 
                };
            }
            
            return { 
                healthy: true, 
                message: `Spazio disco OK: ${freePercentage.toFixed(2)}% libero` 
            };
        } catch (error) {
            return { healthy: false, message: `Disk check error: ${error.message}` };
        }
    }
};