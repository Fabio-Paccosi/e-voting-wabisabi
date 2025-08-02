// Sistema di metriche per Prometheus

const client = require('prom-client');

// Registro delle metriche
const register = new client.Registry();

// Metriche di default (CPU, memoria, etc.)
client.collectDefaultMetrics({ register });

// ====================
// METRICHE PERSONALIZZATE
// ====================

// Contatori
const httpRequestsTotal = new client.Counter({
    name: 'evoting_http_requests_total',
    help: 'Numero totale di richieste HTTP',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

const votesSubmitted = new client.Counter({
    name: 'evoting_votes_submitted_total',
    help: 'Numero totale di voti inviati',
    labelNames: ['election_id', 'session_id'],
    registers: [register]
});

const authAttempts = new client.Counter({
    name: 'evoting_auth_attempts_total',
    help: 'Numero totale di tentativi di autenticazione',
    labelNames: ['type', 'success'],
    registers: [register]
});

const credentialsIssued = new client.Counter({
    name: 'evoting_credentials_issued_total',
    help: 'Numero totale di credenziali KVAC emesse',
    registers: [register]
});

// Istogrammi
const httpRequestDuration = new client.Histogram({
    name: 'evoting_http_request_duration_seconds',
    help: 'Durata delle richieste HTTP in secondi',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register]
});

const voteProcessingTime = new client.Histogram({
    name: 'evoting_vote_processing_duration_seconds',
    help: 'Tempo di elaborazione dei voti in secondi',
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
});

const coinjoinCreationTime = new client.Histogram({
    name: 'evoting_coinjoin_creation_duration_seconds',
    help: 'Tempo di creazione transazioni CoinJoin in secondi',
    buckets: [1, 5, 10, 30, 60],
    registers: [register]
});

// Gauge
const activeVotingSessions = new client.Gauge({
    name: 'evoting_active_voting_sessions',
    help: 'Numero di sessioni di voto attive',
    registers: [register]
});

const pendingVotes = new client.Gauge({
    name: 'evoting_pending_votes',
    help: 'Numero di voti in attesa di elaborazione',
    registers: [register]
});

const bitcoinNodeConnection = new client.Gauge({
    name: 'evoting_bitcoin_node_connected',
    help: 'Stato connessione al nodo Bitcoin (1=connesso, 0=disconnesso)',
    registers: [register]
});

// ====================
// MIDDLEWARE EXPRESS
// ====================

// Middleware per tracciare le metriche HTTP
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;

        httpRequestsTotal.inc({
            method: req.method,
            route,
            status: res.statusCode
        });

        httpRequestDuration.observe({
            method: req.method,
            route,
            status: res.statusCode
        }, duration);
    });

    next();
};