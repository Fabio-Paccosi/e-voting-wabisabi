# 🗳️ E-Voting WabiSabi

Progetto di Tesi Magistrale di Fabio Paccosi su un sistema di **E-Voting Anonimo e Sicuro** basato sul **protocollo WabiSabi** e **tecnologia blockchain Bitcoin**.

## Panoramica

Questo progetto di Tesi implementa un sistema di voto elettronico che utilizza il protocollo WabiSabi per garantire **anonimato completo**, **sicurezza crittografica** e **verificabilità** dei risultati.
Il sistema combina tecniche crittografiche avanzate con la blockchain Bitcoin per creare un meccanismo di voto teoricamente impossibile da manipolare.

### Caratteristiche Principali

- **Anonimato Garantito**: I voti sono completamente anonimi e non ricollegabili all'identità del votante
- **Anti-Double Voting**: Sistema di serial numbers univoci previene il doppio voto
- **Verificabilità**: Risultati pubblicamente verificabili sulla blockchain Bitcoin
- **Sicurezza Crittografica**: Utilizza commitment omomorfi e prove a zero conoscenza
- **Scalabilità**: Architettura a microservizi con separazione delle responsabilità

## Architettura del Sistema

Il sistema è composto da tre layer principali:

### **Client Layer**
- **Frontend React**: Interfaccia utente per votazione e verifica risultati
- **Crittografia Locale**: Generazione commitment, zero-knowledge proofs, gestione chiavi private
- **Interfaccia Blockchain**: Verifica transazioni e lettura della blockchain

### **Server Layer**
- **Server 1 (API Gateway)**: Routing, autenticazione, rate limiting
- **Server 2 (Auth & Credentials)**: Gestione identità, emissione credenziali KVAC
- **Server 3 (Vote Processing)**: Validazione voti, aggregazione, broadcasting blockchain

### **Data Layer**
- **PostgreSQL**: Database per utenti, credenziali, voti anonimi
- **Bitcoin Blockchain**: Storage immutabile dei risultati finali

## Prerequisiti per l'utilizzo

Prima di iniziare, assicurati di avere installato:

- **Docker** (versione 20.0 o superiore)
- **Docker Compose** (versione 2.0 o superiore)
- **Node.js** (versione 18 o superiore)
- **npm** (versione 8 o superiore)

### Verifica Prerequisiti

```bash
# Verifica Docker
docker --version
docker compose version

# Verifica Node.js e npm
node --version
npm --version
```

## Installazione e Avvio

### 1. Clone del Repository

```bash
git clone https://github.com/Fabio-Paccosi/e-voting-wabisabi.git
cd e-voting-wabisabi
```

### 2. Installazione Dipendenze

```bash
# Installa dipendenze per il progetto Admin Dashboard
cd admin && npm install && cd ..

# Installa dipendenze per il progetto Client Frontend
cd client && npm install && cd ..
```

### 3. Avvio del Sistema

Il sistema può essere avviato in tre modalità:

#### **Avvio Standard (raccomandato se non vengono effettuate modifiche ai servizi backend)**

```bash
# Terminale 1: Avvia backend services (Database + API)
docker compose up

# Terminale 2: Admin Dashboard
cd admin && npm start

# Terminale 3: Client Frontend
cd client && npm start
```

#### **Avvio con Rebuild**

```bash
# Se hai modificato il codice dei servizi backend
docker compose up --build
```

#### **Rebuild Completo (per modifiche complesse e aggiornamenti dei files di configurazione dei servizi)**

```bash
# Stop tutti i container
docker compose down

# Rimuovi le immagini precedenti
docker rmi $(docker images "evoting*" -q) 2>/dev/null || true

# Rebuild senza cache
docker compose build --no-cache

# Riavvia
docker compose up
```

### 4. Accesso alle Applicazioni

Una volta avviato il sistema:

- **Admin Dashboard**: http://localhost:300x
  - Username: `admin@example.com` (accesso invisibile abilitato per la modalità test)
  - Password: `admin123` (accesso invisibile abilitato per la modalità di test)
  
- **Client Frontend**: http://localhost:300y

- **API Gateway**: http://localhost:3001/api

## Funzionamento del Protocollo WabiSabi

Il protocollo WabiSabi applicato al voto elettronico funziona attraverso tre fasi principali:

### **Fase 1: Registrazione e Autenticazione**

1. **Verifica KYC**: Il sistema verifica l'identità del votante attraverso documenti o sistemi di identità digitale
2. **Controllo Whitelist**: Verifica che il votante sia autorizzato a partecipare all'elezione specifica
3. **Emissione Credenziali KVAC**: Rilascio di Keyed-Verification Anonymous Credentials che permettono di dimostrare il diritto di voto senza rivelare l'identità

```
Votante → Sistema KYC → Whitelist Check → Credenziali KVAC
```

### **Fase 2: Preparazione del Voto**

