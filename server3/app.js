// server3/app.js - Vote Processing Server con CoinJoin Service - FIXED VERSION
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import servizi
const CoinJoinTriggerService = require('./services/coinjoinTrigger.service');

// CORREZIONE: Usa database_config locale invece del percorso assoluto
const { sequelize } = require('./database_config');

const app = express();
const PORT = process.env.VOTE_SERVICE_PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Test connessione database all'avvio
async function testDatabaseConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ [VOTE SERVICE] Database collegato correttamente');
        return true;
    } catch (error) {
        console.error('❌ [VOTE SERVICE] Errore connessione database:', error.message);
        return false;
    }
}

// ===========================
// ROUTES
// ===========================

// Health check su /api/health 
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'vote-service',
        timestamp: new Date().toISOString(),
        port: PORT,
        coinjoinService: CoinJoinTriggerService.isRunning ? 'active' : 'inactive'
    });
});

// Import routes
const voteRoutes = require('./routes/votes');
const adminRoutes = require('./routes/admin');
const electionRoutes = require('./routes/elections');

// Mount routes
app.use('/api/votes', voteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/elections', electionRoutes);

// ===========================
// VOTE PROCESSING ENDPOINTS
// ===========================

// POST /api/vote/submit - Ricevi e processa voto
app.post('/api/vote/submit', async (req, res) => {
    try {
        const { credential, commitment, zkProof, electionId } = req.body;
        
        console.log('📬 [VOTE] Nuovo voto ricevuto per elezione:', electionId);
        
        // TODO: Implementa validazione credenziale KVAC
        // TODO: Verifica zero-knowledge proof
        // TODO: Salva voto nel database
        
        res.json({
            success: true,
            message: 'Voto ricevuto e in elaborazione',
            voteId: `vote_${Date.now()}`,
            status: 'pending'
        });
    } catch (error) {
        console.error('❌ [VOTE] Errore processamento voto:', error);
        res.status(500).json({ error: 'Errore nel processamento del voto' });
    }
});

// GET /api/vote/status/:voteId - Controlla stato voto
app.get('/api/vote/status/:voteId', async (req, res) => {
    try {
        const { voteId } = req.params;
        
        // TODO: Recupera stato voto dal database
        
        res.json({
            voteId,
            status: 'pending', // pending, confirmed, failed
            transactionId: null,
            confirmations: 0
        });
    } catch (error) {
        console.error('❌ [VOTE] Errore recupero stato:', error);
        res.status(500).json({ error: 'Errore nel recupero dello stato' });
    }
});

// GET /api/coinjoin/status - Stato del servizio CoinJoin
app.get('/api/coinjoin/status', (req, res) => {
    res.json({
        isRunning: CoinJoinTriggerService.isRunning,
        checkInterval: CoinJoinTriggerService.checkInterval,
        message: CoinJoinTriggerService.isRunning 
            ? 'Servizio CoinJoin attivo e in ascolto'
            : 'Servizio CoinJoin non attivo'
    });
});

// POST /api/coinjoin/start - Avvia servizio CoinJoin
app.post('/api/coinjoin/start', (req, res) => {
    try {
        CoinJoinTriggerService.start();
        res.json({
            success: true,
            message: 'Servizio CoinJoin avviato',
            isRunning: CoinJoinTriggerService.isRunning
        });
    } catch (error) {
        console.error('❌ [COINJOIN] Errore avvio servizio:', error);
        res.status(500).json({ error: 'Errore nell\'avvio del servizio CoinJoin' });
    }
});

// POST /api/coinjoin/stop - Ferma servizio CoinJoin
app.post('/api/coinjoin/stop', (req, res) => {
    try {
        CoinJoinTriggerService.stop();
        res.json({
            success: true,
            message: 'Servizio CoinJoin fermato',
            isRunning: CoinJoinTriggerService.isRunning
        });
    } catch (error) {
        console.error('❌ [COINJOIN] Errore stop servizio:', error);
        res.status(500).json({ error: 'Errore nel fermare il servizio CoinJoin' });
    }
});

// ===========================
// ERROR HANDLING
// ===========================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint non trovato',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ [VOTE SERVICE] Errore globale:', error);
    
    res.status(500).json({
        error: 'Errore interno del server',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Si è verificato un errore'
    });
});

// ===========================
// SERVER STARTUP
// ===========================

async function startServer() {
    try {
        console.log('🚀 [VOTE SERVICE] Avvio server...');
        
        // Test connessione database
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            console.error('❌ [VOTE SERVICE] Impossibile avviare senza database');
            process.exit(1);
        }

        // Avvia il server
        app.listen(PORT, () => {
            console.log(`✅ [VOTE SERVICE] Server avviato sulla porta ${PORT}`);
            console.log(`🌐 [VOTE SERVICE] Health check: http://localhost:${PORT}/health`);
            console.log(`🗳️ [VOTE SERVICE] Vote API: http://localhost:${PORT}/api/votes`);
            console.log(`⚙️ [VOTE SERVICE] Admin API: http://localhost:${PORT}/api/admin`);
        });

        // Avvia il servizio CoinJoin automaticamente
        setTimeout(() => {
            console.log('🔄 [VOTE SERVICE] Avvio automatico servizio CoinJoin...');
            CoinJoinTriggerService.start();
        }, 2000);

    } catch (error) {
        console.error('❌ [VOTE SERVICE] Errore fatale durante l\'avvio:', error);
        process.exit(1);
    }
}

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    console.log('📤 [VOTE SERVICE] Ricevuto SIGTERM, chiusura graceful...');
    CoinJoinTriggerService.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📤 [VOTE SERVICE] Ricevuto SIGINT, chiusura graceful...');
    CoinJoinTriggerService.stop();
    process.exit(0);
});

// Avvia il server
if (require.main === module) {
    startServer();
}

module.exports = app;