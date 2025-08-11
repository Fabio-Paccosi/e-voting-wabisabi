// server3/index.js - Vote Processing Server con CoinJoin Service
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import servizi
const CoinJoinTriggerService = require('./services/coinjoinTrigger.service');

// Import modelli database
const modelsPath = path.join(__dirname, '../../database/models');
const { sequelize, testConnection } = require(modelsPath);

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

// ===========================
// ROUTES
// ===========================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'vote-processing',
        timestamp: new Date().toISOString(),
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
            ? 'Servizio CoinJoin attivo e in monitoraggio' 
            : 'Servizio CoinJoin non attivo'
    });
});

// POST /api/coinjoin/start - Avvia servizio CoinJoin manualmente
app.post('/api/coinjoin/start', (req, res) => {
    if (CoinJoinTriggerService.isRunning) {
        return res.status(400).json({ 
            error: 'Il servizio CoinJoin è già in esecuzione' 
        });
    }
    
    CoinJoinTriggerService.start();
    res.json({ 
        success: true,
        message: 'Servizio CoinJoin avviato con successo' 
    });
});

// POST /api/coinjoin/stop - Ferma servizio CoinJoin
app.post('/api/coinjoin/stop', (req, res) => {
    if (!CoinJoinTriggerService.isRunning) {
        return res.status(400).json({ 
            error: 'Il servizio CoinJoin non è in esecuzione' 
        });
    }
    
    CoinJoinTriggerService.stop();
    res.json({ 
        success: true,
        message: 'Servizio CoinJoin fermato con successo' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ [ERROR]:', err.stack);
    res.status(500).json({ 
        error: 'Errore interno del server',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato' });
});

// ===========================
// SERVER INITIALIZATION
// ===========================

const startServer = async () => {
    try {
        console.log('🚀 [VOTE SERVICE] Avvio server di processamento voti...');
        
        // Test connessione database
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ [VOTE SERVICE] Impossibile connettersi al database');
            process.exit(1);
        }
        
        console.log('✅ [VOTE SERVICE] Database connesso');
        
        // Sincronizza modelli database (solo in development)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ [VOTE SERVICE] Modelli database sincronizzati');
        }
        
        // Avvia il server Express
        const server = app.listen(PORT, () => {
            console.log(`✅ [VOTE SERVICE] Server in ascolto su porta ${PORT}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Database: ${process.env.DB_NAME || 'evoting_wabisabi'}`);
            console.log(`   Bitcoin Network: ${process.env.BITCOIN_NETWORK || 'testnet'}`);
        });
        
        // Avvia il servizio CoinJoin Trigger se abilitato
        if (process.env.ENABLE_COINJOIN_TRIGGER === 'true') {
            console.log('🔄 [COINJOIN] Avvio servizio trigger automatico...');
            CoinJoinTriggerService.start();
        } else {
            console.log('⏸️  [COINJOIN] Servizio trigger automatico disabilitato');
        }
        
        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n📍 [VOTE SERVICE] ${signal} ricevuto, chiusura graceful...`);
            
            // Ferma il servizio CoinJoin
            if (CoinJoinTriggerService.isRunning) {
                console.log('⏹️  [COINJOIN] Arresto servizio trigger...');
                CoinJoinTriggerService.stop();
            }
            
            // Chiudi il server Express
            server.close(() => {
                console.log('🛑 [VOTE SERVICE] Server HTTP chiuso');
            });
            
            // Chiudi connessione database
            try {
                await sequelize.close();
                console.log('🔌 [VOTE SERVICE] Connessione database chiusa');
            } catch (error) {
                console.error('❌ [VOTE SERVICE] Errore chiusura database:', error);
            }
            
            process.exit(0);
        };
        
        // Gestione segnali di terminazione
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Gestione errori non catturati
        process.on('uncaughtException', (error) => {
            console.error('❌ [VOTE SERVICE] Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ [VOTE SERVICE] Unhandled Rejection at:', promise, 'reason:', reason);
        });
        
    } catch (error) {
        console.error('❌ [VOTE SERVICE] Errore fatale durante l\'avvio:', error);
        process.exit(1);
    }
};

// Avvia il server
startServer();