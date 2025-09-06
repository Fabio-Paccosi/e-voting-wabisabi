const { Sequelize, DataTypes } = require('sequelize');
const BitcoinWalletService = require('./services/BitcoinWalletService');

console.log('Inizializzazione database config centralizzata...');
console.log('Environment vars:', {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV
});

// ====================
// GESTIONE THREAD-SAFE DELL'INIZIALIZZAZIONE
// ====================
let isInitialized = false;
let initializationPromise = null;
const initLock = {};

// ====================
// CONFIGURAZIONE SEQUELIZE UNICA
// ====================
const sequelize = new Sequelize(
    process.env.DB_NAME || 'evoting_wabisabi',
    process.env.DB_USER || 'postgres', 
    process.env.DB_PASSWORD || 'SecurePass123!',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,        
            freezeTableName: true,    
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        // Configurazioni per gestire race conditions
        retry: {
            match: [
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/,
                /TimeoutError/,
                /SequelizeUniqueConstraintError/,
                /SequelizeDatabaseError/
            ],
            max: 3
        }
    }
);

// ====================
// TUTTI I MODELLI CENTRALIZZATI
// ====================

// Modello User con gestione sicura dell'enum
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'first_name'
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name'
    },
    taxCode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
        field: 'tax_code'
    },
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_authorized'
    },
    authorizationProof: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'authorization_proof'
    },
    // Gestione sicura dell'enum status
    status: {
        type: DataTypes.ENUM('active', 'suspended', 'pending', 'inactive'),
        defaultValue: 'pending'
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login'
    },
    loginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'login_attempts'
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'has_voted'
    }
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true
});

// Altri modelli esistenti...
const Election = sequelize.define('Election', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed'),
        defaultValue: 'draft'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'start_date'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'end_date'
    },
    maxParticipants: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_participants'
    },
    anonymityLevel: {
        type: DataTypes.ENUM('basic', 'advanced', 'maximum'),
        defaultValue: 'basic',
        field: 'anonymity_level'
    }
}, {
    tableName: 'elections',
    underscored: true,
    timestamps: true
});

const Candidate = sequelize.define('Candidate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'election_id',
        references: {
            model: 'elections',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    party: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    voteEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_address'
    },
    totalVotesReceived: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'total_votes_received'
    },
}, {
    tableName: 'candidates',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

const VotingSession = sequelize.define('VotingSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'election_id',
        references: {
            model: 'elections',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM(
            'preparing',           // Preparazione sessione
            'input_registration',  // Registrazione input WabiSabi
            'output_registration', // Registrazione output WabiSabi
            'signing',            // Firma transazione CoinJoin
            'completed',          // Completato con successo
            'failed',             // Fallito
            'pending',            // In attesa (legacy)
            'active'              // Attivo (legacy)
        ),
        defaultValue: 'preparing'
    },
    minParticipants: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
        field: 'min_participants'
    },
    maxParticipants: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
        field: 'max_participants'
    },
    currentParticipants: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'current_participants'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'start_time'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'end_time'
    },
    transactionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'transaction_count'
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'final_tally_transaction_id'
    }
}, {
    tableName: 'voting_sessions',
    underscored: true,
    timestamps: true
});

const Vote = sequelize.define('Vote', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'session_id',
        references: {
            model: 'voting_sessions',
            key: 'id'
        }
    },
    commitment: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'serial_number'
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
        defaultValue: 'pending'
    },
    transactionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'transaction_id'
    }
}, {
    tableName: 'votes',
    underscored: true,
    timestamps: true
});

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'election_id'
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'session_id'
    },
    txid: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    voteCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'vote_count'
    },
    status: {
        type: DataTypes.ENUM('pending', 'broadcasted', 'confirmed', 'failed'),
        defaultValue: 'pending'
    },
    blockHeight: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'block_height'
    },
    rawData: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'raw_data'
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    confirmations: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
}, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true
});

const Credential = sequelize.define('Credential', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'serial_number'
    },
    signature: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isUsed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_used'
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at'
    }
}, {
    tableName: 'credentials',
    underscored: true,
    timestamps: true
});

const ElectionWhitelist = sequelize.define('ElectionWhitelist', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'election_id',
        references: {
            model: 'elections',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_address'
    },
    bitcoinPublicKey: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_public_key'
    },
    bitcoinPrivateKey: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_private_key'
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'has_voted'
    },
    votedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'voted_at'
    },
    invitedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'invited_at'
    }
}, {
    tableName: 'election_whitelist',
    underscored: true,
    timestamps: true
});

