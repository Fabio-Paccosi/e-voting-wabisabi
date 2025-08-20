const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('[API GATEWAY] Avvio in corso...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const { initializeDatabase } = require('./shared/database_config').getModelsForService('gateway');

// In startup:
initializeDatabase().then(success => {
    if (success) {
        console.log(' [GATEWAY] Database inizializzato');
    }
});

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

// Admin routes (percorso /api/admin/*)
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log(' Route admin caricate correttamente');
} catch (error) {
    console.error(' Errore caricamento route admin:', error.message);
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

// Client routes (percorso /api/*)
try {
    const clientRoutes = require('./routes/client');
    app.use('/api', clientRoutes);
    console.log(' Route client caricate correttamente');
} catch (error) {
    console.error(' Errore caricamento route client:', error.message);
    console.error('📁 Verifica che esista: ./routes/client.js');
    
    // Route client di fallback per alcune route critiche
    app.post('/api/auth/login', (req, res) => {
        res.status(500).json({ 
            error: 'Route client non disponibili',
            reason: 'File client.js mancante',
            path: req.path
        });
    });
}

// Voting routes (percorso /api/*)
try {
    const votingRoutes = require('./routes/voting');
    app.use('/api/voting', votingRoutes);
    console.log(' Route voting caricate correttamente');
} catch (error) {
    console.error(' Errore caricamento route voting:', error.message);
    console.error('📁 Verifica che esista: ./routes/voting.js');
    
    // Route voting di fallback per alcune route critiche
    app.post('/api/auth/login', (req, res) => {
        res.status(500).json({ 
            error: 'Route voting non disponibili',
            reason: 'File voting.js mancante',
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
    console.log(` Route non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Route non trovata',
        path: req.originalUrl,
        method: req.method,
        service: 'api-gateway',
        availableRoutes: [
            // Health e test
            'GET /api/health',
            'GET /api/test',
            
            // Route admin
            'GET /api/admin/stats',
            'POST /api/admin/auth/login',
            'GET /api/admin/elections',
            'POST /api/admin/elections',
            'PUT /api/admin/elections/:id/status',
            
            // Route client (utenti normali)
            'POST /api/auth/login',
            'POST /api/auth/verify',
            'GET /api/auth/profile',
            'GET /api/elections',
            'GET /api/elections/:id',
            'POST /api/elections/:id/vote',
            'GET /api/whitelist/check',
            'POST /api/whitelist/register'
        ]
    });
});

// Error handler globale
app.use((err, req, res, next) => {
    console.error('💥 Errore non gestito:', err);
    res.status(500).json({ 
        error: 'Errore interno del server',
        message: err.message,
        service: 'api-gateway'
    });
});

app.listen(PORT, () => {
    console.log(`[API GATEWAY] Server avviato su porta ${PORT}`);
    console.log(`Route disponibili:`);
    console.log(`   Admin: http://localhost:${PORT}/api/admin/*`);
    console.log(`   Client: http://localhost:${PORT}/api/*`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;