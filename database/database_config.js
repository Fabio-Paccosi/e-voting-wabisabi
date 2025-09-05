console.log('Inizializzazione database config...');

const { Sequelize, DataTypes } = require('sequelize');

// Debug environment variables
console.log('Environment vars:', {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV
});

// CONFIGURAZIONE CORRETTA con underscored: true
const sequelize = new Sequelize(
    process.env.DB_NAME || 'evoting_wabisabi',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'password',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        
        // CONFIGURAZIONE CRITICA PER SNAKE_CASE <-> CAMELCASE
        define: {
            underscored: true,        // Usa snake_case per le colonne nel DB
            freezeTableName: true,    // Non pluralizzare i nomi delle tabelle
            timestamps: true,         // Aggiungi created_at e updated_at
            createdAt: 'created_at',  // Mappa createdAt -> created_at
            updatedAt: 'updated_at'   // Mappa updatedAt -> updated_at
        },
        
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// ====================
// MODELLO USER
// ====================
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
        field: 'first_name'  // Mappa a first_name nel DB
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name'   // Mappa a last_name nel DB
    },
    taxCode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
        field: 'tax_code'    // Mappa a tax_code nel DB
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_address'
    },
    bitcoinPrivateKey: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'bitcoin_private_key'
    },
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_authorized'
    },
    authorizationProof: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'authorization_proof'
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'has_voted'
    },
    createdAt: {
        type: DataTypes.TIMESTAMP,
        defaultValue: false,
        field: 'created_at'
    }
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true
});

// ====================
// MODELLO ELECTION
// ====================
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
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'start_date'  // MAPPA a start_date nel DB
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'end_date'    // MAPPA a end_date nel DB
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_active'   // MAPPA a is_active nel DB
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft'
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'final_tally_transaction_id'
    },
    coinjoinTrigger: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
        field: 'coinjoin_trigger'
    },
    coinjoinEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'coinjoin_enabled'
    },
    maxVotersAllowed: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_voters_allowed'
    },
    votingMethod: {
        type: DataTypes.STRING,
        defaultValue: 'single',
        field: 'voting_method'
    },
    blockchainNetwork: {
        type: DataTypes.STRING,
        defaultValue: 'testnet',
        field: 'blockchain_network'
    }
}, {
    tableName: 'elections',
    underscored: true,
    timestamps: true
});

// ====================
// MODELLO CANDIDATE 
// ====================
const Candidate = sequelize.define('Candidate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'election_id',  // MAPPA a election_id nel DB
        references: {
            model: Election,
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'first_name'
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'last_name'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    party: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'bitcoin_address'
    },
    bitcoinPublicKey: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'bitcoin_public_key'
    },
    voteEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'vote_encoding'
    },
    totalVotesReceived: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'total_votes_received'
    }
}, {
    tableName: 'candidates',
    underscored: true,
    timestamps: true
});

// ====================
// MODELLO VOTING SESSION 
// ====================
const VotingSession = sequelize.define('VotingSession', {
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
    startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'start_time'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'end_time'
    },
    status: {
        type: DataTypes.ENUM('preparing', 'input_registration', 'output_registration', 'signing', 'completed', 'failed'),
        defaultValue: 'preparing'
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

// ====================
// MODELLO VOTE 
// ====================
const Vote = sequelize.define('Vote', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'session_id'
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'serial_number'
    },
    commitment: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'transaction_id'
    },
    status: {
        type: DataTypes.ENUM('pending', 'processed', 'confirmed', 'failed'),
        defaultValue: 'pending'
    },
    submittedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'submitted_at'
    },
    processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'processed_at'
    }
}, {
    tableName: 'votes',
    underscored: true,
    timestamps: true
});

// ====================
// MODELLO TRANSACTION   
// ====================
const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'election_id'
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'session_id'
    },
    txId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'tx_id'
    },
    type: {
        type: DataTypes.ENUM('coinjoin', 'tally', 'funding'),
        allowNull: false
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
    blockHeight: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'block_height'
    },
    blockHash: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'block_hash'
    }
}, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true
});

// ====================
// MODELLO CREDENTIAL 
// ====================
const Credential = sequelize.define('Credential', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'serial_number'
    },
    nonce: {
        type: DataTypes.STRING,
        allowNull: false
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
    issuedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'issued_at'
    }
}, {
    tableName: 'credentials',
    underscored: true,
    timestamps: true
});

// ====================
// DEFINISCI LE RELAZIONI
// ====================

// Election -> Candidate (1:N)
Election.hasMany(Candidate, {
    foreignKey: 'election_id',
    as: 'candidates'
});
Candidate.belongsTo(Election, {
    foreignKey: 'election_id',
    as: 'election'
});

// Election -> VotingSession (1:N)
Election.hasMany(VotingSession, {
    foreignKey: 'election_id',
    as: 'sessions'
});
VotingSession.belongsTo(Election, {
    foreignKey: 'election_id',
    as: 'election'
});

// VotingSession -> Vote (1:N)
VotingSession.hasMany(Vote, {
    foreignKey: 'session_id',
    as: 'votes'
});
Vote.belongsTo(VotingSession, {
    foreignKey: 'session_id',
    as: 'session'
});

// ====================
// UTILITY FUNCTIONS
// ====================

// Statistiche rapide
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

// Inizializzazione database
const initializeDatabase = async () => {
    try {
        console.log('Connessione al database PostgreSQL...');
        await sequelize.authenticate();
        console.log(' [VOTE CONFIG] Connessione database stabilita');
        
        console.log('[VOTE CONFIG] Sincronizzazione modelli...');
        await sequelize.sync({ alter: false });
        console.log(' [VOTE CONFIG] Modelli sincronizzati');
        
        return true;
    } catch (error) {
        console.error(' [VOTE CONFIG] Errore connessione database:', error);
        return false;
    }
};

console.log(' Database config loaded');

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
    getQuickStats,
    initializeDatabase
};