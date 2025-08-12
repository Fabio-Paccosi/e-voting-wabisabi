// server3/database_config.js - Database Configuration for Vote Service
console.log('🔗 Inizializzazione database config...');

const { Sequelize, DataTypes } = require('sequelize');

// Debug environment variables
console.log('Environment vars:', {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV
});

// Configurazione database
const sequelize = new Sequelize(
    process.env.DB_NAME || 'evoting_wabisabi',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'password',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
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
        allowNull: false
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    taxCode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    bitcoinPrivateKey: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    authorizationProof: {
        type: DataTypes.STRING,
        allowNull: true
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'users',
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
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft'
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    coinjoinTrigger: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    coinjoinEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    maxVotersAllowed: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    votingMethod: {
        type: DataTypes.STRING(20),
        defaultValue: 'single'
    },
    blockchainNetwork: {
        type: DataTypes.STRING(10),
        defaultValue: 'testnet'
    }
}, {
    tableName: 'elections',
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
        type: DataTypes.STRING(100),
        allowNull: true
    },
    lastName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    party: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    photo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    bitcoinPublicKey: {
        type: DataTypes.STRING(130),
        allowNull: true
    },
    valueEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    totalVotesReceived: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'candidates',
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
        references: {
            model: Election,
            key: 'id'
        }
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('preparing', 'active', 'completed', 'failed'),
        defaultValue: 'preparing'
    },
    transactionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    voteCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'voting_sessions',
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
        references: {
            model: VotingSession,
            key: 'id'
        }
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    commitment: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    zkProof: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    nonce: {
        type: DataTypes.STRING,
        allowNull: true
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
        defaultValue: 'pending'
    },
    submittedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'votes',
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
        references: {
            model: Election,
            key: 'id'
        }
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: VotingSession,
            key: 'id'
        }
    },
    txId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    type: {
        type: DataTypes.ENUM('coinjoin', 'tally', 'funding'),
        allowNull: false
    },
    rawData: {
        type: DataTypes.TEXT,
        allowNull: true
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
        allowNull: true
    },
    blockHash: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'transactions',
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
        references: {
            model: User,
            key: 'id'
        }
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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
        defaultValue: false
    },
    issuedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'credentials',
    timestamps: true
});

// ====================
// DEFINIZIONE RELAZIONI
// ====================

// User -> Credentials (1:N)
User.hasMany(Credential, {
    foreignKey: 'userId',
    as: 'credentials',
    onDelete: 'CASCADE'
});
Credential.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

// Election -> Candidates (1:N)
Election.hasMany(Candidate, {
    foreignKey: 'electionId',
    as: 'candidates',
    onDelete: 'CASCADE'
});
Candidate.belongsTo(Election, {
    foreignKey: 'electionId',
    as: 'election'
});

// Election -> VotingSessions (1:N)
Election.hasMany(VotingSession, {
    foreignKey: 'electionId',
    as: 'sessions',
    onDelete: 'CASCADE'
});
VotingSession.belongsTo(Election, {
    foreignKey: 'electionId',
    as: 'election'
});

// VotingSession -> Votes (1:N)
VotingSession.hasMany(Vote, {
    foreignKey: 'sessionId',
    as: 'votes',
    onDelete: 'CASCADE'
});
Vote.belongsTo(VotingSession, {
    foreignKey: 'sessionId',
    as: 'session'
});

// Election -> Transactions (1:N)
Election.hasMany(Transaction, {
    foreignKey: 'electionId',
    as: 'transactions'
});
Transaction.belongsTo(Election, {
    foreignKey: 'electionId',
    as: 'election'
});

// VotingSession -> Transactions (1:N)
VotingSession.hasMany(Transaction, {
    foreignKey: 'sessionId',
    as: 'transactions'
});
Transaction.belongsTo(VotingSession, {
    foreignKey: 'sessionId',
    as: 'session'
});

// ====================
// FUNZIONI UTILITY
// ====================

// Statistiche rapide per admin dashboard
const getQuickStats = async () => {
    try {
        const { Op } = require('sequelize');

        const [
            totalVotes,
            pendingVotes,
            confirmedVotes,
            failedVotes,
            totalElections,
            activeElections,
            totalSessions,
            activeSessions
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
        console.log('🔗 Connessione al database PostgreSQL...');
        await sequelize.authenticate();
        console.log('✅ [VOTE CONFIG] Connessione database stabilita');
        
        console.log('📋 [VOTE CONFIG] Sincronizzazione modelli...');
        await sequelize.sync({ alter: false });
        console.log('✅ [VOTE CONFIG] Modelli sincronizzati');
        
        return true;
    } catch (error) {
        console.error('❌ [VOTE CONFIG] Errore connessione database:', error);
        return false;
    }
};

console.log('📦 Database config loaded');

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