ElectionWhitelist.addHook('beforeCreate', async (whitelistEntry, options) => {
    // Log iniziale
    console.log(`[WHITELIST-HOOK] 🔑 Generazione automatica indirizzo Bitcoin per utente ${whitelistEntry.userId}, elezione ${whitelistEntry.electionId}`);
    
    try {
        // *** STEP 1: Verifica se l'indirizzo è già specificato ***
        if (whitelistEntry.bitcoinAddress && whitelistEntry.bitcoinPublicKey) {
            console.log(`[WHITELIST-HOOK] ℹ️ Indirizzo Bitcoin già specificato: ${whitelistEntry.bitcoinAddress}`);
            return; // Non generare se già presente
        }
        
        // *** STEP 2: Carica e inizializza il BitcoinWalletService ***
        const BitcoinWalletService = require('./services/BitcoinWalletService');
        const bitcoinService = new BitcoinWalletService();
        
        console.log(`[WHITELIST-HOOK] 🔧 Servizio Bitcoin inizializzato per network: ${process.env.BITCOIN_NETWORK || 'testnet'}`);
        
        // *** STEP 3: Genera nuovo wallet Bitcoin ***
        const walletData = await bitcoinService.generateWalletForUser(
            whitelistEntry.electionId, 
            whitelistEntry.userId
        );
        
        // *** STEP 4: Assegna i dati Bitcoin all'entry ***
        whitelistEntry.bitcoinAddress = walletData.address;
        whitelistEntry.bitcoinPublicKey = walletData.publicKey;
        whitelistEntry.bitcoinPrivateKey = JSON.stringify(walletData.encryptedPrivateKey);
        
        // *** STEP 5: Log di successo ***
        console.log(`[WHITELIST-HOOK] ✅ Indirizzo Bitcoin generato con successo!`);
        console.log(`[WHITELIST-HOOK]    📧 Utente: ${whitelistEntry.userId}`);
        console.log(`[WHITELIST-HOOK]    🗳️  Elezione: ${whitelistEntry.electionId}`);
        console.log(`[WHITELIST-HOOK]    💰 Indirizzo: ${walletData.address}`);
        console.log(`[WHITELIST-HOOK]    🔑 Chiave pubblica: ${walletData.publicKey.substring(0, 16)}...`);
        console.log(`[WHITELIST-HOOK]    🔒 Chiave privata: [CRITTOGRAFATA]`);
        
        // *** STEP 6: Gestione UTXO se disponibili ***
        if (walletData.utxo && walletData.utxo.length > 0) {
            console.log(`[WHITELIST-HOOK] 💎 UTXO disponibili: ${walletData.utxo.length}`);
            
            // Salva informazioni UTXO nei campi aggiuntivi se disponibili
            if (walletData.utxo[0]) {
                whitelistEntry.utxo_txid = walletData.utxo[0].txid;
                whitelistEntry.utxo_vout = walletData.utxo[0].vout;
                whitelistEntry.utxo_amount = walletData.utxo[0].value;
            }
        } else {
            console.log(`[WHITELIST-HOOK] 📭 Nessun UTXO disponibile per il nuovo indirizzo`);
        }
        
    } catch (error) {
        // *** GESTIONE ERRORI ***
        console.error('[WHITELIST-HOOK] ❌ ERRORE durante generazione indirizzo Bitcoin:', error);
        console.error('[WHITELIST-HOOK] Stack trace:', error.stack);
        
        // Decidi se bloccare la creazione o permetterla senza Bitcoin
        const allowWithoutBitcoin = process.env.ALLOW_WHITELIST_WITHOUT_BITCOIN === 'true';
        
        if (allowWithoutBitcoin) {
            // Permetti la creazione ma logga l'errore
            console.warn('[WHITELIST-HOOK] ⚠️ Creazione whitelist permessa senza indirizzo Bitcoin');
            whitelistEntry.bitcoinAddress = null;
            whitelistEntry.bitcoinPublicKey = null;
            whitelistEntry.bitcoinPrivateKey = null;
        } else {
            // Blocca la creazione dell'entry
            throw new Error(`Impossibile creare entry whitelist: ${error.message}`);
        }
    }
});

// Aggiunge un metodo al modello per verificare se il wallet Bitcoin è valido
ElectionWhitelist.prototype.hasValidBitcoinWallet = function() {
    return !!(this.bitcoinAddress && this.bitcoinPublicKey && this.bitcoinPrivateKey);
};

