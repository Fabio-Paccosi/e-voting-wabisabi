// server1/app.js - API Gateway Completo

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 [API Gateway] Avvio in corso...');
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// CORS - permetti tutti durante debug
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check (PRIMA delle altre route)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// Admin routes (ASSICURATI che il file esista)
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Route admin caricate correttamente');
} catch (error) {
    console.error('❌ Errore caricamento route admin:', error.message);
    console.error('📁 Verifica che esista: ./routes/admin.js');
    
    // Route admin di fallback
    app.get('/api/admin/*', (req, res) => {
        res.status(500).json({ 
            error: 'Route admin non disponibili',
            reason: 'File admin.js mancante',
            path: req.path
        });
    });
}

// Route di test
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API Gateway funzionante',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ Route non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Route non trovata',
        path: req.originalUrl,
        method: req.method,
        service: 'api-gateway',
        availableRoutes: [
            'GET /api/health',
            'GET /api/test',
            'GET /api/admin/stats',
            'POST /api/admin/auth/login'
        ]
    });
});

// Error handler globale
app.use((err, req, res, next) => {
    console.error('💥 Errore non gestito:', err);
    res.status(500).json({ 
        error: 'Errore interno del server',
        message: err.message,
        timestamp: new Date().toISOString(),
        service: 'api-gateway'
    });
});

// IMPORTANTE: Avvia il server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [API Gateway] Server avviato su porta ${PORT}`);
    console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
    console.log(`📊 Admin: http://0.0.0.0:${PORT}/api/admin/*`);
    console.log(`✅ Pronto per le richieste!`);
});

// Gestione shutdown graceful
process.on('SIGTERM', () => {
    console.log('🛑 [API Gateway] Ricevuto SIGTERM, chiusura...');
    server.close(() => {
        console.log('✅ [API Gateway] Server chiuso correttamente');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 [API Gateway] Ricevuto SIGINT, chiusura...');
    server.close(() => {
        console.log('✅ [API Gateway] Server chiuso correttamente');
        process.exit(0);
    });
});

// Gestione errori non catturati
process.on('uncaughtException', (err) => {
    console.error('💥 [API Gateway] Errore non catturato:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [API Gateway] Promise rejection non gestita:', reason);
    process.exit(1);
});

module.exports = app;