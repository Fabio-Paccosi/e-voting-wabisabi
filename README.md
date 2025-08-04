# 🗳️ E-Voting WabiSabi

Sistema di **Voto Elettronico Anonimo e Sicuro** basato sul protocollo WabiSabi e tecnologia blockchain Bitcoin.

## 📖 Panoramica

E-Voting WabiSabi è un sistema di voto elettronico che garantisce **anonimato**, **sicurezza** e **verificabilità** attraverso tecnologie crittografiche avanzate:

- **🔒 Anonimato**: Commitment omomorfi e zero-knowledge proofs
- **🛡️ Sicurezza**: Credenziali KVAC per prevenire doppio voto
- **⛓️ Immutabilità**: Registrazione su blockchain Bitcoin (testnet)
- **🔍 Verificabilità**: Tutti i voti sono pubblicamente verificabili
- **🚫 Non-coercibilità**: Impossibile dimostrare il proprio voto

## 🏗️ Architettura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │  Auth Service   │
│   React.js      │◄──►│   (Port 3001)   │◄──►│   (Port 3002)   │
│   (Port 3000)   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                      │
                                ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Vote Service   │    │  Bitcoin Node   │    │   PostgreSQL    │
│   (Port 3003)   │◄──►│   (Testnet)     │    │   Database      │
│                 │    │   (Port 18332)  │    │   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        |
        ▼
┌─────────────────┐
│   PostgreSQL    │
│   Database      │
│   (Port 5432)   │
└─────────────────┘
```

### Componenti Principali

- **Frontend**: Interfaccia React.js con crittografia lato client
- **API Gateway**: Coordinamento e rate limiting
- **Auth Service**: Gestione utenti e credenziali KVAC
- **Vote Service**: Elaborazione voti e integrazione blockchain
- **Bitcoin Node**: Nodo testnet per immutabilità
- **Database**: PostgreSQL per dati persistenti

## 🛠️ Prerequisiti

- **Docker** >= 20.0
- **Docker Compose** >= 2.0
- **Node.js** >= 18.0 (per sviluppo frontend)
- **Git**
- **curl** (per testing)

## ⚡ Installazione Rapida

### 1. Clone e Setup
```bash
git clone <repository-url>
cd wabisabi_evoting

# Setup automatico completo
chmod +x complete-fix.sh
./complete-fix.sh
```

### 2. Avvio Sistema
```bash
# Avvia backend
docker compose up -d

# Verifica servizi
docker compose ps
./quick-test.sh

# Setup e avvio frontend
./fix-frontend-scripts.sh
cd client && npm start
```

### 3. Accesso
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3001
- **Backend Services**: 3002, 3003

## 📋 **Flusso Completo di Utilizzo**

### **Fase 1: Preparazione Sistema**

1. **Avvia Backend**
   ```bash
   docker compose up -d
   ```

2. **Verifica Servizi**
   ```bash
   ./quick-test.sh
   # Dovresti vedere tutti i servizi "OK"
   ```

3. **Avvia Frontend**
   ```bash
   cd client
   npm start
   ```

4. **Accedi all'Interfaccia**
   - Apri browser su http://localhost:3000
   - Verifica che tutti i servizi siano "✅ online"

### **Fase 2: Registrazione Elettore**

1. **Vai alla tab "👤 Registrazione"**

2. **Compila il modulo**:
   - Email: `mario.rossi@example.com`
   - Nome: `Mario`
   - Cognome: `Rossi`
   - Codice Fiscale: `RSSMRA85M01H501Z`

3. **Clicca "Registrati"**
   - Il sistema verifica l'identità
   - Se autorizzato, ricevi conferma registrazione
   - Vieni automaticamente reindirizzato al voto

### **Fase 3: Processo di Voto Anonimo**

1. **Tab "🗳️ Voto" attivata automaticamente**

2. **Il sistema richiede automaticamente credenziali KVAC**
   - Genera credenziale anonima univoca
   - Serial number per prevenire doppio voto

3. **Seleziona il candidato**:
   - Candidato A
   - Candidato B  
   - Candidato C

4. **Clicca "Vota Anonimamente"**
   - Il sistema genera commitment crittografico
   - Crea zero-knowledge proof
   - Submette voto anonimo
   - Registra su blockchain testnet

5. **Conferma voto**
   - Ricevi ID transazione
   - Voto registrato immutabilmente
   - Anonimato garantito

### **Fase 4: Verifica e Risultati**

1. **Tab "📊 Risultati"**
   - Visualizza stato blockchain
   - Conferma network Bitcoin testnet
   - Verifica connessione nodo

2. **Proprietà di sicurezza verificate**:
   - ✅ Anonimato garantito
   - ✅ Prevenzione doppio voto
   - ✅ Immutabilità blockchain
   - ✅ Zero-knowledge proofs

### **Fase 5: Test Avanzati (Opzionale)**

1. **Test doppio voto** (dovrebbe fallire):
   ```bash
   # Prova a votare di nuovo con stesso utente
   # Sistema dovrebbe rifiutare
   ```

2. **Test multiple registrazioni**:
   ```bash
   # Script per test carico
   for i in {1..5}; do
     curl -X POST http://localhost:3002/api/register \
       -H "Content-Type: application/json" \
       -d "{\"email\": \"user$i@test.com\", \"taxCode\": \"TEST$i\", \"firstName\": \"User\", \"lastName\": \"$i\"}"
   done
   ```

3. **Verifica blockchain**:
   ```bash
   curl http://localhost:3003/api/blockchain/info
   # Verifica network, connessione, block height
   ```

## 🎯 Funzionalità Principali

### 🔐 **Sicurezza Crittografica**
- **KVAC (Keyed-Verification Anonymous Credentials)**: Credenziali anonime
- **Commitment Omomorfi**: Nascondono il voto mantenendo verificabilità
- **Zero-Knowledge Proofs**: Dimostrano validità senza rivelare contenuto
- **Serial Numbers**: Prevenzione doppio voto

### ⛓️ **Integrazione Blockchain**
- **Bitcoin Testnet**: Immutabilità garantita
- **Transaction Monitoring**: Tracking stato voti
- **Public Verifiability**: Tutti possono verificare risultati
- **CoinJoin Protocol**: Aggregazione anonima (WabiSabi)

### 🌐 **Interfaccia Utente**
- **React.js SPA**: Interfaccia moderna e responsive
- **Real-time Status**: Monitoraggio servizi in tempo reale
- **Crypto Browser Support**: Polyfills per operazioni crittografiche
- **Accessible Design**: Interfaccia accessibile e intuitiva

## 🧪 Testing

### Test Rapido
```bash
./quick-test.sh
```

### Test Completo
```bash
./test-system.sh
```

### Test Specifici
```bash
# Health check servizi
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health  
curl http://localhost:3003/api/health

