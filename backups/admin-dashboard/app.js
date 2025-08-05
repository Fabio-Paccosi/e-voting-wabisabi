const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'admin-dashboard',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Admin dashboard main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints per admin
app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalElections: 3,
        totalVotes: 156,
        activeUsers: 45,
        whitelistUsers: 12
    });
});

app.get('/api/admin/elections', (req, res) => {
    res.json([
        { id: 1, name: 'Elezioni Comunali 2024', status: 'active', votes: 89 },
        { id: 2, name: 'Referendum Locale', status: 'completed', votes: 67 }
    ]);
});

// Catch all - serve admin dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎛️ Admin Dashboard listening on port ${PORT}`);
    console.log(`📊 Access dashboard at: http://localhost:${PORT}`);
});

module.exports = app;
