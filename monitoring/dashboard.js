// Endpoint per dashboard di monitoring

const express = require('express');

function createMonitoringRouter(healthChecker, alertManager) {
    const router = express.Router();

    // Health check generale
    router.get('/health', async (req, res) => {
        try {
            const health = await healthChecker.runAll();
            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Health check specifico
    router.get('/health/:check', async (req, res) => {
        try {
            const result = await healthChecker.runCheck(req.params.check);
            const statusCode = result.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(404).json({
                status: 'error',
                message: error.message
            });
        }
    });

    // Metriche Prometheus
    router.get('/metrics', (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(register.metrics());
    });

    // Alert history
    router.get('/alerts', (req, res) => {
        const limit = parseInt(req.query.limit) || 100;
        const alerts = alertManager.alertHistory.slice(0, limit);
        res.json({
            total: alertManager.alertHistory.length,
            alerts
        });
    });

    // System info
    router.get('/info', (req, res) => {
        const os = require('os');
        res.json({
            service: process.env.SERVICE_NAME || 'unknown',
            version: process.env.npm_package_version || 'unknown',
            uptime: process.uptime(),
            memory: {
                used: process.memoryUsage(),
                system: {
                    total: os.totalmem(),
                    free: os.freemem()
                }
            },
            cpu: {
                cores: os.cpus().length,
                loadAverage: os.loadavg()
            },
            network: os.networkInterfaces(),
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

// Esporta tutto
module.exports = {
    LoggerFactory,
    metrics: {
        register,
        httpRequestsTotal,
        votesSubmitted,
        authAttempts,
        credentialsIssued,
        httpRequestDuration,
        voteProcessingTime,
        coinjoinCreationTime,
        activeVotingSessions,
        pendingVotes,
        bitcoinNodeConnection,
        metricsMiddleware
    },
    HealthChecker,
    commonHealthChecks,
    AlertManager,
    consoleAlertHandler,
    createMonitoringRouter
};