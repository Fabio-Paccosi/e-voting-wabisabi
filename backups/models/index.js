// database/models/index.js
// Modelli del database per il sistema di E-Voting WabiSabi

const { Sequelize, DataTypes } = require('sequelize');

// Configurazione del database
// In produzione, usare variabili d'ambiente per le credenziali
const sequelize = new Sequelize(
    process.env.DB_NAME || 'evoting_wabisabi',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'password',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: process.env.DB_DIALECT || 'postgres',
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
        primaryKey: true,
        comment: 'ID univoco dell\'utente'
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
        comment: 'Email dell\'utente'
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Password hashata con bcrypt'
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nome dell\'utente'
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Cognome dell\'utente'
    },
    taxCode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
        comment: 'Codice fiscale per verifica identità'
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: 'Indirizzo Bitcoin per il voto su testnet'
    },
    bitcoinPrivateKey: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Chiave privata Bitcoin crittografata'
    },
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Se l\'utente è autorizzato a votare'
    },
    authorizationProof: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Prova di autorizzazione (es. hash documento)'
    },
    hasVoted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Se l\'utente ha già votato'
    }
}, {
    tableName: 'users',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            unique: true,
            fields: ['taxCode']
        },
        {
            unique: true,
            fields: ['bitcoinAddress'],
            where: {
                bitcoinAddress: {
                    [Sequelize.Op.ne]: null
                }
            }
        }
    ]
});

// ====================
// MODELLO CREDENTIAL
// ====================
const Credential = sequelize.define('Credential', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco della credenziale'
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        },
        comment: 'ID dell\'utente proprietario'
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Serial number univoco per anti double-spending'
    },
    nonce: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nonce per freschezza della credenziale'
    },
    signature: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Firma KVAC della credenziale'
    },
    isUsed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Se la credenziale è stata utilizzata'
    },
    issuedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp di emissione'
    }
}, {
    tableName: 'credentials',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['serialNumber']
        },
        {
            fields: ['userId']
        },
        {
            fields: ['isUsed']
        }
    ]
});

// ====================
// MODELLO ELECTION
// ====================
const Election = sequelize.define('Election', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco dell\'elezione'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Titolo dell\'elezione'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descrizione dell\'elezione'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data di inizio votazioni'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data di fine votazioni'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Se l\'elezione è attiva'
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft',
        comment: 'Stato dell\'elezione'
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID della transazione finale di conteggio'
    }
}, {
    tableName: 'elections',
    timestamps: true,
    indexes: [
        {
            fields: ['status']
        },
        {
            fields: ['startDate', 'endDate']
        },
        {
            fields: ['isActive']
        }
    ]
});

// ====================
// MODELLO CANDIDATE
// ====================
const Candidate = sequelize.define('Candidate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco del candidato'
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Election,
            key: 'id'
        },
        comment: 'ID dell\'elezione'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nome del candidato'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descrizione del candidato'
    },
    bitcoinAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Indirizzo Bitcoin per ricevere i voti'
    },
    voteEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Encoding numerico del voto'
    }
}, {
    tableName: 'candidates',
    timestamps: true,
    indexes: [
        {
            fields: ['electionId']
        },
        {
            unique: true,
            fields: ['bitcoinAddress']
        },
        {
            fields: ['voteEncoding']
        }
    ]
});

// ====================
// MODELLO VOTING SESSION
// ====================
const VotingSession = sequelize.define('VotingSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco della sessione di voto'
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Election,
            key: 'id'
        },
        comment: 'ID dell\'elezione'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Inizio della sessione'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fine della sessione'
    },
    status: {
        type: DataTypes.ENUM('preparing', 'active', 'completed', 'failed'),
        defaultValue: 'preparing',
        comment: 'Stato della sessione'
    },
    transactionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Numero di transazioni processate'
    },
    finalTallyTransactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID della transazione finale'
    }
}, {
    tableName: 'voting_sessions',
    timestamps: true,
    indexes: [
        {
            fields: ['electionId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['startTime', 'endTime']
        }
    ]
});

// ====================
// MODELLO VOTE
// ====================
const Vote = sequelize.define('Vote', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco del voto'
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: VotingSession,
            key: 'id'
        },
        comment: 'ID della sessione di voto'
    },
    serialNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Serial number della credenziale utilizzata'
    },
    commitment: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Commitment crittografico del voto'
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ID della transazione Bitcoin'
    }
}, {
    tableName: 'votes',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['serialNumber']
        },
        {
            fields: ['sessionId']
        },
        {
            fields: ['transactionId']
        }
    ]
});

// ====================
// MODELLO TRANSACTION
// ====================
const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'ID univoco della transazione'
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Election,
            key: 'id'
        },
        comment: 'ID dell\'elezione associata'
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: VotingSession,
            key: 'id'
        },
        comment: 'ID della sessione associata'
    },
    txId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: 'Transaction ID sulla blockchain'
    },
    type: {
        type: DataTypes.ENUM('coinjoin', 'tally', 'funding'),
        allowNull: false,
        comment: 'Tipo di transazione'
    },
    rawData: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Dati raw della transazione'
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Metadati aggiuntivi'
    },
    confirmations: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Numero di conferme blockchain'
    },
    blockHeight: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Altezza del blocco di inclusione'
    },
    blockHash: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Hash del blocco di inclusione'
    }
}, {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['txId'],
            where: {
                txId: {
                    [Sequelize.Op.ne]: null
                }
            }
        },
        {
            fields: ['electionId']
        },
        {
            fields: ['sessionId']
        },
        {
            fields: ['type']
        },
        {
            fields: ['confirmations']
        }
    ]
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

// Election -> Transactions (1:N)
Election.hasMany(Transaction, {
    foreignKey: 'electionId',
    as: 'transactions'
});
Transaction.belongsTo(Election, {
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

// Test connessione al database
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connessione al database stabilita con successo');
        return true;
    } catch (error) {
        console.error('❌ Impossibile connettersi al database:', error);
        return false;
    }
}

// Sincronizzazione del database
async function syncDatabase(force = false) {
    try {
        await sequelize.sync({ force });
        console.log('✅ Database sincronizzato');
        return true;
    } catch (error) {
        console.error('❌ Errore durante la sincronizzazione:', error);
        return false;
    }
}

// Seeding del database con dati di esempio
async function seedDatabase() {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');
    
    try {
        // Crea utente admin
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = await User.findOrCreate({
            where: { email: 'admin@evoting.local' },
            defaults: {
                email: 'admin@evoting.local',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                taxCode: 'ADMINUSER123456',
                isAuthorized: true,
                bitcoinAddress: 'tb1qadmin123456789abcdef'
            }
        });

        // Crea elezione di test
        const testElection = await Election.findOrCreate({
            where: { title: 'Elezione Test' },
            defaults: {
                title: 'Elezione Test',
                description: 'Elezione di prova per testare il sistema',
                startDate: new Date(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 ore
                status: 'draft'
            }
        });

        console.log('✅ Database popolato con dati di esempio');
        return true;
    } catch (error) {
        console.error('❌ Errore durante il seeding:', error);
        return false;
    }
}

// ====================
// EXPORT
// ====================
module.exports = {
    sequelize,
    Sequelize,
    User,
    Credential,
    Election,
    Candidate,
    VotingSession,
    Vote,
    Transaction,
    testConnection,
    syncDatabase,
    seedDatabase
};