# Test registrazione
curl -X POST http://localhost:3002/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "taxCode": "RSSMRA85M01H501Z", "firstName": "Test", "lastName": "User"}'

# Test blockchain info
curl http://localhost:3003/api/blockchain/info
```

## 📊 Monitoraggio

### Log dei Servizi
```bash
# Tutti i servizi
docker compose logs -f

# Servizio specifico
docker compose logs -f auth-service
docker compose logs -f vote-service
```

### Database
```bash
# Accesso PostgreSQL
docker compose exec postgres psql -U postgres -d evoting_wabisabi

# Query utenti
SELECT email, "isAuthorized", "hasVoted" FROM users LIMIT 10;
```

### Metriche (Opzionale)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (se abilitato)

## 🗂️ Struttura Progetto

```
wabisabi_evoting/
├── 📄 README.md                 # Questa documentazione
├── 📄 docker-compose.yml        # Orchestrazione servizi
├── 📄 .env                      # Configurazione ambiente
├── 📄 Makefile                  # Comandi utili
├── 
├── 🖥️  server1/                 # API Gateway
│   ├── 📄 app.js                # Server Express
│   ├── 📄 package.json          # Dipendenze
│   └── 📄 Dockerfile            # Container config
├── 
├── 🔐 server2/                  # Auth Service  
│   ├── 📄 app.js                # Gestione utenti e KVAC
│   ├── 📄 package.json          # Dipendenze
│   └── 📄 Dockerfile            # Container config
├── 
├── ⛓️  server3/                 # Vote Service
│   ├── 📄 app.js                # Elaborazione voti
│   ├── 📄 package.json          # Dipendenze  
│   └── 📄 Dockerfile            # Container config
├── 
├── 🌐 client/                   # Frontend React
│   ├── 📁 src/                  # Codice sorgente
│   ├── 📁 public/               # File statici
│   ├── 📄 package.json          # Dipendenze React
│   └── 📄 craco.config.js       # Config Webpack
├──
├── 🛠️  scripts/                 # Script di utilità
│   ├── 📄 setup.sh              # Setup iniziale
│   ├── 📄 test-system.sh        # Test completo
│   ├── 📄 quick-test.sh         # Test rapido
│   └── 📄 fix-*.sh              # Script riparazione
└── 
└── 📁 docs/                     # Documentazione
    ├── 📄 architettura.pdf      # Schema architettura
    └── 📄 wabisabi-protocol.pdf # Protocollo WabiSabi
```

## ⚠️ Troubleshooting

### Problema: Servizi non si avviano
```bash
# Verifica Docker
docker --version
docker compose --version

# Restart servizi
docker compose down
docker compose up -d

# Verifica log
docker compose logs
```

### Problema: Frontend non si connette
```bash
# Verifica backend attivo
curl http://localhost:3001/api/health

# Restart frontend
cd client
rm -rf node_modules package-lock.json
npm install
npm start
```

### Problema: Database connection
```bash
# Reset database
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS evoting_wabisabi;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE evoting_wabisabi;"
```

### Problema: Build fallito
```bash
# Clean e rebuild
docker compose down
docker system prune -f
./complete-fix.sh
docker compose build --no-cache
```

## 🔧 Comandi Utili

```bash
# Setup completo
./complete-fix.sh

# Avvio rapido
docker compose up -d && cd client && npm start

# Test sistema
./test-system.sh

# Monitoring
docker compose ps
docker compose logs -f

# Backup database  
docker compose exec postgres pg_dump -U postgres evoting_wabisabi > backup.sql

# Stop sistema
docker compose down
```

## 📚 Risorse Aggiuntive

- **WabiSabi Protocol**: [Paper di ricerca](https://github.com/zkSNACKs/WabiSabi)
- **Bitcoin Testnet**: [Documentazione](https://developer.bitcoin.org/examples/testing.html)
- **KVAC Credentials**: [Cryptographic Specification](https://eprint.iacr.org/2019/1416)
- **Zero-Knowledge Proofs**: [Educational Resources](https://zkproof.org/)

## 🤝 Contribuire

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit modifiche (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi `LICENSE` per dettagli.

## 👥 Team

- **Architettura Sistema**: Design microservizi e sicurezza
- **Crittografia**: Implementazione KVAC e zero-knowledge proofs  
- **Blockchain**: Integrazione Bitcoin e WabiSabi protocol
- **Frontend**: Interfaccia React.js e UX design

---

**🎉 Buon voto elettronico sicuro e anonimo!** 

Per supporto o domande, consulta la documentazione o apri un issue nel repository.