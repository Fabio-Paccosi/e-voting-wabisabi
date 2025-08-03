#!/bin/bash
# Script per creare i file mancanti necessari per il build Docker

set -e

echo "🔧 Riparazione files mancanti per il sistema E-Voting WabiSabi"
echo "==============================================================="

# Crea le directory se non esistono
mkdir -p server1 server2 server3

# Crea package.json per server1
echo "📦 Creazione server1/package.json..."
cat > server1/package.json << 'EOF'
{
  "name": "evoting-api-gateway",
  "version": "1.0.0",
  "description": "API Gateway per sistema E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "redis": "^4.6.8",
    "axios": "^1.4.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.9.2",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crea package.json per server2
echo "📦 Creazione server2/package.json..."
cat > server2/package.json << 'EOF'
{
  "name": "evoting-auth-service",
  "version": "1.0.0",
  "description": "Servizio di Autenticazione e Credenziali per E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest",
    "migrate": "node migrations/run-migrations.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.11.1",
    "redis": "^4.6.8",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "crypto": "^1.0.1",
    "joi": "^17.9.2",
    "elliptic": "^6.5.4",
    "bn.js": "^5.2.1",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crea package.json per server3
echo "📦 Creazione server3/package.json..."
cat > server3/package.json << 'EOF'
{
  "name": "evoting-vote-service",
  "version": "1.0.0",
  "description": "Servizio di Elaborazione Voti e Blockchain per E-Voting WabiSabi",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "pg": "^8.11.1",
    "bitcoinjs-lib": "^6.1.3",
    "axios": "^1.4.0",
    "crypto": "^1.0.1",
    "joi": "^17.9.2",
    "elliptic": "^6.5.4",
    "bn.js": "^5.2.1",
    "secp256k1": "^5.0.0",
    "bip39": "^3.1.0",
    "bip32": "^4.0.0",
    "tiny-secp256k1": "^2.2.3",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crea healthcheck.js per server3 se non esiste
if [ ! -f server3/healthcheck.js ]; then
    echo "🏥 Creazione server3/healthcheck.js..."
    cat > server3/healthcheck.js << 'EOF'
// Script di health check per i container Docker

const http = require('http');

const port = process.env.PORT || 3003;

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
EOF
fi

echo ""
echo "✅ Files mancanti creati con successo!"
echo ""
echo "📁 Files creati:"
echo "   - server1/package.json"
echo "   - server2/package.json"  
echo "   - server3/package.json"
echo "   - server3/healthcheck.js (se mancante)"
echo ""
echo "🚀 Ora puoi eseguire di nuovo lo script setup.sh"
echo "   o direttamente: docker compose build"
echo ""

# Verifica se esistono tutti i file necessari
echo "🔍 Verifica files critici:"
for server in server1 server2 server3; do
    if [ -f "$server/package.json" ]; then
        echo "   ✅ $server/package.json"
    else
        echo "   ❌ $server/package.json MANCANTE"
    fi
    
    if [ -f "$server/app.js" ]; then
        echo "   ✅ $server/app.js"
    else
        echo "   ⚠️  $server/app.js MANCANTE"
    fi
    
    if [ -f "$server/healthcheck.js" ]; then
        echo "   ✅ $server/healthcheck.js"
    else
        echo "   ⚠️  $server/healthcheck.js MANCANTE"
    fi
done

echo ""
echo "💡 Se mancano ancora app.js, verifica che esistano nel tuo progetto"
echo "   oppure contatta per generare anche quei files."