// Script di health check per i container Docker

const http = require('http');

const port = process.env.PORT || 3001;

const options = {
    host: 'localhost',
    port: port,
    path: '/api/health',
    timeout: 2000
};

const request = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode == 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', (err) => {
    console.log('ERROR:', err);
    process.exit(1);
});

request.end();