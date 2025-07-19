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
        comment: 'Descrizione dettagliata dell\'elezione'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data e ora di inizio'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data e ora di fine'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Se l\'elezione è attualmente attiva'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Metadati aggiuntivi dell\'elezione'
    }
}, {
    tableName: 'elections',
    timestamps: true,
    indexes: [
        {
            fields: ['isActive']
        },
        {
            fields: ['startDate', 'endDate']
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
        comment: 'ID dell\'elezione di appartenenza'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Nome del candidato'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descrizione o biografia del candidato'
    },
    valueEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Valore numerico per codifica voto (0, 1, 2...)'
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
            fields: ['electionId', 'valueEncoding']
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
    status: {
        type: DataTypes.ENUM('active', 'closed', 'processing', 'completed'),
        defaultValue: 'active',
        comment: 'Stato della sessione'
    },
    startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'Ora di inizio della sessione'
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ora di fine della sessione'
    },
    transactionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Numero di transazioni CoinJoin create'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Metadati aggiuntivi della sessione'
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
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Commitment omomorfico del voto'
    },
    zkProof: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Zero-knowledge proof di validità'
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
        defaultValue: 'pending',
        comment: 'Stato del voto'
    },
    transactionId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID della transazione blockchain'
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
            fields: ['status']
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
        comment: 'ID interno della transazione'
    },
    txId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        comment: 'Transaction ID sulla blockchain'
    },
    electionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Election,
            key: 'id'
        },
        comment: 'ID dell\'elezione (opzionale)'
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: VotingSession,
            key: 'id'
        },
        comment: 'ID della sessione (opzionale)'
    },
    type: {
        type: DataTypes.ENUM('coinjoin', 'setup', 'closing'),
        allowNull: false,
        comment: 'Tipo di transazione'
    },
    rawData: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Dati grezzi della transazione'
    },
    metadata: {
        type: DataTypes.JSON,
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
// FUNZIONI DI UTILITÀ
// ====================

// Sincronizza il database
const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force });
        console.log('Database sincronizzato con successo');
    } catch (error) {
        console.error('Errore sincronizzazione database:', error);
        throw error;
    }
};

// Testa la connessione
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connessione al database stabilita con successo');
        return true;
    } catch (error) {
        console.error('Impossibile connettersi al database:', error);
        return false;
    }
};

// Seed iniziale per test
const seedDatabase = async () => {
    try {
        // Crea un'elezione di test
        const election = await Election.create({
            title: 'Elezione Test 2025',
            description: 'Elezione di prova per il sistema WabiSabi',
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 giorni
            isActive: true
        });

        // Crea candidati
        await Candidate.bulkCreate([
            {
                electionId: election.id,
                name: 'John Doe',
                description: 'Candidato 1',
                valueEncoding: 0
            },
            {
                electionId: election.id,
                name: 'Jane Smith',
                description: 'Candidato 2',
                valueEncoding: 1
            }
        ]);

        console.log('Database popolato con dati di test');
    } catch (error) {
        console.error('Errore seed database:', error);
        throw error;
    }
};

// Esporta modelli e utility
module.exports = {
    sequelize,
    User,
    Credential,
    Election,
    Candidate,
    VotingSession,
    Vote,
    Transaction,
    syncDatabase,
    testConnection,
    seedDatabase
};