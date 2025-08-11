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
    firstName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    party: {
        type: DataTypes.STRING,
        allowNull: true
    },
    photo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Base64 encoded photo'
    },
    biography: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // CAMPI BITCOIN/WABISABI
    bitcoinAddress: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        comment: 'Indirizzo Bitcoin univoco per questo candidato'
    },
    bitcoinPublicKey: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Chiave pubblica Bitcoin'
    },
    valueEncoding: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Valore numerico per codifica voto nel commitment'
    },
    totalVotesReceived: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});