// Metodo sicuro per accedere alla chiave privata quando necessario
ElectionWhitelist.prototype.getDecryptedPrivateKey = async function() {
    if (!this.bitcoinPrivateKey) {
        throw new Error('Chiave privata Bitcoin non disponibile');
    }
    
    try {
        const BitcoinWalletService = require('./services/BitcoinWalletService');
        const bitcoinService = new BitcoinWalletService();
        
        const encryptedData = JSON.parse(this.bitcoinPrivateKey);
        const decryptedKey = bitcoinService.decryptPrivateKey(encryptedData);
        
        return decryptedKey;
    } catch (error) {
        console.error('[WHITELIST-DECRYPT] ❌ Errore decrittografia chiave privata:', error);
        throw new Error('Impossibile decrittare la chiave privata Bitcoin');
    }
};

// Metodo di classe per riparare entries esistenti senza indirizzo Bitcoin
ElectionWhitelist.repairMissingBitcoinAddresses = async function(electionId = null) {
    console.log('[WHITELIST-REPAIR] 🔧 Inizio riparazione indirizzi Bitcoin mancanti...');
    
    try {
        const whereClause = { 
            bitcoinAddress: { [Op.is]: null }
        };
        
        if (electionId) {
            whereClause.electionId = electionId;
        }
        
        const entriesWithoutBitcoin = await ElectionWhitelist.findAll({
            where: whereClause,
            include: [{ 
                model: User, 
                as: 'user',
                attributes: ['id', 'email', 'firstName', 'lastName']
            }]
        });
        
        console.log(`[WHITELIST-REPAIR] 📋 Trovate ${entriesWithoutBitcoin.length} entries senza indirizzo Bitcoin`);
        
        const BitcoinWalletService = require('./services/BitcoinWalletService');
        const bitcoinService = new BitcoinWalletService();
        
        let repaired = 0;
        let errors = 0;
        
        for (const entry of entriesWithoutBitcoin) {
            try {
                const walletData = await bitcoinService.generateWalletForUser(
                    entry.electionId, 
                    entry.userId
                );
                
                await entry.update({
                    bitcoinAddress: walletData.address,
                    bitcoinPublicKey: walletData.publicKey,
                    bitcoinPrivateKey: JSON.stringify(walletData.encryptedPrivateKey)
                });
                
                console.log(`[WHITELIST-REPAIR] ✅ Riparato ${entry.user?.email || entry.userId}: ${walletData.address}`);
                repaired++;
                
            } catch (error) {
                console.error(`[WHITELIST-REPAIR] ❌ Errore per entry ${entry.id}:`, error);
                errors++;
            }
        }
        
        const result = {
            total: entriesWithoutBitcoin.length,
            repaired,
            errors,
            message: `Riparazione completata: ${repaired} successi, ${errors} errori`
        };
        
        console.log(`[WHITELIST-REPAIR] 📊 ${result.message}`);
        return result;
        
    } catch (error) {
        console.error('[WHITELIST-REPAIR] ❌ Errore durante riparazione:', error);
        throw error;
    }
};

// ====================
// RELAZIONI
// ====================
User.hasMany(Credential, { 
    foreignKey: 'userId', 
    as: 'credentials' 
});
Credential.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
});

User.hasMany(ElectionWhitelist, { 
    foreignKey: 'userId', 
    as: 'whitelistEntries' 
});
ElectionWhitelist.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
});

Election.hasMany(ElectionWhitelist, { 
    foreignKey: 'electionId', 
    as: 'whitelist' 
});
ElectionWhitelist.belongsTo(Election, { 
    foreignKey: 'electionId', 
    as: 'election' 
});

Election.hasMany(Candidate, { 
    foreignKey: 'electionId', 
    as: 'candidates' 
});
Candidate.belongsTo(Election, { 
    foreignKey: 'electionId', 
    as: 'election' 
});

Election.hasMany(VotingSession, { 
    foreignKey: 'electionId', 
    as: 'sessions' 
});
VotingSession.belongsTo(Election, { 
    foreignKey: 'electionId', 
    as: 'election' 
});

Election.hasMany(Transaction, { 
    foreignKey: 'electionId', 
    as: 'transactions' 
});
Transaction.belongsTo(Election, { 
    foreignKey: 'electionId', 
    as: 'election' 
});

VotingSession.hasMany(Vote, { 
    foreignKey: 'sessionId', 
    as: 'votes' 
});
Vote.belongsTo(VotingSession, { 
    foreignKey: 'sessionId', 
    as: 'votingSession'
});

