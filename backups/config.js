// database/config.js - Configurazione database per container Docker
/*
const { Sequelize, DataTypes } = require('sequelize');

console.log('🔗 Inizializzazione database config...');
console.log('Environment vars:', {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    NODE_ENV: process.env.NODE_ENV
});

// Configurazione del database con variabili d'ambiente Docker
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
            underscored: false
        }
    }
);

// ====================
// MODELLI DATABASE
// ====================

// Modello User
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
    isAuthorized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    authorizationProof: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'suspended', 'pending', 'inactive'),
        defaultValue: 'pending'
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
    },
    loginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

// Modello Election
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
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
        defaultValue: 'draft'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    maxParticipants: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    settings: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
});

// ====================
// RELAZIONI
// ====================
/*
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
        
        // Crea dati di esempio se necessario
        await createSampleData();
        
        return true;
    } catch (error) {
        console.error('❌ Errore connessione database:', error);
        return false;
    }
};

// Crea dati di esempio
const createSampleData = async () => {
    try {
        // Controlla se ci sono già dati
        const userCount = await User.count();
        if (userCount > 0) {
            console.log('📊 Database già popolato');
            return;
        }

        console.log('📊 Creazione dati di esempio...');

        // Crea utenti di esempio
        await User.bulkCreate([
            {
                email: 'user1@example.com',
                password: 'hashedpassword1',
                firstName: 'Mario',
                lastName: 'Rossi',
                taxCode: 'RSSMRA80A01H501Z',
                status: 'active',
                isAuthorized: true
            },
            {
                email: 'user2@example.com', 
                password: 'hashedpassword2',
                firstName: 'Anna',
                lastName: 'Bianchi',
                taxCode: 'BNCNNA85B05H501A',
                status: 'active',
                isAuthorized: true
            },
            {
                email: 'admin@example.com',
                password: 'hashedadminpass',
                firstName: 'Admin',
                lastName: 'Sistema',
                taxCode: 'ADMINS90C10H501B',
                status: 'active',
                isAuthorized: true
            }
        ]);

        // Crea elezione di esempio
        const election = await Election.create({
            title: 'Elezioni Sindaco 2024',
            description: 'Elezione del sindaco per il mandato 2024-2029',
            startDate: new Date('2024-11-01'),
            endDate: new Date('2024-11-15'),
            status: 'active',
            isActive: true,
            maxParticipants: 1000
        });

        // Crea candidati
        await Candidate.bulkCreate([
            {
                name: 'Mario Rossi',
                description: 'Candidato Lista Civica',
                party: 'Lista Civica',
                valueEncoding: 1,
                electionId: election.id
            },
            {
                name: 'Anna Bianchi',
                description: 'Candidato Movimento Progressista',
                party: 'Movimento Progressista', 
                valueEncoding: 2,
                electionId: election.id
            }
        ]);

        // Crea whitelist
        await Whitelist.bulkCreate([
            {
                email: 'whitelist1@example.com',
                taxCode: 'WHTLST80A01H501C',
                firstName: 'Giuseppe',
                lastName: 'Verdi',
                addedBy: 'admin'
            }
        ]);

        // Crea impostazioni sistema
        await SystemSettings.bulkCreate([
            {
                key: 'system_name',
                value: 'E-Voting WabiSabi',
                description: 'Nome del sistema di voto',
                isPublic: true
            },
            {
                key: 'max_elections_concurrent',
                value: 5,
                description: 'Numero massimo di elezioni contemporanee',
                isPublic: false
            }
        ]);

        console.log('✅ Dati di esempio creati');
    } catch (error) {
        console.error('❌ Errore creazione dati esempio:', error);
    }
};

// Statistiche rapide
const getQuickStats = async () => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalElections,
            activeElections,
            totalVotes,
            pendingVotes
        ] = await Promise.all([
            User.count(),
            User.count({ where: { status: 'active' } }),
            Election.count(),
            Election.count({ where: { status: 'active' } }),
            Vote.count(),
            Vote.count({ where: { status: 'pending' } })
        ]);

        return {
            users: { total: totalUsers, active: activeUsers },
            elections: { total: totalElections, active: activeElections },
            votes: { total: totalVotes, pending: pendingVotes }
        };
    } catch (error) {
        console.error('Errore statistiche:', error);
        return {
            users: { total: 0, active: 0 },
            elections: { total: 0, active: 0 },
            votes: { total: 0, pending: 0 }
        };
    }
};

module.exports = {
    sequelize,
    User,
    Election,
    Candidate,
    Vote,
    VotingSession,
    Transaction,
    Whitelist,
    SystemSettings,
    initializeDatabase,
    getQuickStats
};

console.log('📦 Database config loaded');
*/
