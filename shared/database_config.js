const { Sequelize, DataTypes } = require('sequelize');

console.log('🔗 Inizializzazione database config centralizzata...');
console.log('Environment vars:', {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV
});

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
            underscored: true,        // Usa snake_case per DB
            freezeTableName: true,    // Non pluralizzare tabelle
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

// ====================
// TUTTI I MODELLI CENTRALIZZATI
// ====================

// Modello User (usato da server2 e server3)
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
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: 'bitcoin_address'
    },
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_authorized'
    },
    authorizationProof: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'authorization_proof'
    },
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
    tableName: 'users'
});

// Modello Election (usato da server2 e server3)
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
        field: 'start_date'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'end_date'
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_active'
    },
    votingMethod: {
        type: DataTypes.ENUM('single', 'multiple', 'ranked'),
        defaultValue: 'single',
        field: 'voting_method'
    },
    coinjoinEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'coinjoin_enabled'
    },
    coinjoinTrigger: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
        field: 'coinjoin_trigger'
    },
    blockchainNetwork: {
        type: DataTypes.ENUM('mainnet', 'testnet', 'regtest'),
        defaultValue: 'testnet',
        field: 'blockchain_network'
    },
    maxVotersAllowed: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_voters_allowed'
    }
}, {
    tableName: 'elections'
});

// Modello Candidate (usato da server3)
const Candidate = sequelize.define('Candidate', {
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
    party: {
        type: DataTypes.STRING,
        allowNull: true
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    voteEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'vote_encoding'
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'bitcoin_address'
    },
    bitcoinPublicKey: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'bitcoin_public_key'
    }
}, {
    tableName: 'candidates'
});

// Modello ElectionWhitelist (usato da server2)
const ElectionWhitelist = sequelize.define('ElectionWhitelist', {
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
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
    },
    authorizedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'authorized_at'
    },
    authorizedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'authorized_by'
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
    }
}, {
    tableName: 'election_whitelist'
});

// Modello VotingSession (usato da server3)
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
    status: {
        type: DataTypes.ENUM('pending', 'active', 'completed', 'failed'),
        defaultValue: 'pending'
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
    tableName: 'voting_sessions'
});

// Modello Vote (usato da server3)
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
    }
}, {
    tableName: 'votes'
});

// Modello Transaction (usato da server3)
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
    tableName: 'transactions'
});

// Modello SystemSettings (usato da server2)
const SystemSettings = sequelize.define('SystemSettings', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isPublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_public'
    }
}, {
    tableName: 'system_settings'
});

// Modello Whitelist legacy (usato da server2)
const Whitelist = sequelize.define('Whitelist', {
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
    authorizedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'authorized_at'
    }
}, {
    tableName: 'whitelist'
});

// ====================
// RELAZIONI TRA MODELLI
// ====================

// User Relations
User.hasMany(ElectionWhitelist, { foreignKey: 'userId', as: 'electionWhitelists' });
ElectionWhitelist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Whitelist, { foreignKey: 'userId', as: 'whitelists' });
Whitelist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Election Relations
Election.hasMany(ElectionWhitelist, { foreignKey: 'electionId', as: 'whitelist' });
ElectionWhitelist.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

Election.hasMany(Candidate, { foreignKey: 'electionId', as: 'candidates' });
Candidate.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

Election.hasMany(VotingSession, { foreignKey: 'electionId', as: 'sessions' });
VotingSession.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

Election.hasMany(Transaction, { foreignKey: 'electionId', as: 'transactions' });
Transaction.belongsTo(Election, { foreignKey: 'electionId', as: 'election' });

// VotingSession Relations
VotingSession.hasMany(Vote, { foreignKey: 'sessionId', as: 'votes' });
Vote.belongsTo(VotingSession, { foreignKey: 'sessionId', as: 'session' });

VotingSession.hasMany(Transaction, { foreignKey: 'sessionId', as: 'transactions' });
Transaction.belongsTo(VotingSession, { foreignKey: 'sessionId', as: 'session' });

// Vote Relations
Vote.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' });
Transaction.hasMany(Vote, { foreignKey: 'transactionId', as: 'votes' });

// ====================
// FUNZIONI DI UTILITÀ
// ====================

// Inizializzazione database
const initializeDatabase = async () => {
    try {
        console.log('🔗 Connessione al database PostgreSQL...');
        await sequelize.authenticate();
        console.log('✅ Connessione database stabilita');
        
        console.log('📋 Sincronizzazione modelli...');
        await sequelize.sync({ alter: true });
        console.log('✅ Modelli sincronizzati');
        
        return true;
    } catch (error) {
        console.error('❌ Errore connessione database:', error);
        return false;
    }
};

// Statistiche veloci
const getQuickStats = async () => {
    try {
        const [users, elections, votes, sessions] = await Promise.all([
            User.count(),
            Election.count(),
            Vote.count(),
            VotingSession.count()
        ]);

        return {
            users: {
                total: users,
                active: await User.count({ where: { status: 'active' } })
            },
            elections: {
                total: elections,
                active: await Election.count({ where: { status: 'active' } })
            },
            votes: {
                total: votes,
                pending: await Vote.count({ where: { transactionId: null } }),
                confirmed: await Vote.count({ where: { transactionId: { [require('sequelize').Op.not]: null } } })
            },
            sessions: {
                total: sessions,
                active: await VotingSession.count({ where: { status: 'active' } })
            }
        };
    } catch (error) {
        console.error('❌ Errore calcolo statistiche:', error);
        return {
            users: { total: 0, active: 0 },
            elections: { total: 0, active: 0 },
            votes: { total: 0, pending: 0, confirmed: 0 },
            sessions: { total: 0, active: 0 }
        };
    }
};

// ====================
// EXPORTS CONFIGURABILI PER SERVIZIO
// ====================

// Export completo per riferimento
const allModels = {
    sequelize,
    User,
    Election,
    Candidate,
    ElectionWhitelist,
    VotingSession,
    Vote,
    Transaction,
    SystemSettings,
    Whitelist,
    initializeDatabase,
    getQuickStats
};

// Export specifici per servizio
const getModelsForService = (serviceName) => {
    switch (serviceName) {
        case 'auth':
        case 'server2':
            return {
                sequelize,
                User,
                Election,
                ElectionWhitelist,
                SystemSettings,
                Whitelist,
                initializeDatabase,
                getQuickStats
            };
        
        case 'vote':
        case 'server3':
            return {
                sequelize,
                User,
                Election,
                Candidate,
                VotingSession,
                Vote,
                Transaction,
                initializeDatabase,
                getQuickStats
            };
        
        case 'gateway':
        case 'server1':
            return {
                sequelize,
                initializeDatabase,
                getQuickStats
            };
        
        default:
            return allModels;
    }
};

// Export di default (tutto)
module.exports = allModels;

// Export per servizi specifici
module.exports.getModelsForService = getModelsForService;

console.log('📦 Database config centralizzata caricata');