VotingSession.hasMany(Transaction, { 
    foreignKey: 'sessionId', 
    as: 'sessionTransactions'
});
Transaction.belongsTo(VotingSession, { 
    foreignKey: 'sessionId', 
    as: 'votingSession'
});

Vote.belongsTo(Transaction, { 
    foreignKey: 'transactionId', 
    as: 'transaction' 
});
Transaction.hasMany(Vote, { 
    foreignKey: 'transactionId', 
    as: 'votes' 
});

// ====================
// FUNZIONI DI UTILITÀ
// ====================

const getQuickStats = async () => {
    try {
        const [
            totalVotes, pendingVotes, confirmedVotes, failedVotes,
            totalElections, activeElections,
            totalSessions, activeSessions
        ] = await Promise.all([
            Vote.count(),
            Vote.count({ where: { status: 'pending' } }),
            Vote.count({ where: { status: 'confirmed' } }),
            Vote.count({ where: { status: 'failed' } }),
            Election.count(),
            Election.count({ where: { status: 'active' } }),
            VotingSession.count(),
            VotingSession.count({ where: { status: 'active' } })
        ]);

        return {
            votes: {
                total: totalVotes,
                pending: pendingVotes,
                confirmed: confirmedVotes,
                failed: failedVotes
            },
            elections: {
                total: totalElections,
                active: activeElections
            },
            sessions: {
                total: totalSessions,
                active: activeSessions
            }
        };
    } catch (error) {
        console.error('Errore recupero statistiche:', error);
        return {
            votes: { total: 0, pending: 0, confirmed: 0, failed: 0 },
            elections: { total: 0, active: 0 },
            sessions: { total: 0, active: 0 }
        };
    }
};

// ====================
// INIZIALIZZAZIONE THREAD-SAFE
// ====================
const initializeDatabase = async () => {
    // Prevenire inizializzazioni multiple contemporanee
    if (isInitialized) {
        return true;
    }
    
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log('Connessione al database PostgreSQL...');
            await sequelize.authenticate();
            console.log(' Connessione database stabilita');
            
            console.log('Sincronizzazione modelli...');
            
            try {
                // Sync con gestione errori specifici per PostgreSQL
                await sequelize.sync({ 
                    alter: true,
                    force: false
                });
                console.log(' Database sincronizzato correttamente');
                
            } catch (syncError) {
                console.log('Gestione errori di sincronizzazione...');
                
                // Gestisci errori specifici di enum già esistenti
                if (syncError.name === 'SequelizeUniqueConstraintError' && 
                    syncError.parent && 
                    syncError.parent.code === '23505' &&
                    syncError.parent.constraint === 'pg_type_typname_nsp_index') {
                    
                    console.log(' Enum già esistente, continuando...');
                    
                } else if (syncError.name === 'SequelizeDatabaseError' && 
                          syncError.parent && 
                          syncError.parent.code === '42701') {
                    
                    console.log(' Colonne già esistenti, continuando...');
                    
                } else {
                    // Per altri errori, prova sync senza alter
                    console.log(' Tentativo sync senza alter...');
                    try {
                        await sequelize.sync({ alter: false, force: false });
                        console.log(' Database sincronizzato senza modifiche');
                    } catch (secondError) {
                        console.warn(' Errore sync secondario (non critico):', secondError.message);
                    }
                }
            }
            
            isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('Database error:', error);
            
            // Reset per permettere retry
            initializationPromise = null;
            
            // Non fermare l'applicazione, continua comunque
            console.log(' [AUTH CLIENT] Errore inizializzazione database');
            return false;
        }
    })();

    return initializationPromise;
};

console.log(' Database config centralizzata caricata');

// ====================
// FUNZIONE PER COMPATIBILITÀ CON CODICE ESISTENTE
// ====================
const getModelsForService = (serviceName) => {
    console.log(`Richiesta modelli per servizio: ${serviceName}`);
    
    // Restituisce tutti i modelli indipendentemente dal servizio
    // Ogni servizio può accedere a tutti i modelli condivisi
    return {
        sequelize,
        Sequelize,
        User,
        Election,
        Candidate,
        VotingSession,
        Vote,
        Transaction,
        Credential,
        ElectionWhitelist,
        getQuickStats,
        initializeDatabase
    };
};

// ====================
// EXPORT
// ====================
module.exports = {
    sequelize,
    Sequelize,
    User,
    Election,
    Candidate,
    VotingSession,
    Vote,
    Transaction,
    Credential,
    ElectionWhitelist,
    getQuickStats,
    initializeDatabase,
    getModelsForService
};