1. **Generazione Commitment**: Il client crea un commitment crittografico che nasconde il voto (es. Candidato A = 0, Candidato B = 1)
2. **Zero-Knowledge Proof**: Genera una prova matematica che il voto è valido senza rivelarne il contenuto
3. **Serial Number**: Crea un identificatore univoco per prevenire il doppio voto
4. **Firma Digitale**: Il voto viene firmato digitalmente per garantire l'integrità

```
Voto → Commitment Crittografico → ZK-Proof → Serial Number → Firma
```

### **Fase 3: Invio e Validazione**

1. **Invio Anonimo**: Il voto viene inviato al coordinatore insieme alle prove crittografiche
2. **Validazione KVAC**: Il sistema verifica le credenziali senza identificare il votante
3. **Controllo Serial**: Verifica che il serial number non sia già stato utilizzato
4. **Aggregazione**: I voti vengono aggregati utilizzando proprietà omomorfe dei commitment

```
Voto Anonimo → Validazione Credenziali → Controllo Duplicati → Aggregazione
```

### **Fase 4: Finalizzazione Blockchain**

1. **CoinJoin Building**: Tutti i voti validi vengono aggregati in una transazione Bitcoin
2. **Broadcasting**: La transazione viene pubblicata sulla blockchain
3. **Conferme**: Si attendono le conferme per garantire immutabilità
4. **Conteggio**: I risultati vengono calcolati e resi pubblicamente verificabili

### Proprietà di Sicurezza Garantite

- **Anonimato**: Impossibile collegare un voto specifico a un votante
- **Integrità**: I voti non possono essere modificati una volta registrati
- **Verificabilità**: Chiunque può verificare la correttezza del conteggio
- **Non-repudiation**: I risultati sono immutabili sulla blockchain
- **Uncoercibility**: Non è possibile generare prove del proprio voto per vendita/coercizione

## Testing e Validazione

### Test di Sistema

```bash
# Test health check
curl http://localhost:3001/api/health

# Test connessione admin
curl http://localhost:3001/api/admin/test-connection

# Test login admin
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Simulazione Processo di Voto

1. **Registra votanti di test**
2. **Crea elezione di test**
3. **Simula processo di voto completo**
4. **Verifica risultati su blockchain**

## 🛠️ Comandi Utili

### Gestione Database

```bash
# Rimuovi database (reset completo)
docker volume rm wabisabi_evoting_postgres_data

# Esegui migrazioni
node database/migrations/run-migrations.js run

# Backup database
docker exec -t postgres_container pg_dump -U user database > backup.sql

# Restore database  
docker exec -i postgres_container psql -U user database < backup.sql
```

### Debugging

```bash
# Log servizi database
docker compose logs vote-service | grep -i "error\|database"

# Monitoraggio container
docker compose ps
docker compose logs -f [service_name]

# Connessione diretta al database
docker exec -it postgres_container psql -U postgres -d evoting
```

### Manutenzione

```bash
# Pulizia sistema
docker system prune -a

# Rimozione volumi non utilizzati
docker volume prune

# Aggiornamento immagini
docker compose pull
```

## 🔧 Configurazione Avanzata

### Configurazione Bitcoin

```json
{
  "bitcoin_config": {
    "network": "testnet", // o "mainnet" per produzione
    "rpc_host": "localhost",
    "rpc_port": 18332,
    "rpc_user": "bitcoin_user",
    "rpc_password": "secure_password",
    "min_confirmations": 3,
    "fee_rate": 1000 // satoshi per byte
  }
}
```

### Configurazione Sicurezza

```json
{
  "security_config": {
    "max_vote_attempts": 3,
    "session_timeout": 3600,
    "rate_limit": {
      "requests_per_minute": 100,
      "burst": 200
    },
    "encryption": {
      "algorithm": "AES-256-GCM",
      "key_derivation": "PBKDF2"
    }
  }
}
```

## Considerazioni di Sicurezza

### **Ambiente di Produzione**

- Utilizzare HTTPS con certificati SSL validi
- Configurare firewall per limitare accesso ai servizi
- Implementare backup automatici del database
- Utilizzare Bitcoin mainnet con nodo locale
- Configurare monitoraggio e alerting
- Implementare rotazione delle chiavi

### **Audit di Sicurezza**

Il sistema dovrebbe essere sottoposto a:
- **Penetration Testing**: Test di vulnerabilità
- **Audit Crittografico**: Verifica implementazioni crittografiche
- **Code Review**: Revisione del codice da parte di esperti
- **Stress Testing**: Test di carico e resilienza

## Roadmap di Sviluppo

### **Fase 1: Proof-of-Concept**
- Implementazione componenti base WabiSabi
- Interfaccia minima per test
- Validazione concetto con elezioni piccole

### **Fase 2: MVP (Fase corrente)**
- Frontend e Backend completi
- Integrazione blockchain Bitcoin
- Test di sicurezza iniziali

### **Fase 3: Produzione**
- Ottimizzazioni performance
- Audit di sicurezza completo
- Documentazione estesa
- Deployment ambiente produzione